import { randomUUID } from 'crypto'
import { Request, Response, Router } from 'express'
import fs from 'fs'
import multer, { FileFilterCallback } from 'multer'
import path from 'path'

import { companyRateLimit } from '../middleware/company_middleware'
import { IUploadedDocument } from '../models/Company'
import { findCompanyBySsm, getCompaniesByUser, getCompanyById, registerCompany } from '../services/company_service'
import { createSendVerificationEmailParams, sendVerificationEmail } from '../services/email_service'
import { createSavePendingRegistrationPayload, findActivePendingBySsm, savePendingRegistration, verifyEmailToken } from '../services/pending_registration_service'

const uploadDir = process.env.UPLOAD_DIR ? process.env.UPLOAD_DIR : 'uploads/'

if (!fs.existsSync(uploadDir))
{
	fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage
({
	// Resolves the destination directory for incoming uploaded files.
	destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) =>
	{
		cb(null, uploadDir)
	},

	// Generates a UUID-based filename while preserving the original file extension.
	filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) =>
	{
		const ext  = path.extname(file.originalname)
		const safe = randomUUID()
		cb(null, `${safe}${ext}`)
	},
})

// Allows only PDF, JPEG, and PNG files through the multer upload pipeline.
function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback)
{
	const allowed = ['application/pdf', 'image/jpeg', 'image/png']
	if (allowed.includes(file.mimetype))
	{
		cb(null, true)
	}
	else
	{
		cb(new Error('Only PDF, JPG, and PNG files are allowed.'))
	}
}

const upload = multer({ storage, fileFilter })

const uploadFields = upload.fields
([
	{ name: 'ssmDoc', maxCount: 1 },
	{ name: 'icDoc',  maxCount: 1 },
])

// Extracts and validates uploaded SSM and IC files from the multer files map, returning an error string on failure.
function resolveUploadedFiles(files: Record<string, Express.Multer.File[]> | null): { ssmFile: Express.Multer.File | null; icFile: Express.Multer.File | null; error: string }
{
	if (!files || !files['ssmDoc'] || !files['ssmDoc'][0])
	{
		return { ssmFile: null, icFile: null, error: 'Certificate of Incorporation (SSM) is required.' }
	}
	if (!files['icDoc'] || !files['icDoc'][0])
	{
		return { ssmFile: null, icFile: null, error: 'Director IC / Passport copy is required.' }
	}
	return { ssmFile: files['ssmDoc'][0], icFile: files['icDoc'][0], error: '' }
}

// Builds the IUploadedDocument array from the two required multer file objects.
function buildDocuments(ssmFile: Express.Multer.File, icFile: Express.Multer.File): IUploadedDocument[]
{
	const ssmDoc: IUploadedDocument =
	{
		fieldName:    'ssm_cert',
		originalName: ssmFile.originalname,
		storagePath:  ssmFile.path,
		mimeType:     ssmFile.mimetype,
		sizeBytes:    ssmFile.size,
		uploadedAt:   new Date(),
	}
	const icDoc: IUploadedDocument =
	{
		fieldName:    'director_ic',
		originalName: icFile.originalname,
		storagePath:  icFile.path,
		mimeType:     icFile.mimetype,
		sizeBytes:    icFile.size,
		uploadedAt:   new Date(),
	}
	return [ssmDoc, icDoc]
}

// Parses the ownership percentage from the request body, returning null when absent or blank.
function resolveOwnershipPct(body: any): number | null
{
	if (body && body.director && body.director.ownershipPct !== null && body.director.ownershipPct !== '')
	{
		return parseFloat(body.director.ownershipPct)
	}
	return null
}

// Resolves the director IC/passport number from either nested or flat form encoding.
function resolveDirectorIcPassport(body: any): string
{
	if (body && body.director && body.director.icPassport) return body.director.icPassport
	return body['director.icPassport']
}

// Resolves the director role from either nested or flat form encoding.
function resolveDirectorRole(body: any): string
{
	if (body && body.director && body.director.role) return body.director.role
	return body['director.role']
}

const router = Router()

