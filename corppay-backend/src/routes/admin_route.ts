import { Request, Response, Router } from 'express'
import rateLimit from 'express-rate-limit'
import fs from 'fs'
import mongoose from 'mongoose'
import path from 'path'
import QRCode from 'qrcode'
import { validateTotpInput } from '../../src/validation/totpValidation'
import { requireAdminRole, validateAdminSetupKey } from '../middleware/admin_middleware'
import Company from '../models/Company'
import { createSendOnboardingEmailParams, sendOnboardingEmail } from '../services/admin_onboarding_email_service'
import { createOnboardingToken } from '../services/admin_onboarding_service'
import { createSendRejectionEmailParams, sendRejectionEmail } from '../services/admin_rejection_email_service'
import { createSendResubmissionEmailParams, sendResubmissionEmail } from '../services/admin_resubmission_email_service'
import { createResubmissionToken } from '../services/admin_resubmission_service'
import { issueAdminSessionToken } from '../services/root_session_service'
import { buildTotpUri, validateTotpCode } from '../services/root_totp_service'

// Returns true when the filename contains only safe alphanumeric and extension characters.
function isSafeFilename(filename: string): boolean
{
	return /^[a-zA-Z0-9_\-.]+$/.test(filename)
}

// Resolves the upload directory from the current working directory.
function resolveUploadDir(): string
{
	return path.resolve(process.cwd(), 'uploads')
}

// Extracts the string value of a key from an unknown request body record, returning empty string on failure.
function extractBodyString(body: Record<string, unknown>, key: string): string
{
	const val = body[key]
	return typeof val === 'string' ? val.trim() : ''
}

const router = Router()

// Throttles TOTP verification to defeat brute-forcing of the 6-digit admin code.
const totpLimiter = rateLimit({
	windowMs:        15 * 60 * 1000,
	max:             5,
	message:         { valid: false, error: 'Too many attempts. Try again in 15 minutes.' },
	standardHeaders: true,
	legacyHeaders:   false,
})

// Validates input format and TOTP code correctness, then returns a signed session JWT on success.
router.post('/validate-token', totpLimiter, async (req: Request, res: Response) =>
{
	const body       = req.body as Record<string, unknown>
	const code       = extractBodyString(body, 'code')
	const inputError = validateTotpInput(code)

	if (inputError !== null)
	{
		return res.status(400).json({ valid: false, error: inputError })
	}

	const result = await validateTotpCode(code)

	if (!result.valid)
	{
		return res.status(401).json({ valid: false, error: result.reason })
	}

	try
	{
		const sessionToken = issueAdminSessionToken()
		return res.status(200).json({ valid: true, sessionToken })
	}
	catch (e: unknown)
	{
		console.error('[admin_routes] session issuance error:', e)
		return res.status(500).json({ valid: false, error: 'Session issuance failed.' })
	}
})

// Returns a QR code PNG for TOTP authenticator enrollment, gated by the raw ADMIN_REVIEW_TOKEN as a setup key.
router.get('/setup', async (req: Request, res: Response) =>
{
	const headerKey = req.headers['x-setup-key']
	const setupKey  = typeof headerKey === 'string' ? headerKey : ''

	if (!validateAdminSetupKey(setupKey))
	{
		return res.status(401).json({ error: 'Invalid setup key.' })
	}

	try
	{
		const uri   = buildTotpUri('AdminReview', 'admin')
		const qrPng = await QRCode.toBuffer(uri)

		res.setHeader('Content-Type', 'image/png')
		res.setHeader('Cache-Control', 'no-store')
		return res.send(qrPng)
	}
	catch (e: unknown)
	{
		console.error('[admin_routes] QR generation error:', e)
		return res.status(500).json({ error: 'QR code generation failed.' })
	}
})

// Returns all company registration records sorted by newest submission first.
router.get('/companies', requireAdminRole, async (_req: Request, res: Response) =>
{
	try
	{
		const companies = await Company.find({}).sort({ createdAt: -1 }).lean()
		return res.json({ companies })
	}
	catch (err)
	{
		console.error('[admin_routes] companies fetch error:', err)
		return res.status(500).json({ error: 'Failed to retrieve companies.' })
	}
})

