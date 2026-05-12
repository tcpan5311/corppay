import { randomUUID } from 'crypto'
import { Request, Response, Router } from 'express'
import fs from 'fs'
import multer, { FileFilterCallback } from 'multer'
import path from 'path'

import { companyRateLimit } from '../middleware/company_middleware'
import { EntityType, IUploadedDocument } from '../models/Company'
import { createSendVerificationEmailParams, sendVerificationEmail } from '../services/admin_confirm_email_service'
import { createSavePendingRegistrationPayload, findActivePendingBySsm, savePendingRegistration, verifyEmailToken } from '../services/admin_pending_registration_service'
import { findCompanyBySsm, getCompaniesByUser, getCompanyById, registerCompany } from '../services/company_service'

// ─── Body Extraction ──────────────────────────────────────────────────────────

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

// ─── Validation ───────────────────────────────────────────────────────────────

const NRIC_REGEX      = /^\d{12}$/
const PASSPORT_REGEX  = /^[A-Z0-9]{6,12}$/
const EMAIL_REGEX     = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SSM_DIGIT_REGEX = /^\d{12}$/

const ALLOWED_MIME_TYPES = [
	'application/pdf',
	'image/jpeg',
	'image/jpg',
	'image/png',
]

const MAX_FILE_BYTES = 5 * 1024 * 1024

type RegistrationValidationErrors =
{
	companyName:       string | null
	ssmNumber:         string | null
	entityType:        string | null
	registeredAddress: string | null
	registeredEmail:   string | null
	icPassport:        string | null
	directorRole:      string | null
	ownershipPct:      string | null
	ssmDoc:            string | null
	icDoc:             string | null
}

// Creates a fully initialized RegistrationValidationErrors with all fields set to null.
function createRegistrationValidationErrors(): RegistrationValidationErrors
{
	return {
		companyName:       null,
		ssmNumber:         null,
		entityType:        null,
		registeredAddress: null,
		registeredEmail:   null,
		icPassport:        null,
		directorRole:      null,
		ownershipPct:      null,
		ssmDoc:            null,
		icDoc:             null,
	}
}

type UploadedFileInfo =
{
	mimetype: string
	size:     number
}

type ValidateRegistrationInput =
{
	companyName:       string
	ssmNumber:         string
	entityType:        string
	registeredAddress: string
	registeredEmail:   string
	icPassport:        string
	directorRole:      string
	ownershipPct:      string
	ssmFile:           UploadedFileInfo | null
	icFile:            UploadedFileInfo | null
}

// Creates a fully initialized ValidateRegistrationInput with empty strings and null files.
function createValidateRegistrationInput(): ValidateRegistrationInput
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
		ssmFile:           null,
		icFile:            null,
	}
}

// Returns an error string if the company name is blank or exceeds 100 characters, otherwise null.
function validateCompanyName(value: string): string | null
{
	if (value.trim() === '')       return 'Company name is required.'
	if (value.trim().length > 100) return 'Company name must be 100 characters or less.'
	return null
}

// Returns an error string if the SSM number is not exactly 12 digits or has an invalid year prefix, otherwise null.
function validateSsmNumber(value: string): string | null
{
	const trimmed = value.trim()
	if (trimmed === '')                 return 'Registration number is required.'
	if (!SSM_DIGIT_REGEX.test(trimmed)) return 'Must be exactly 12 digits (e.g. 202301234567).'

	const year        = parseInt(trimmed.substring(0, 4), 10)
	const currentYear = new Date().getFullYear()

	if (year < 1900 || year > currentYear)
	{
		return `Year prefix must be between 1900 and ${currentYear}.`
	}

	return null
}

// Returns an error string if the entity type is not one of the accepted values, otherwise null.
function validateEntityType(value: string): string | null
{
	const valid = ['sdn_bhd', 'sole_proprietor']
	if (value.trim() === '')       return 'Please select an entity type.'
	if (!valid.includes(value.trim())) return 'Please select an entity type.'
	return null
}

// Returns an error string if the registered address is blank or exceeds 200 characters, otherwise null.
function validateRegisteredAddress(value: string): string | null
{
	if (value.trim() === '')       return 'Registered address is required.'
	if (value.trim().length > 200) return 'Address must be 200 characters or less.'
	return null
}

// Returns an error string if the email address is blank or does not match the expected format, otherwise null.
function validateRegisteredEmail(value: string): string | null
{
	if (value.trim() === '')             return 'Email address is required.'
	if (!EMAIL_REGEX.test(value.trim())) return 'Please enter a valid email address.'
	return null
}

