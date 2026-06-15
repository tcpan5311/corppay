import { randomUUID } from 'crypto'
import { Request, Response, Router } from 'express'
import fs from 'fs'
import multer, { FileFilterCallback } from 'multer'
import path from 'path'
import { companyRateLimit } from '../middleware/company_middleware'
import Company, { IUploadedDocument, createUploadedDocument } from '../models/Company'
import { findApplicationByEmail } from '../services/user_application_service'
import { createSendVerificationEmailParams, sendVerificationEmail } from '../services/user_confirm_email_service'
import {
	createSavePendingUserRegistrationPayload,
	findActivePendingByEmail,
	savePendingUserRegistration,
	verifyEmailToken,
} from '../services/user_pending_registration_service'
import {
	FormErrors,
	UploadFileValidatable,
	hasErrors,
	validateAllFields,
} from '../validation/registerUserValidation'

// Extracts a string value from an unknown record by key, returning an empty string if absent or non-string.
function extractBodyString(body: Record<string, unknown>, key: string): string
{
	const val = body[key]
	return typeof val === 'string' ? val : ''
}

type UploadedFileInfo =
{
	mimetype: string
	size:     number
}

type RegistrationFieldValues =
{
	fullName:     string
	dateOfBirth:  string
	nationality:  string
	gender:       string
	email:        string
	mobileNumber: string
	fullAddress:  string
	documentType: string
	targetCompanyId: string
	idDoc:        UploadFileValidatable
}

// Creates a fully initialized RegistrationFieldValues with empty strings and a null document.
function createRegistrationFieldValues(): RegistrationFieldValues
{
	return {
		fullName:     '',
		dateOfBirth:  '',
		nationality:  '',
		gender:       '',
		email:        '',
		mobileNumber: '',
		fullAddress:  '',
		documentType: '',
		targetCompanyId: '',
		idDoc:        null,
	}
}

// Converts a multer file info object to the UploadFileValidatable shape expected by the shared validator.
function adaptMulterFile(file: UploadedFileInfo | null): UploadFileValidatable
{
	if (file === null) return null
	return { bytes: file.size, mimeType: file.mimetype }
}

// Resolves the first multer file for the given field name from the files map, returning null when absent.
function resolveMulterFile(files: Record<string, Express.Multer.File[]> | null, field: string): Express.Multer.File | null
{
	if (files === null) return null
	const list = files[field]
	if (!Array.isArray(list) || list.length === 0) return null
	return list[0]
}

// Collects all non-null error entries into a plain object suitable for inclusion in a 400 response body.
function collectErrorMessages(errors: FormErrors): Record<string, string>
{
	const result:  Record<string, string>                              = {}
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
	const idMulFile  = resolveMulterFile(files, 'idDoc')
	const idFileInfo: UploadedFileInfo | null = idMulFile !== null
		? { mimetype: idMulFile.mimetype, size: idMulFile.size }
		: null

	const values        = createRegistrationFieldValues()
	values.fullName     = extractBodyString(body, 'fullName')
	values.dateOfBirth  = extractBodyString(body, 'dateOfBirth')
	values.nationality  = extractBodyString(body, 'nationality')
	values.gender       = extractBodyString(body, 'gender')
	values.email        = extractBodyString(body, 'email')
	values.mobileNumber = extractBodyString(body, 'mobileNumber')
	values.fullAddress  = extractBodyString(body, 'fullAddress')
	values.documentType = extractBodyString(body, 'documentType')
	values.targetCompanyId = extractBodyString(body, 'targetCompanyId')
	values.idDoc        = adaptMulterFile(idFileInfo)
	return values
}

// Validates all registration field values via the shared validator and returns the resulting FormErrors.
function validateFieldValues(values: RegistrationFieldValues): FormErrors
{
	const gender       = values.gender !== '' ? values.gender : null
	const documentType = values.documentType !== '' ? values.documentType : null
	const targetCompany = values.targetCompanyId !== '' ? values.targetCompanyId : null

	return validateAllFields
	(
		values.fullName,
		values.dateOfBirth,
		values.nationality,
		gender,
		values.email,
		values.mobileNumber,
		values.fullAddress,
		documentType,
		targetCompany,
		values.idDoc,
	)
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
	{ name: 'idDoc', maxCount: 1 },
])

