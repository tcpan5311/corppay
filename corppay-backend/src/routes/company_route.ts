import { randomUUID } from 'crypto'
import { Request, Response, Router } from 'express'
import fs from 'fs'
import multer, { FileFilterCallback } from 'multer'
import path from 'path'
import {
	FormErrors,
	UploadFileValidatable,
	hasErrors,
	validateAllFields,
} from '../../src/validation/registerBusinessValidation'
import { companyRateLimit } from '../middleware/company_middleware'
import { IUploadedDocument, createUploadedDocument } from '../models/Company'
import { createSendVerificationEmailParams, sendVerificationEmail } from '../services/admin_confirm_email_service'
import { createSavePendingRegistrationPayload, findActivePendingByName, findActivePendingBySsm, savePendingRegistration, verifyEmailToken } from '../services/admin_pending_registration_service'
import { findCompanyByName, findCompanyBySsm } from '../services/company_service'

// Extracts a string value from an unknown record by key, returning an empty string if absent or non-string.
function extractBodyString(body: Record<string, unknown>, key: string): string
{
	const val = body[key]
	return typeof val === 'string' ? val : ''
}

// Extracts the nested director sub-object from the request body, returning an empty record if absent.
function extractBodyDirector(body: Record<string, unknown>): Record<string, unknown>
{
	const val = body['director']
	if (typeof val !== 'object' || val === null) return {}
	return val as Record<string, unknown>
}

type UploadedFileInfo =
{
	mimetype: string
	size:     number
}

type RegistrationFieldValues =
{
	companyName:       string
	ssmNumber:         string
	entityType:        string
	registeredAddress: string
	registeredEmail:   string
	icPassport:        string
	directorRole:      string
	ownershipPct:      string
	ssmDoc:            UploadFileValidatable
	icDoc:             UploadFileValidatable
}

// Creates a fully initialized RegistrationFieldValues with empty strings and null documents.
function createRegistrationFieldValues(): RegistrationFieldValues
{
	return {
		companyName:       '',
		ssmNumber:         '',
		entityType:        '',
		registeredAddress: '',
		registeredEmail:   '',
		icPassport:        '',
		directorRole:      '',
		ownershipPct:      '',
		ssmDoc:            null,
		icDoc:             null,
	}
}

// Converts a multer file info object to the UploadFileValidatable shape expected by the shared validator.
function adaptMulterFile(file: UploadedFileInfo | null): UploadFileValidatable
{
	if (file === null) return null
	return { bytes: file.size, mimeType: file.mimetype }
}

// Collects all non-null error entries into a plain object suitable for inclusion in a 400 response body.
function collectErrorMessages(errors: FormErrors): Record<string, string>
{
	const result:   Record<string, string>                              = {}
	const entries = Object.entries(errors) as [keyof FormErrors, string | null][]

	for (const [field, message] of entries)
	{
		if (message !== null)
		{
			result[field] = message
		}
	}

	return result
}

// Extracts all registration field values from the request body and multer file map, adapting them to the shared validator shape.
function buildRegistrationFieldValues
(
	body:  Record<string, unknown>,
	files: Record<string, Express.Multer.File[]> | null,
): RegistrationFieldValues
{
	const director           = extractBodyDirector(body)
	const icPassportNested   = extractBodyString(director, 'icPassport')
	const icPassportFlat     = extractBodyString(body, 'director.icPassport')
	const icPassportRaw      = icPassportNested !== '' ? icPassportNested : icPassportFlat

	const directorRoleNested = extractBodyString(director, 'role')
	const directorRoleFlat   = extractBodyString(body, 'director.role')
	const directorRoleRaw    = directorRoleNested !== '' ? directorRoleNested : directorRoleFlat

	const ownershipNested    = extractBodyString(director, 'ownershipPct')
	const ownershipFlat      = extractBodyString(body, 'director.ownershipPct')
	const ownershipPctRaw    = ownershipNested !== '' ? ownershipNested : ownershipFlat

	const ssmMulFile = files !== null && files['ssmDoc'] !== undefined && files['ssmDoc'][0] !== undefined
		? files['ssmDoc'][0]
		: null
	const icMulFile  = files !== null && files['icDoc'] !== undefined && files['icDoc'][0] !== undefined
		? files['icDoc'][0]
		: null

	const ssmFileInfo: UploadedFileInfo | null = ssmMulFile !== null
		? { mimetype: ssmMulFile.mimetype, size: ssmMulFile.size }
		: null
	const icFileInfo: UploadedFileInfo | null = icMulFile !== null
		? { mimetype: icMulFile.mimetype, size: icMulFile.size }
		: null

	const values             = createRegistrationFieldValues()
	values.companyName       = extractBodyString(body, 'name')
	values.ssmNumber         = extractBodyString(body, 'ssmNumber')
	values.entityType        = extractBodyString(body, 'entityType')
	values.registeredAddress = extractBodyString(body, 'registeredAddress')
	values.registeredEmail   = extractBodyString(body, 'submittedBy')
	values.icPassport        = icPassportRaw
	values.directorRole      = directorRoleRaw
	values.ownershipPct      = ownershipPctRaw
	values.ssmDoc            = adaptMulterFile(ssmFileInfo)
	values.icDoc             = adaptMulterFile(icFileInfo)
	return values
}