// Streams an uploaded company document after verifying admin role, filename safety, and that the file belongs to a company record.
router.get('/file/:filename', requireAdminRole, async (req: Request<{ filename: string }>, res: Response) =>
{
	const filename  = req.params.filename
	const uploadDir = resolveUploadDir()

	if (!isSafeFilename(filename))
	{
		return res.status(400).json({ error: 'Invalid filename.' })
	}

	const filePath = path.resolve(path.join(uploadDir, filename))

	try
	{
		const owner = await Company.findOne({ 'documents.storagePath': filePath }).lean()

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
		console.error('[admin_routes] file fetch error:', err)
		return res.status(500).json({ error: 'Failed to load document.' })
	}
})

// Approves a pending company registration, generates a 24-hour onboarding token, and dispatches the setup email.
router.post('/companies/:id/approve', requireAdminRole, async (req: Request<{ id: string }>, res: Response) =>
{
	try
	{
		const company = await Company.findById(req.params.id)

		if (!company)
		{
			return res.status(404).json({ error: 'Company not found.' })
		}

		if (company.status === 'approved')
		{
			return res.status(409).json({ error: 'Company is already approved.' })
		}

		company.status         = 'approved'
		company.reviewedAt     = new Date()
		company.reviewedByLabel = 'platform-admin'
		await company.save()

		const companyObjectId = company._id as mongoose.Types.ObjectId

		const tokenResult = await createOnboardingToken
		(
			company.submittedBy,
			company.ssmNumber,
			companyObjectId,
		)

		const emailParams     = createSendOnboardingEmailParams()
		emailParams.toAddress = company.submittedBy
		emailParams.token     = tokenResult.token

		await sendOnboardingEmail(emailParams)

		return res.status(200).json
		({
			message:   'Company approved. Onboarding email sent.',
			companyId: company._id,
		})
	}
	catch (err)
	{
		console.error('[admin_routes] approve error:', err)
		return res.status(500).json({ error: 'Approval failed. Please try again.' })
	}
})

// Rejects a pending company registration, persists an optional review note, and dispatches a rejection notification email.
router.post('/companies/:id/reject', requireAdminRole, async (req: Request<{ id: string }>, res: Response) =>
{
	try
	{
		const body       = req.body as Record<string, unknown>
		const reviewNote = extractBodyString(body, 'reviewNote')

		const company = await Company.findById(req.params.id)

		if (!company)
		{
			return res.status(404).json({ error: 'Company not found.' })
		}

		if (company.status === 'rejected')
		{
			return res.status(409).json({ error: 'Company is already rejected.' })
		}

		company.status     = 'rejected'
		company.reviewedAt = new Date()
		company.reviewNote = reviewNote !== '' ? reviewNote : null
		company.reviewedByLabel = 'platform-admin'
		await company.save()

		const emailParams        = createSendRejectionEmailParams()
		emailParams.toAddress    = company.submittedBy
		emailParams.reviewNote   = reviewNote

		await sendRejectionEmail(emailParams)

		return res.status(200).json
		({
			message:   'Company rejected. Notification email sent.',
			companyId: company._id,
		})
	}
	catch (err)
	{
		console.error('[admin_routes] reject error:', err)
		return res.status(500).json({ error: 'Rejection failed. Please try again.' })
	}
})

// Re-enables a rejected company registration for resubmission, generates a 24-hour token, and dispatches the invitation email.
router.post('/companies/:id/reenable', requireAdminRole, async (req: Request<{ id: string }>, res: Response) =>
{
	try
	{
		const company = await Company.findById(req.params.id)

		if (!company)
		{
			return res.status(404).json({ error: 'Company not found.' })
		}

		if (company.status !== 'rejected')
		{
			return res.status(409).json({ error: 'Only rejected applications can be re-enabled.' })
		}

		company.status            = 'awaiting_resubmit'
		company.reviewNote        = null
		company.resubmissionCount = company.resubmissionCount + 1
		company.reviewedByLabel = 'platform-admin'
		await company.save()

		const companyObjectId = company._id as mongoose.Types.ObjectId

		const tokenResult = await createResubmissionToken
		(
			company.submittedBy,
			company.ssmNumber,
			companyObjectId,
		)

		const emailParams        = createSendResubmissionEmailParams()
		emailParams.toAddress    = company.submittedBy
		emailParams.token        = tokenResult.token

		await sendResubmissionEmail(emailParams)

		return res.status(200).json
		({
			message:   'Application re-enabled. Resubmission email sent.',
			companyId: company._id,
		})
	}
	catch (err)
	{
		console.error('[admin_routes] reenable error:', err)
		return res.status(500).json({ error: 'Re-enable failed. Please try again.' })
	}
})

export default router