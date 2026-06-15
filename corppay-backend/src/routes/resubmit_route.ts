import { randomUUID } from 'crypto'
import { Request, Response, Router } from 'express'
import fs from 'fs'
import multer, { FileFilterCallback } from 'multer'
import path from 'path'
import Company, { IUploadedDocument, createUploadedDocument } from '../models/Company'
import {
	completeResubmission,
	createResubmitCompanyPayload,
	verifyResubmissionToken,
} from '../services/admin_resubmission_service'

const NRIC_REGEX      = /^\d{12}$/
const PASSPORT_REGEX  = /^[A-Z0-9]{6,12}$/
const SSM_DIGIT_REGEX = /^\d{12}$/

const ALLOWED_MIME_TYPES = 
[
	'application/pdf',
	'image/jpeg',
	'image/jpg',
	'image/png',
]

const MAX_FILE_BYTES = 5 * 1024 * 1024

type ResubmitValidationErrors =
{
	companyName:       string | null
	entityType:        string | null
	registeredAddress: string | null
	icPassport:        string | null
	directorRole:      string | null
	ownershipPct:      string | null
	ssmDoc:            string | null
	icDoc:             string | null
}

// Creates a fully initialized ResubmitValidationErrors with all fields set to null.
function createResubmitValidationErrors(): ResubmitValidationErrors
{
	return {
		companyName:       null,
		entityType:        null,
		registeredAddress: null,
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

type ValidateResubmitInput =
{
	companyName:       string
	entityType:        string
	registeredAddress: string
	icPassport:        string
	directorRole:      string
	ownershipPct:      string
	ssmFile:           UploadedFileInfo | null
	icFile:            UploadedFileInfo | null
}

// Creates a fully initialized ValidateResubmitInput with empty strings and null files.
function createValidateResubmitInput(): ValidateResubmitInput
{
	return {
		companyName:       '',
		entityType:        '',
		registeredAddress: '',
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

// Returns an error string if the entity type is not one of the accepted values, otherwise null.
function validateEntityType(value: string): string | null
{
	const valid = ['sdn_bhd', 'sole_proprietor']
	if (value.trim() === '')            return 'Please select an entity type.'
	if (!valid.includes(value.trim()))  return 'Please select an entity type.'
	return null
}

// Returns an error string if the registered address is blank or exceeds 200 characters, otherwise null.
function validateRegisteredAddress(value: string): string | null
{
	if (value.trim() === '')       return 'Registered address is required.'
	if (value.trim().length > 200) return 'Address must be 200 characters or less.'
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
	if (!/^\d+$/.test(value.trim())) return 'Enter a valid number between 0 and 100.'
	const num = parseFloat(value)
	if (isNaN(num)) return 'Enter a valid number.'
	if (num < 0)    return 'Percentage cannot be negative.'
	if (num > 100)  return 'Percentage cannot exceed 100.'
	return null
}

// Returns an error string if the uploaded file has a disallowed MIME type or exceeds the 5 MB limit, otherwise null.
function validateUploadedFile(file: UploadedFileInfo, label: string): string | null
{
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

// Validates all resubmission fields; uploaded files are only validated when present (kept when absent).
function validateResubmitInput(input: ValidateResubmitInput): ResubmitValidationErrors
{
	const ssmDocError = input.ssmFile !== null
		? validateUploadedFile(input.ssmFile, 'Certificate of Incorporation')
		: null

	const icDocError = input.icFile !== null
		? validateUploadedFile(input.icFile, 'Director IC / Passport Copy')
		: null

	return {
		companyName:       validateCompanyName(input.companyName),
		entityType:        validateEntityType(input.entityType),
		registeredAddress: validateRegisteredAddress(input.registeredAddress),
		icPassport:        validateIcPassport(input.icPassport),
		directorRole:      validateDirectorRole(input.directorRole),
		ownershipPct:      validateOwnershipPct(input.ownershipPct),
		ssmDoc:            ssmDocError,
		icDoc:             icDocError,
	}
}

// Returns true if any field in the error object is non-null, otherwise false.
function hasResubmitErrors(errors: ResubmitValidationErrors): boolean
{
	return Object.values(errors).some((v) => v !== null)
}

// Collects all non-null error entries into a plain object suitable for a 400 response body.
function collectErrorMessages(errors: ResubmitValidationErrors): Record<string, string>
{
	const result: Record<string, string> = {}
	const entries = Object.entries(errors) as [keyof ResubmitValidationErrors, string | null][]
	for (const [field, message] of entries)
	{
		if (message !== null) result[field] = message
	}
	return result
}

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

// Resolves the director IC/passport from either nested or flat form encoding.
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

// Builds a ValidateResubmitInput from the parsed request body and multer file map.
function buildValidationInput
(
	body:  Record<string, unknown>,
	files: Record<string, Express.Multer.File[]> | null,
): ValidateResubmitInput
{
	const ssmMulFile = files && files['ssmDoc'] && files['ssmDoc'][0] ? files['ssmDoc'][0] : null
	const icMulFile  = files && files['icDoc']  && files['icDoc'][0]  ? files['icDoc'][0]  : null

	const ssmFile: UploadedFileInfo | null = ssmMulFile !== null
		? { mimetype: ssmMulFile.mimetype, size: ssmMulFile.size }
		: null

	const icFile: UploadedFileInfo | null = icMulFile !== null
		? { mimetype: icMulFile.mimetype, size: icMulFile.size }
		: null

	const input             = createValidateResubmitInput()
	input.companyName       = extractBodyString(body, 'name')
	input.entityType        = extractBodyString(body, 'entityType')
	input.registeredAddress = extractBodyString(body, 'registeredAddress')
	input.icPassport        = resolveDirectorIcPassport(body)
	input.directorRole      = resolveDirectorRole(body)
	input.ownershipPct      = (() =>
	{
		const director = extractBodyDirector(body)
		const nested   = extractBodyString(director, 'ownershipPct')
		const flat     = extractBodyString(body, 'director.ownershipPct')
		return nested !== '' ? nested : flat
	})()
	input.ssmFile = ssmFile
	input.icFile  = icFile
	return input
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

// Removes the given files from disk on a best-effort basis, ignoring any that are absent or cannot be deleted.
function discardPersistedFiles(paths: string[]): void
{
	for (const target of paths)
	{
		try
		{
			if (fs.existsSync(target))
			{
				fs.unlinkSync(target)
			}
		}
		catch (err)
		{
			console.error('[resubmit_routes] failed to remove file:', target, err)
		}
	}
}

// Allows only PDF, JPEG, and PNG files through the multer upload pipeline.
function fileFilter
(
	_req: Request,
	file: Express.Multer.File,
	cb: FileFilterCallback,
): void
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

// Persists a validated in-memory upload to disk and returns the document describing it, recording the written path for cleanup.
function buildDocument(file: Express.Multer.File, fieldName: string, writtenPaths: string[]): IUploadedDocument
{
	const doc        = createUploadedDocument()
	doc.fieldName    = fieldName
	doc.originalName = file.originalname
	doc.storagePath  = persistUploadedFile(file, writtenPaths)
	doc.mimeType     = file.mimetype
	doc.sizeBytes    = file.size
	doc.uploadedAt   = new Date()
	return doc
}

// Records the storage path of a soon-to-be-replaced document when an incoming file supersedes an existing one that has a stored file.
function recordReplacedPath(incoming: Express.Multer.File | null, existing: IUploadedDocument | undefined, replacedPaths: string[]): void
{
	if (incoming !== null && existing !== undefined && existing.storagePath !== null)
	{
		replacedPaths.push(existing.storagePath)
	}
}

// Merges incoming uploaded files with the company's existing documents, replacing matching field names and recording written and superseded paths for cleanup.
function mergeDocuments
(
	existing: IUploadedDocument[],
	ssmFile:  Express.Multer.File | null,
	icFile:   Express.Multer.File | null,
	writtenPaths:  string[],
	replacedPaths: string[],
): IUploadedDocument[]
{
	const existingSsm = existing.find((d) => d.fieldName === 'ssm_cert')
	const existingIc  = existing.find((d) => d.fieldName === 'director_ic')

	recordReplacedPath(ssmFile, existingSsm, replacedPaths)
	recordReplacedPath(icFile, existingIc, replacedPaths)

	const fallbackSsm           = createUploadedDocument()
	fallbackSsm.fieldName       = 'ssm_cert'

	const fallbackIc            = createUploadedDocument()
	fallbackIc.fieldName        = 'director_ic'

	const ssmDoc: IUploadedDocument = ssmFile !== null
		? buildDocument(ssmFile, 'ssm_cert', writtenPaths)
		: existingSsm !== undefined ? existingSsm : fallbackSsm

	const icDoc: IUploadedDocument = icFile !== null
		? buildDocument(icFile, 'director_ic', writtenPaths)
		: existingIc !== undefined ? existingIc : fallbackIc

	const others = existing.filter
	(
		(d) => d.fieldName !== 'ssm_cert' && d.fieldName !== 'director_ic',
	)

	return [...others, ssmDoc, icDoc]
}

const router = Router()

// Verifies a resubmission token and returns the full company record for prefill, or an error if invalid.
router.get('/verify', async (req: Request, res: Response) =>
{
	const token = req.query['token']
	if (typeof token !== 'string' || token.trim() === '')
	{
		return res.status(400).json({ error: 'Missing or invalid token.' })
	}

	try
	{
		const tokenVerify = await verifyResubmissionToken(token.trim())
		if (!tokenVerify.valid)
		{
			return res.status(400).json({ error: tokenVerify.reason })
		}

		const company = await Company.findById(tokenVerify.companyId).lean()
		if (company === null)
		{
			return res.status(404).json({ error: 'Company record not found.' })
		}

		if (company.status !== 'awaiting_resubmit')
		{
			return res.status(409).json({ error: 'This application is no longer open for resubmission.' })
		}

		const ssmDocRaw = company.documents.find((d) => d.fieldName === 'ssm_cert')
		const icDocRaw  = company.documents.find((d) => d.fieldName === 'director_ic')

		const ssmDocOut = ssmDocRaw !== undefined
			? { name: ssmDocRaw.originalName, mimeType: ssmDocRaw.mimeType, bytes: ssmDocRaw.sizeBytes }
			: null

		const icDocOut = icDocRaw !== undefined
			? { name: icDocRaw.originalName, mimeType: icDocRaw.mimeType, bytes: icDocRaw.sizeBytes }
			: null

		return res.status(200).json
		({
			email:             tokenVerify.email,
			ssmNumber:         tokenVerify.ssmNumber,
			name:              company.name,
			entityType:        company.entityType,
			registeredAddress: company.registeredAddress,
			icPassport:        company.director.icPassport,
			directorRole:      company.director.role,
			ownershipPct:      company.director.ownershipPct,
			ssmDoc:            ssmDocOut,
			icDoc:             icDocOut,
		})
	}
	catch (err)
	{
		console.error('[resubmit_routes] verify error:', err)
		return res.status(500).json({ error: 'Could not verify resubmission link. Please try again.' })
	}
})

// Validates all resubmission fields, merges documents, and delegates persistence to completeResubmission.
router.post('/', uploadFields, async (req: Request, res: Response) =>
{
	const files = req.files as Record<string, Express.Multer.File[]> | null
	const body  = req.body  as Record<string, unknown>

	const token = extractBodyString(body, 'token')
	if (token === '')
	{
		return res.status(400).json({ error: 'Missing resubmission token.' })
	}

	const validationInput  = buildValidationInput(body, files)
	const validationErrors = validateResubmitInput(validationInput)

	if (hasResubmitErrors(validationErrors))
	{
		return res.status(400).json
		({
			error:  'Validation failed.',
			errors: collectErrorMessages(validationErrors),
		})
	}

	const writtenPaths:  string[] = []
	const replacedPaths: string[] = []

	try
	{
		const tokenVerify = await verifyResubmissionToken(token)
		if (!tokenVerify.valid)
		{
			return res.status(400).json({ error: tokenVerify.reason })
		}

		const company = await Company.findById(tokenVerify.companyId).lean()
		if (company === null)
		{
			return res.status(404).json({ error: 'Company record not found.' })
		}

		if (company.status !== 'awaiting_resubmit')
		{
			return res.status(409).json({ error: 'This application is no longer open for resubmission.' })
		}

		const ssmMulFile = files && files['ssmDoc'] && files['ssmDoc'][0] ? files['ssmDoc'][0] : null
		const icMulFile  = files && files['icDoc']  && files['icDoc'][0]  ? files['icDoc'][0]  : null
		const mergedDocs = mergeDocuments(company.documents, ssmMulFile, icMulFile, writtenPaths, replacedPaths)

		const payload             = createResubmitCompanyPayload()
		payload.name              = extractBodyString(body, 'name')
		payload.entityType        = extractBodyString(body, 'entityType')
		payload.registeredAddress = extractBodyString(body, 'registeredAddress')
		payload.documents         = mergedDocs

		payload.director.icPassport   = resolveDirectorIcPassport(body)
		payload.director.role         = resolveDirectorRole(body) as 'director' | 'owner'
		payload.director.ownershipPct = resolveOwnershipPct(body)

		const resubmitResult = await completeResubmission(token, payload)
		if (!resubmitResult.success)
		{
			discardPersistedFiles(writtenPaths)
			return res.status(400).json({ error: resubmitResult.reason })
		}

		discardPersistedFiles(replacedPaths)
		return res.status(200).json({
			message: 'Resubmission received. Your application is under review.',
		})
	}
	catch (err)
	{
		discardPersistedFiles(writtenPaths)
		console.error('[resubmit_routes] resubmit error:', err)
		return res.status(500).json({ error: 'Resubmission failed. Please try again.' })
	}
})

export default router