// Validates uploaded documents, maps form fields, and persists the company registration directly.
router.post('/register', companyRateLimit, uploadFields, async (req: Request, res: Response) =>
{
	const files = req.files as Record<string, Express.Multer.File[]> | null

	if (!files || !files['ssmDoc'] || !files['ssmDoc'][0])
	{
		return res.status(400).json({ error: 'Certificate of Incorporation (SSM) is required.' })
	}

	if (!files || !files['icDoc'] || !files['icDoc'][0])
	{
		return res.status(400).json({ error: 'Director IC / Passport copy is required.' })
	}

	const ssmFile = files['ssmDoc'][0]
	const icFile  = files['icDoc'][0]

	const documents: IUploadedDocument[] = [
		{
			fieldName:    'ssm_cert',
			originalName: ssmFile.originalname,
			storagePath:  ssmFile.path,
			mimeType:     ssmFile.mimetype,
			sizeBytes:    ssmFile.size,
			uploadedAt:   new Date(),
		},
		{
			fieldName:    'director_ic',
			originalName: icFile.originalname,
			storagePath:  icFile.path,
			mimeType:     icFile.mimetype,
			sizeBytes:    icFile.size,
			uploadedAt:   new Date(),
		},
	]

	const body: any = req.body

	let ownershipPct = null
	if (body && body.director && body.director.ownershipPct !== null && body.director.ownershipPct !== '')
	{
		ownershipPct = parseFloat(body.director.ownershipPct)
	}

	try
	{
		const directorIcPassport = body && body.director && body.director.icPassport ? body.director.icPassport : body['director.icPassport']
		const directorRole       = body && body.director && body.director.role ? body.director.role : body['director.role']

		const company = await registerCompany
		({
			name:              body.name,
			ssmNumber:         body.ssmNumber,
			entityType:        body.entityType,
			registeredAddress: body.registeredAddress,
			director: {
				icPassport:   directorIcPassport,
				role:         directorRole,
				ownershipPct,
			},
			documents,
			submittedBy: body.submittedBy ? body.submittedBy : 'anonymous',
		})

		return res.status(201).json
		({
			message: 'Company registration submitted successfully.',
			company: {
				id:         company._id,
				name:       company.name,
				ssmNumber:  company.ssmNumber,
				entityType: company.entityType,
				status:     company.status,
				createdAt:  company.createdAt,
			},
		})
	}
	catch (err)
	{
		const message = (err as Error).message ? (err as Error).message : 'Registration failed. Please try again.'

		if (message.includes('already'))
		{
			return res.status(409).json({ error: message })
		}

		console.error('[company_routes] registerCompany error:', err)
		return res.status(500).json({ error: message })
	}
})

// Checks for SSM conflicts in both companies and pendingRegistrations, then saves the registration as pending and dispatches a verification email.
router.post('/initiate-register', companyRateLimit, uploadFields, async (req: Request, res: Response) =>
{
	const files                      = req.files as Record<string, Express.Multer.File[]> | null
	const { ssmFile, icFile, error } = resolveUploadedFiles(files)

	if (error !== '')
	{
		return res.status(400).json({ error })
	}

	const body: any = req.body

	if (!body.submittedBy || body.submittedBy.trim() === '')
	{
		return res.status(400).json({ error: 'A valid email address is required to verify your registration.' })
	}

	if (!body.ssmNumber || body.ssmNumber.trim() === '')
	{
		return res.status(400).json({ error: 'SSM number is required.' })
	}

	const existingCompany = await findCompanyBySsm(body.ssmNumber)

	if (existingCompany !== null)
	{
		if (existingCompany.status === 'approved')
		{
			return res.status(409).json({ error: 'A company with this SSM number is already registered.' })
		}
		if (existingCompany.status === 'pending')
		{
			return res.status(409).json({ error: 'A registration for this SSM number is already under review.' })
		}
	}

	const existingPending = await findActivePendingBySsm(body.ssmNumber)

	if (existingPending !== null)
	{
		return res.status(409).json({ error: 'A verification email for this SSM number was already sent. Please check your inbox, or wait for it to expire before resubmitting.' })
	}

	const documents    = buildDocuments(ssmFile!, icFile!)
	const ownershipPct = resolveOwnershipPct(body)
	const icPassport   = resolveDirectorIcPassport(body)
	const directorRole = resolveDirectorRole(body)

	try
	{
		const payload                    = createSavePendingRegistrationPayload()
		payload.name                     = body.name
		payload.ssmNumber                = body.ssmNumber
		payload.entityType               = body.entityType
		payload.registeredAddress        = body.registeredAddress
		payload.submittedBy              = body.submittedBy.trim()
		payload.directorIcPassport       = icPassport
		payload.directorRole             = directorRole
		payload.directorOwnershipPct     = ownershipPct
		payload.documents                = documents

		const saved           = await savePendingRegistration(payload)

		const emailParams     = createSendVerificationEmailParams()
		emailParams.toAddress = payload.submittedBy
		emailParams.token     = saved.token

		await sendVerificationEmail(emailParams)

		return res.status(202).json({
			message:   'Verification email sent. Please check your inbox and confirm within 15 minutes.',
			expiresAt: saved.expiresAt,
		})
	}
	catch (err)
	{
		const message = (err as Error).message ? (err as Error).message : 'Registration failed. Please try again.'
		console.error('[company_routes] initiate-register error:', err)
		return res.status(500).json({ error: message })
	}
})