// Normalizes an IC or passport string to uppercase with all whitespace removed.
function normalizeIcPassport(value: string): string
{
	return value.toUpperCase().replace(/\s/g, '')
}

// Returns an error string if the IC or passport number does not match a valid NRIC or passport format, otherwise null.
function validateIcPassport(value: string): string | null
{
	if (value.trim() === '') return 'IC / Passport number is required.'

	const normalized = normalizeIcPassport(value)

	if (NRIC_REGEX.test(normalized) || PASSPORT_REGEX.test(normalized)) return null

	return 'Enter a valid 12-digit NRIC or 6–12 character passport number (A–Z, 0–9).'
}

// Returns an error string if the director role is not one of the accepted values, otherwise null.
function validateDirectorRole(value: string): string | null
{
	const valid = ['director', 'owner']
	if (value.trim() === '')           return 'Please select a role.'
	if (!valid.includes(value.trim())) return 'Please select a role.'
	return null
}

// Returns an error string if the ownership percentage is present but not a valid integer between 0 and 100, otherwise null.
function validateOwnershipPct(value: string): string | null
{
	if (value.trim() === '') return 'Ownership percentage is required.'

	if (!/^\d+$/.test(value.trim()))
	{
		return 'Enter a valid number between 0 and 100.'
	}

	const num = parseFloat(value)
	if (isNaN(num)) return 'Enter a valid number.'
	if (num < 0)    return 'Percentage cannot be negative.'
	if (num > 100)  return 'Percentage cannot exceed 100.'
	return null
}

// Returns an error string if the uploaded file is absent, has a disallowed MIME type, or exceeds the 5 MB limit, otherwise null.
function validateUploadedFile(file: UploadedFileInfo | null, label: string): string | null
{
	if (file === null)
	{
		return `${label} is required.`
	}
	if (!ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase()))
	{
		return 'Only PDF, JPG, or PNG files are accepted.'
	}
	if (file.size > MAX_FILE_BYTES)
	{
		return 'File must be 5 MB or less.'
	}
	return null
}

// Validates all registration fields and file uploads, returning a fully populated error object.
function validateRegistrationInput(input: ValidateRegistrationInput): RegistrationValidationErrors
{
	return {
		companyName:       validateCompanyName(input.companyName),
		ssmNumber:         validateSsmNumber(input.ssmNumber),
		entityType:        validateEntityType(input.entityType),
		registeredAddress: validateRegisteredAddress(input.registeredAddress),
		registeredEmail:   validateRegisteredEmail(input.registeredEmail),
		icPassport:        validateIcPassport(input.icPassport),
		directorRole:      validateDirectorRole(input.directorRole),
		ownershipPct:      validateOwnershipPct(input.ownershipPct),
		ssmDoc:            validateUploadedFile(input.ssmFile, 'Certificate of Incorporation'),
		icDoc:             validateUploadedFile(input.icFile, 'Director IC / Passport Copy'),
	}
}

// Returns true if any field in the error object is non-null, otherwise false.
function hasRegistrationErrors(errors: RegistrationValidationErrors): boolean
{
	return Object.values(errors).some((v) => v !== null)
}

// Collects all non-null error entries into a plain object suitable for inclusion in a 400 response body.
function collectErrorMessages(errors: RegistrationValidationErrors): Record<string, string>
{
	const result: Record<string, string>                                              = {}
	const entries = Object.entries(errors) as [keyof RegistrationValidationErrors, string | null][]

	for (const [field, message] of entries)
	{
		if (message !== null)
		{
			result[field] = message
		}
	}

	return result
}

