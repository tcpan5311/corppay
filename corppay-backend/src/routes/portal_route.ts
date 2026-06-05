import { Request, Response, Router } from 'express'
import fs from 'fs'
import mongoose from 'mongoose'
import path from 'path'
import { authenticate, requireRole } from '../middleware/auth_middleware'
import AdminUser from '../models/AdminUser'
import UserApplication from '../models/UserApplication'
import { createSendUserOnboardingEmailParams, sendUserOnboardingEmail } from '../services/user_onboarding_email_service'
import { createUserOnboardingToken } from '../services/user_onboarding_service'
import { createSendUserRejectionEmailParams, sendUserRejectionEmail } from '../services/user_rejection_email_service'
import { createSendUserResubmissionEmailParams, sendUserResubmissionEmail } from '../services/user_resubmission_email_service'
import { createUserResubmissionToken } from '../services/user_resubmission_service'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Extracts a string value from an unknown record by key, returning an empty string if absent or non-string.
function extractBodyString(body: Record<string, unknown>, key: string): string
{
	const val = body[key]
	return typeof val === 'string' ? val : ''
}

// Resolves the absolute uploads directory used to store and serve KYC documents.
function resolveUploadDir(): string
{
	return path.resolve(process.cwd(), 'uploads')
}

// Returns true only when the filename is a plain basename with no path separators or traversal sequences.
function isSafeFilename(filename: string): boolean
{
	if (filename === '')                 return false
	if (filename.includes('..'))         return false
	if (filename.includes('/'))          return false
	if (filename.includes('\\'))         return false
	return true
}

type AdminCompanyContext =
{
	resolved:    boolean
	adminUserId: string
	companyId:   string
}

// Creates a fully initialized AdminCompanyContext defaulting to unresolved with empty identifiers.
function createAdminCompanyContext(): AdminCompanyContext
{
	return { resolved: false, adminUserId: '', companyId: '' }
}

// Resolves the authenticated admin's own AdminUser id and company id from the request's verified token subject.
async function resolveAdminCompanyContext(req: Request): Promise<AdminCompanyContext>
{
	const context = createAdminCompanyContext()
	const user    = req.user

	if (user === null) return context

	const sub = typeof user['sub'] === 'string' ? user['sub'] : ''
	if (sub === '' || !mongoose.Types.ObjectId.isValid(sub)) return context

	const adminUser = await AdminUser.findById(sub)
	if (adminUser === null) return context

	context.resolved    = true
	context.adminUserId = String(adminUser._id)
	context.companyId   = String(adminUser.companyId)
	return context
}

// ─── Router ───────────────────────────────────────────────────────────────────

const router = Router()

// Returns the KYC applications targeted at the authenticated admin's own company, newest first.
router.get('/applications', authenticate, requireRole('admin'), async (req: Request, res: Response) =>
{
	try
	{
		const context = await resolveAdminCompanyContext(req)
		if (!context.resolved)
		{
			return res.status(403).json({ error: 'No company is associated with this admin account.' })
		}

		const applications = await UserApplication
			.find({ targetCompanyId: context.companyId })
			.sort({ createdAt: -1 })
			.lean()

		return res.json({ applications })
	}
	catch (err)
	{
		console.error('[portal_routes] applications fetch error:', err)
		return res.status(500).json({ error: 'Failed to retrieve applications.' })
	}
})

// Streams a KYC document file, but only if it belongs to an application targeted at the admin's own company.
router.get('/applications/file/:filename', authenticate, requireRole('admin'), async (req: Request<{ filename: string }>, res: Response) =>
{
	try
	{
		const context = await resolveAdminCompanyContext(req)
		if (!context.resolved)
		{
			return res.status(403).json({ error: 'No company is associated with this admin account.' })
		}

		const filename = req.params.filename
		if (!isSafeFilename(filename))
		{
			return res.status(400).json({ error: 'Invalid filename.' })
		}

		const uploadDir = resolveUploadDir()
		const filePath  = path.resolve(path.join(uploadDir, filename))

		const owner = await UserApplication.findOne({
			targetCompanyId:        context.companyId,
			'documents.storagePath': filePath,
		}).lean()

		if (owner === null)
		{
			return res.status(404).json({ error: 'File not found.' })
		}

		if (!fs.existsSync(filePath))
		{
			return res.status(404).json({ error: 'File not found.' })
		}

		return res.sendFile(filePath)
	}
	catch (err)
	{
		console.error('[portal_routes] application-file error:', err)
		return res.status(500).json({ error: 'Failed to load document.' })
	}
})