const uploadDir = path.resolve(process.cwd(), 'uploads')

if (!fs.existsSync(uploadDir))
{
	fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.memoryStorage()

// Writes a validated in-memory upload to the uploads directory, records its path for later cleanup, and returns its absolute storage path.
function persistUploadedFile(file: Express.Multer.File, writtenPaths: string[]): string
{
	const ext      = path.extname(file.originalname)
	const filename = `${randomUUID()}${ext}`
	const target   = path.join(uploadDir, filename)
	fs.writeFileSync(target, file.buffer)
	writtenPaths.push(target)
	return target
}

// Removes the given files from disk, ignoring any that are already absent.
function discardPersistedFiles(writtenPaths: string[]): void
{
	for (const target of writtenPaths)
	{
		if (fs.existsSync(target))
		{
			fs.unlinkSync(target)
		}
	}
}

// Allows only PDF, JPEG, and PNG files through the multer upload pipeline.
function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void
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

const upload       = multer({ storage, fileFilter })
const uploadFields = upload.fields
([
	{ name: 'ssmDoc', maxCount: 1 },
	{ name: 'icDoc',  maxCount: 1 },
])

type ResolvedFiles =
{
	ssmFile: Express.Multer.File | null
	icFile:  Express.Multer.File | null
	error:   string
}

// Creates a ResolvedFiles representing a failed resolution with the given error message.
function createResolvedFilesError(message: string): ResolvedFiles
{
	return { ssmFile: null, icFile: null, error: message }
}

// Creates a ResolvedFiles representing a successful resolution with both files present.
function createResolvedFilesSuccess(ssmFile: Express.Multer.File, icFile: Express.Multer.File): ResolvedFiles
{
	return { ssmFile, icFile, error: '' }
}

// Extracts and validates uploaded SSM and IC files from the multer files map, returning an error string on failure.
function resolveUploadedFiles(files: Record<string, Express.Multer.File[]> | null): ResolvedFiles
{
	if (!files || !files['ssmDoc'] || !files['ssmDoc'][0])
	{
		return createResolvedFilesError('Certificate of Incorporation (SSM) is required.')
	}
	if (!files['icDoc'] || !files['icDoc'][0])
	{
		return createResolvedFilesError('Director IC / Passport copy is required.')
	}
	return createResolvedFilesSuccess(files['ssmDoc'][0], files['icDoc'][0])
}

// Persists both validated uploads to disk and returns the documents describing them, recording each written path for cleanup.
function buildDocuments(ssmFile: Express.Multer.File, icFile: Express.Multer.File, writtenPaths: string[]): IUploadedDocument[]
{
	const ssmDoc        = createUploadedDocument()
	ssmDoc.fieldName    = 'ssm_cert'
	ssmDoc.originalName = ssmFile.originalname
	ssmDoc.storagePath  = persistUploadedFile(ssmFile, writtenPaths)
	ssmDoc.mimeType     = ssmFile.mimetype
	ssmDoc.sizeBytes    = ssmFile.size
	ssmDoc.uploadedAt   = new Date()

	const icDoc         = createUploadedDocument()
	icDoc.fieldName     = 'director_ic'
	icDoc.originalName  = icFile.originalname
	icDoc.storagePath   = persistUploadedFile(icFile, writtenPaths)
	icDoc.mimeType      = icFile.mimetype
	icDoc.sizeBytes     = icFile.size
	icDoc.uploadedAt    = new Date()

	return [ssmDoc, icDoc]
}

// Parses the ownership percentage from the director sub-object, returning null when absent or blank.
function resolveOwnershipPct(body: Record<string, unknown>): number | null
{
	const director = extractBodyDirector(body)
	const nested   = extractBodyString(director, 'ownershipPct')
	const flat     = extractBodyString(body, 'director.ownershipPct')
	const raw      = nested !== '' ? nested : flat
	if (raw === '') return null
	const parsed = parseFloat(raw)
	return isNaN(parsed) ? null : parsed
}

// Resolves the director IC/passport number from either nested or flat form encoding.
function resolveDirectorIcPassport(body: Record<string, unknown>): string
{
	const director = extractBodyDirector(body)
	const nested   = extractBodyString(director, 'icPassport')
	if (nested !== '') return nested
	return extractBodyString(body, 'director.icPassport')
}

// Resolves the director role from either nested or flat form encoding.
function resolveDirectorRole(body: Record<string, unknown>): string
{
	const director = extractBodyDirector(body)
	const nested   = extractBodyString(director, 'role')
	if (nested !== '') return nested
	return extractBodyString(body, 'director.role')
}

const router = Router()

// Validates all registration fields, checks for SSM conflicts, saves a pending registration, and dispatches a verification email.
router.post('/initiate-register', companyRateLimit, uploadFields, async (req: Request, res: Response) =>
{
	const files = req.files as Record<string, Express.Multer.File[]> | null
	const body  = req.body  as Record<string, unknown>

	const values = buildRegistrationFieldValues(body, files)
	const errors = validateAllFields
	(
		values.companyName,
		values.ssmNumber,
		values.entityType,
		values.registeredAddress,
		values.registeredEmail,
		values.icPassport,
		values.directorRole,
		values.ownershipPct,
		values.ssmDoc,
		values.icDoc,
	)

	if (hasErrors(errors))
	{
		return res.status(400).json({
			error:  'Validation failed.',
			errors: collectErrorMessages(errors),
		})
	}

	const resolved = resolveUploadedFiles(files)

	if (resolved.error !== '')
	{
		return res.status(400).json({ error: resolved.error })
	}

	const existingCompany = await findCompanyBySsm(extractBodyString(body, 'ssmNumber'))

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

	const existingPending = await findActivePendingBySsm(extractBodyString(body, 'ssmNumber'))

	if (existingPending !== null)
	{
		return res.status(409).json({ error: 'A verification email for this SSM number was already sent. Please check your inbox, or wait for it to expire before resubmitting.' })
	}

	const existingCompanyByName = await findCompanyByName(extractBodyString(body, 'name'))

	if (existingCompanyByName !== null)
	{
		if (existingCompanyByName.status === 'approved')
		{
			return res.status(409).json({ error: 'A company with this name is already registered.' })
		}
		if (existingCompanyByName.status === 'pending')
		{
			return res.status(409).json({ error: 'A registration with this company name is already under review.' })
		}
	}

	const existingPendingByName = await findActivePendingByName(extractBodyString(body, 'name'))

	if (existingPendingByName !== null)
	{
		return res.status(409).json({ error: 'A verification email for a company with this name was already sent. Please check your inbox, or wait for it to expire before resubmitting.' })
	}

	const ssmFile      = resolved.ssmFile as Express.Multer.File
	const icFile       = resolved.icFile  as Express.Multer.File
	const ownershipPct = resolveOwnershipPct(body)
	const icPassport   = resolveDirectorIcPassport(body)
	const directorRole = resolveDirectorRole(body)
	const writtenPaths: string[] = []

	try
	{
		const documents                      = buildDocuments(ssmFile, icFile, writtenPaths)
		const payload                        = createSavePendingRegistrationPayload()
		payload.name                         = extractBodyString(body, 'name')
		payload.ssmNumber                    = extractBodyString(body, 'ssmNumber')
		payload.entityType                   = extractBodyString(body, 'entityType')
		payload.registeredAddress            = extractBodyString(body, 'registeredAddress')
		payload.submittedBy                  = extractBodyString(body, 'submittedBy').trim()
		payload.directorIcPassport           = icPassport
		payload.directorRole                 = directorRole
		payload.directorOwnershipPct         = ownershipPct
		payload.documents                    = documents

		const saved = await savePendingRegistration(payload)

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
		discardPersistedFiles(writtenPaths)
		const message = (err as Error).message !== '' ? (err as Error).message : 'Registration failed. Please try again.'
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

// Escapes HTML-significant characters to prevent markup injection in the rendered page.
function escapeHtml(value: string): string
{
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

// Renders a self-contained HTML confirmation page reflecting verification success or failure.
function renderVerifyPage(success: boolean, errorMessage: string): string
{
	const title   = success ? 'Email Verified' : 'Verification Failed'
	const heading = success ? '✅ Registration Confirmed' : '❌ Verification Failed'
	const body    = success
		? 'Your email has been verified and your business registration has been submitted for review. You will be notified once it is approved.'
		: escapeHtml(errorMessage)

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