// Builds a ValidateRegistrationInput from a parsed Express request body and multer file map.
function buildValidationInput(
	body:  Record<string, unknown>,
	files: Record<string, Express.Multer.File[]> | null,
): ValidateRegistrationInput
{
	const director        = extractBodyDirector(body)
	const icPassportNested = extractBodyString(director, 'icPassport')
	const icPassportFlat   = extractBodyString(body, 'director.icPassport')
	const icPassportRaw    = icPassportNested !== '' ? icPassportNested : icPassportFlat

	const directorRoleNested = extractBodyString(director, 'role')
	const directorRoleFlat   = extractBodyString(body, 'director.role')
	const directorRoleRaw    = directorRoleNested !== '' ? directorRoleNested : directorRoleFlat

	const ownershipNested = extractBodyString(director, 'ownershipPct')
	const ownershipFlat   = extractBodyString(body, 'director.ownershipPct')
	const ownershipPctRaw = ownershipNested !== '' ? ownershipNested : ownershipFlat

	const ssmMulFile = files && files['ssmDoc'] && files['ssmDoc'][0] ? files['ssmDoc'][0] : null
	const icMulFile  = files && files['icDoc']  && files['icDoc'][0]  ? files['icDoc'][0]  : null

	const ssmFile: UploadedFileInfo | null = ssmMulFile !== null
		? { mimetype: ssmMulFile.mimetype, size: ssmMulFile.size }
		: null

	const icFile: UploadedFileInfo | null = icMulFile !== null
		? { mimetype: icMulFile.mimetype, size: icMulFile.size }
		: null

	const input             = createValidateRegistrationInput()
	input.companyName       = extractBodyString(body, 'name')
	input.ssmNumber         = extractBodyString(body, 'ssmNumber')
	input.entityType        = extractBodyString(body, 'entityType')
	input.registeredAddress = extractBodyString(body, 'registeredAddress')
	input.registeredEmail   = extractBodyString(body, 'submittedBy')
	input.icPassport        = icPassportRaw
	input.directorRole      = directorRoleRaw
	input.ownershipPct      = ownershipPctRaw
	input.ssmFile           = ssmFile
	input.icFile            = icFile
	return input
}

// ─── Multer ───────────────────────────────────────────────────────────────────

const uploadDir = path.resolve(process.cwd(), 'uploads')

if (!fs.existsSync(uploadDir))
{
	fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
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
const uploadFields = upload.fields([
	{ name: 'ssmDoc', maxCount: 1 },
	{ name: 'icDoc',  maxCount: 1 },
])

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Routes ───────────────────────────────────────────────────────────────────

const router = Router()

// Validates all registration fields and uploaded documents, then persists the company record directly.
router.post('/register', companyRateLimit, uploadFields, async (req: Request, res: Response) =>
{
	const files = req.files as Record<string, Express.Multer.File[]> | null
	const body  = req.body  as Record<string, unknown>

	const validationInput  = buildValidationInput(body, files)
	const validationErrors = validateRegistrationInput(validationInput)

	if (hasRegistrationErrors(validationErrors))
	{
		return res.status(400).json({
			error:  'Validation failed.',
			errors: collectErrorMessages(validationErrors),
		})
	}

	const resolved = resolveUploadedFiles(files)

	const ssmFile    = resolved.ssmFile as Express.Multer.File
	const icFile     = resolved.icFile  as Express.Multer.File
	const documents  = buildDocuments(ssmFile, icFile)
	const ownershipPct       = resolveOwnershipPct(body)
	const directorIcPassport = resolveDirectorIcPassport(body)
	const directorRole       = resolveDirectorRole(body)
	const submittedByRaw     = extractBodyString(body, 'submittedBy')
	const submittedBy        = submittedByRaw !== '' ? submittedByRaw : 'anonymous'

	try
	{
		const company = await registerCompany({
			name:              extractBodyString(body, 'name'),
			ssmNumber:         extractBodyString(body, 'ssmNumber'),
			entityType:        extractBodyString(body, 'entityType') as EntityType,
			registeredAddress: extractBodyString(body, 'registeredAddress'),
			director: {
				icPassport:   directorIcPassport,
				role:         directorRole as 'director' | 'owner',
				ownershipPct,
			},
			documents,
			submittedBy,
		})

		return res.status(201).json({
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
		const message = (err as Error).message !== '' ? (err as Error).message : 'Registration failed. Please try again.'

		if (message.includes('already'))
		{
			return res.status(409).json({ error: message })
		}

		console.error('[company_routes] registerCompany error:', err)
		return res.status(500).json({ error: message })
	}
})

// Validates all registration fields, checks for SSM conflicts, saves a pending registration, and dispatches a verification email.
router.post('/initiate-register', companyRateLimit, uploadFields, async (req: Request, res: Response) =>
{
	const files = req.files as Record<string, Express.Multer.File[]> | null
	const body  = req.body  as Record<string, unknown>

	const validationInput  = buildValidationInput(body, files)
	const validationErrors = validateRegistrationInput(validationInput)

	if (hasRegistrationErrors(validationErrors))
	{
		return res.status(400).json({
			error:  'Validation failed.',
			errors: collectErrorMessages(validationErrors),
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

	const ssmFile    = resolved.ssmFile as Express.Multer.File
	const icFile     = resolved.icFile  as Express.Multer.File
	const documents  = buildDocuments(ssmFile, icFile)
	const ownershipPct = resolveOwnershipPct(body)
	const icPassport   = resolveDirectorIcPassport(body)
	const directorRole = resolveDirectorRole(body)

	try
	{
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