// Approves an application for the admin's own company, assigns role and department, issues an onboarding token, and emails the applicant.
router.post('/applications/:id/approve', authenticate, requireRole('admin'), async (req: Request<{ id: string }>, res: Response) =>
{
	try
	{
		const context = await resolveAdminCompanyContext(req)
		if (!context.resolved)
		{
			return res.status(403).json({ error: 'No company is associated with this admin account.' })
		}

		const body       = req.body as Record<string, unknown>
		const role       = extractBodyString(body, 'role')
		const department = extractBodyString(body, 'department')

		if (role === '')
		{
			return res.status(400).json({ error: 'A role must be assigned.' })
		}
		if (department === '')
		{
			return res.status(400).json({ error: 'A department must be assigned.' })
		}

		const application = await UserApplication.findById(req.params.id)

		if (application === null)
		{
			return res.status(404).json({ error: 'Application not found.' })
		}

		if (String(application.targetCompanyId) !== context.companyId)
		{
			return res.status(403).json({ error: 'This application does not belong to your company.' })
		}

		if (application.status === 'approved')
		{
			return res.status(409).json({ error: 'Application is already approved.' })
		}

		const companyObjectId = application.targetCompanyId
		application.status             = 'approved'
		application.assignedCompanyId  = companyObjectId
		application.assignedRole       = role
		application.assignedDepartment = department
		application.reviewedBy         = new mongoose.Types.ObjectId(context.adminUserId)
		application.reviewedAt         = new Date()
		await application.save()

		const applicationObjectId = application._id as mongoose.Types.ObjectId

		const tokenResult = await createUserOnboardingToken(
			application.email,
			applicationObjectId,
			companyObjectId,
			role,
			department,
		)

		const emailParams      = createSendUserOnboardingEmailParams()
		emailParams.toAddress  = application.email
		emailParams.token      = tokenResult.token
		emailParams.role       = role
		emailParams.department = department

		await sendUserOnboardingEmail(emailParams)

		return res.status(200).json({
			message:       'Application approved. Onboarding email sent.',
			applicationId: application._id,
		})
	}
	catch (err)
	{
		console.error('[portal_routes] approve error:', err)
		return res.status(500).json({ error: 'Approval failed. Please try again.' })
	}
})

// Rejects an application for the admin's own company, persists an optional review note, and emails the applicant.
router.post('/applications/:id/reject', authenticate, requireRole('admin'), async (req: Request<{ id: string }>, res: Response) =>
{
	try
	{
		const context = await resolveAdminCompanyContext(req)
		if (!context.resolved)
		{
			return res.status(403).json({ error: 'No company is associated with this admin account.' })
		}

		const body       = req.body as Record<string, unknown>
		const reviewNote = extractBodyString(body, 'reviewNote')

		const application = await UserApplication.findById(req.params.id)

		if (application === null)
		{
			return res.status(404).json({ error: 'Application not found.' })
		}

		if (String(application.targetCompanyId) !== context.companyId)
		{
			return res.status(403).json({ error: 'This application does not belong to your company.' })
		}

		if (application.status === 'rejected')
		{
			return res.status(409).json({ error: 'Application is already rejected.' })
		}

		application.status     = 'rejected'
		application.reviewedBy = new mongoose.Types.ObjectId(context.adminUserId)
		application.reviewedAt = new Date()
		application.reviewNote = reviewNote !== '' ? reviewNote : null
		await application.save()

		const emailParams      = createSendUserRejectionEmailParams()
		emailParams.toAddress  = application.email
		emailParams.reviewNote = reviewNote

		await sendUserRejectionEmail(emailParams)

		return res.status(200).json({
			message:       'Application rejected. Notification email sent.',
			applicationId: application._id,
		})
	}
	catch (err)
	{
		console.error('[portal_routes] reject error:', err)
		return res.status(500).json({ error: 'Rejection failed. Please try again.' })
	}
})

// Re-enables a rejected application for the admin's own company, issues a resubmission token, and emails the applicant.
router.post('/applications/:id/reenable', authenticate, requireRole('admin'), async (req: Request<{ id: string }>, res: Response) =>
{
	try
	{
		const context = await resolveAdminCompanyContext(req)
		if (!context.resolved)
		{
			return res.status(403).json({ error: 'No company is associated with this admin account.' })
		}

		const application = await UserApplication.findById(req.params.id)

		if (application === null)
		{
			return res.status(404).json({ error: 'Application not found.' })
		}

		if (String(application.targetCompanyId) !== context.companyId)
		{
			return res.status(403).json({ error: 'This application does not belong to your company.' })
		}

		if (application.status !== 'rejected')
		{
			return res.status(409).json({ error: 'Only rejected applications can be re-enabled.' })
		}

		application.status            = 'awaiting_resubmit'
		application.reviewNote        = null
		application.resubmissionCount = application.resubmissionCount + 1
		await application.save()

		const applicationObjectId = application._id as mongoose.Types.ObjectId

		const tokenResult = await createUserResubmissionToken(application.email, applicationObjectId)

		const emailParams     = createSendUserResubmissionEmailParams()
		emailParams.toAddress = application.email
		emailParams.token     = tokenResult.token

		await sendUserResubmissionEmail(emailParams)

		return res.status(200).json({
			message:       'Application re-enabled. Resubmission email sent.',
			applicationId: application._id,
		})
	}
	catch (err)
	{
		console.error('[portal_routes] reenable error:', err)
		return res.status(500).json({ error: 'Re-enable failed. Please try again.' })
	}
})

export default router