// Validates the verification token and, if valid, promotes the pending registration to a confirmed company record.
router.get('/verify-email', async (req: Request, res: Response) =>
{
	const token = req.query['token']

	if (!token || typeof token !== 'string' || token.trim() === '')
	{
		return res.status(400).send(renderVerifyPage(false, 'Missing or invalid verification token.'))
	}

	try
	{
		const result = await verifyEmailToken(token.trim())

		if (!result.success)
		{
			return res.status(400).send(renderVerifyPage(false, result.errorMessage))
		}

		return res.status(200).send(renderVerifyPage(true, ''))
	}
	catch (err)
	{
		console.error('[company_routes] verify-email error:', err)
		return res.status(500).send(renderVerifyPage(false, 'An unexpected error occurred. Please try again.'))
	}
})

// Returns all company registrations submitted by the anonymous user.
router.get('/mine', async (_req: Request, res: Response) =>
{
	try
	{
		const companies = await getCompaniesByUser('anonymous')
		return res.json({ companies })
	}
	catch (err)
	{
		console.error('[company_routes] getCompaniesByUser error:', err)
		return res.status(500).json({ error: 'Failed to retrieve companies.' })
	}
})

// Returns the company document matching the given ID, or a 404 if not found.
router.get('/:id', async (req: Request<{ id: string }>, res: Response) =>
{
	try
	{
		const company = await getCompanyById(req.params.id)

		if (!company)
		{
			return res.status(404).json({ error: 'Company not found.' })
		}

		return res.json({ company })
	}
	catch (err)
	{
		console.error('[company_routes] getCompanyById error:', err)
		return res.status(500).json({ error: 'Failed to retrieve company.' })
	}
})

// Renders a self-contained HTML confirmation page reflecting verification success or failure.
function renderVerifyPage(success: boolean, errorMessage: string): string
{
	const title   = success ? 'Email Verified' : 'Verification Failed'
	const heading = success ? '✅ Registration Confirmed' : '❌ Verification Failed'
	const body    = success
		? 'Your email has been verified and your business registration has been submitted for review. You will be notified once it is approved.'
		: errorMessage

	return `<!DOCTYPE html>
		<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>${title} — CorpPay</title>
				<style>
					body { font-family: sans-serif; background: #f9fafb; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
					.card { background: #fff; border-radius: 16px; padding: 40px 32px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
					h1 { font-size: 22px; color: #1e293b; margin: 0 0 12px; }
					p  { font-size: 15px; color: #475569; line-height: 1.6; margin: 0; }
				</style>
			</head>
			<body>
				<div class="card">
					<h1>${heading}</h1>
					<p>${body}</p>
				</div>
			</body>
		</html>`
}

export default router