// Persists the validated identity upload to disk and returns the document describing it, recording the written path for cleanup.
function buildDocuments(idFile: Express.Multer.File, writtenPaths: string[]): IUploadedDocument[]
{
	const idDoc        = createUploadedDocument()
	idDoc.fieldName    = 'identity_doc'
	idDoc.originalName = idFile.originalname
	idDoc.storagePath  = persistUploadedFile(idFile, writtenPaths)
	idDoc.mimeType     = idFile.mimetype
	idDoc.sizeBytes    = idFile.size
	idDoc.uploadedAt   = new Date()
	return [idDoc]
}

const router = Router()

// Validates all registration fields, checks for email conflicts, saves a pending registration, and dispatches a verification email.
router.post('/initiate-register', companyRateLimit, uploadFields, async (req: Request, res: Response) =>
{
	const files = req.files as Record<string, Express.Multer.File[]> | null
	const body  = req.body  as Record<string, unknown>

	const values = buildRegistrationFieldValues(body, files)
	const errors = validateFieldValues(values)

	if (hasErrors(errors))
	{
		return res.status(400).json
		({
			error:  'Validation failed.',
			errors: collectErrorMessages(errors),
		})
	}

	const idFile = resolveMulterFile(files, 'idDoc')

	if (idFile === null)
	{
		return res.status(400).json({ error: 'Identity document is required.' })
	}

	const normalizedEmail = values.email.trim().toLowerCase()

	const targetCompany = await Company.findById(values.targetCompanyId)

	if (targetCompany === null || targetCompany.status !== 'approved')
	{
		return res.status(400).json({ error: 'The selected company is not available for registration.' })
	}

	const existingApplication = await findApplicationByEmail(normalizedEmail)

	if (existingApplication !== null)
	{
		if (existingApplication.status === 'approved')
		{
			return res.status(409).json({ error: 'An application with this email is already approved.' })
		}
		if (existingApplication.status === 'pending')
		{
			return res.status(409).json({ error: 'An application for this email is already under review.' })
		}
	}

	const existingPending = await findActivePendingByEmail(normalizedEmail)

	if (existingPending !== null)
	{
		return res.status(409).json({ error: 'A verification email for this address was already sent. Please check your inbox, or wait for it to expire before resubmitting.' })
	}

	const writtenPaths: string[] = []

	try
	{
		const documents = buildDocuments(idFile, writtenPaths)
		const payload      = createSavePendingUserRegistrationPayload()
		payload.fullName     = values.fullName.trim()
		payload.dateOfBirth  = values.dateOfBirth.trim()
		payload.nationality  = values.nationality.trim()
		payload.gender       = values.gender
		payload.email        = normalizedEmail
		payload.mobileNumber = values.mobileNumber.trim()
		payload.fullAddress  = values.fullAddress.trim()
		payload.documentType = values.documentType
		payload.submittedBy  = normalizedEmail
		payload.targetCompanyId = values.targetCompanyId
		payload.documents    = documents

		const saved = await savePendingUserRegistration(payload)

		const emailParams     = createSendVerificationEmailParams()
		emailParams.toAddress = normalizedEmail
		emailParams.token     = saved.token

		await sendVerificationEmail(emailParams)

		return res.status(202).json
		({
			message:   'Verification email sent. Please check your inbox and confirm within 15 minutes.',
			expiresAt: saved.expiresAt,
		})
	}
	catch (err)
	{
		discardPersistedFiles(writtenPaths)
		const message = (err as Error).message !== '' ? (err as Error).message : 'Registration failed. Please try again.'
		console.error('[user_routes] initiate-register error:', err)
		return res.status(500).json({ error: message })
	}
})

// Validates the verification token and, if valid, promotes the pending registration to a confirmed application record.
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
		console.error('[user_routes] verify-email error:', err)
		return res.status(500).send(renderVerifyPage(false, 'An unexpected error occurred. Please try again.'))
	}
})

// Returns the list of approved companies (id and name only) that applicants may apply to join.
router.get('/available-companies', async (_req: Request, res: Response) =>
{
	try
	{
		const companies = await Company.find({ status: 'approved' }).select('_id name').sort({ name: 1 }).lean()
		const options   = companies.map((c) => ({ companyId: String(c._id), companyName: c.name }))
		return res.json({ companies: options })
	}
	catch (err)
	{
		console.error('[user_routes] available-companies error:', err)
		return res.status(500).json({ error: 'Failed to load companies.' })
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
	const heading = success ? '✅ Application Submitted' : '❌ Verification Failed'
	const body = success
		? 'Your email has been verified and your application has been submitted for review. You will be notified once it is approved.'
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