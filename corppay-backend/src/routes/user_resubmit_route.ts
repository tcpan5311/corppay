import { randomUUID } from 'crypto'
import { Request, Response, Router } from 'express'
import fs from 'fs'
import multer, { FileFilterCallback } from 'multer'
import path from 'path'
import Company, { IUploadedDocument, createUploadedDocument } from '../models/Company'
import UserApplication from '../models/UserApplication'
import {
	completeUserResubmission,
	createResubmitUserPayload,
	verifyUserResubmissionToken,
} from '../services/user_resubmission_service'
import {
	validateDateOfBirth,
	validateDocumentType,
	validateFullAddress,
	validateFullName,
	validateGender,
	validateMobileNumber,
	validateNationality,
	validateUploadedFile,
} from '../validation/registerUserValidation'

// ─── Validation ───────────────────────────────────────────────────────────────

type ResubmitValidationErrors =
{
	fullName:     string | null
	dateOfBirth:  string | null
	nationality:  string | null
	gender:       string | null
	mobileNumber: string | null
	fullAddress:  string | null
	documentType: string | null
	idDoc:        string | null
}

type UploadedFileInfo =
{
	mimetype: string
	size:     number
}

type ValidateResubmitInput =
{
	fullName:     string
	dateOfBirth:  string
	nationality:  string
	gender:       string
	mobileNumber: string
	fullAddress:  string
	documentType: string
	idFile:       UploadedFileInfo | null
}

// Creates a fully initialized ValidateResubmitInput with empty strings and a null file.
function createValidateResubmitInput(): ValidateResubmitInput
{
	return {
		fullName:     '',
		dateOfBirth:  '',
		nationality:  '',
		gender:       '',
		mobileNumber: '',
		fullAddress:  '',
		documentType: '',
		idFile:       null,
	}
}

// Validates all resubmission fields; the uploaded file is only validated when present, otherwise the existing one is kept.
function validateResubmitInput(input: ValidateResubmitInput): ResubmitValidationErrors
{
	const gender       = input.gender !== '' ? input.gender : null
	const documentType = input.documentType !== '' ? input.documentType : null

	const idDocError = input.idFile !== null
		? validateUploadedFile({ bytes: input.idFile.size, mimeType: input.idFile.mimetype }, 'Identity document')
		: null

	return {
		fullName:     validateFullName(input.fullName),
		dateOfBirth:  validateDateOfBirth(input.dateOfBirth),
		nationality:  validateNationality(input.nationality),
		gender:       validateGender(gender),
		mobileNumber: validateMobileNumber(input.mobileNumber),
		fullAddress:  validateFullAddress(input.fullAddress),
		documentType: validateDocumentType(documentType),
		idDoc:        idDocError,
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

// ─── Body Helpers ─────────────────────────────────────────────────────────────

// Extracts a string value from an unknown record by key, returning an empty string if absent or non-string.
function extractBodyString(body: Record<string, unknown>, key: string): string
{
	const val = body[key]
	return typeof val === 'string' ? val : ''
}

// Resolves the first multer file for the given field name from the files map, returning null when absent.
function resolveMulterFile(files: Record<string, Express.Multer.File[]> | null, field: string): Express.Multer.File | null
{
	if (files === null) return null
	const list = files[field]
	if (!Array.isArray(list) || list.length === 0) return null
	return list[0]
}

// Builds the validation input object from the request body and uploaded files.
function buildValidationInput(
	body:  Record<string, unknown>,
	files: Record<string, Express.Multer.File[]> | null,
): ValidateResubmitInput
{
	const idMulFile = resolveMulterFile(files, 'idDoc')
	const input        = createValidateResubmitInput()
	input.fullName     = extractBodyString(body, 'fullName')
	input.dateOfBirth  = extractBodyString(body, 'dateOfBirth')
	input.nationality  = extractBodyString(body, 'nationality')
	input.gender       = extractBodyString(body, 'gender')
	input.mobileNumber = extractBodyString(body, 'mobileNumber')
	input.fullAddress  = extractBodyString(body, 'fullAddress')
	input.documentType = extractBodyString(body, 'documentType')
	input.idFile       = idMulFile !== null ? { mimetype: idMulFile.mimetype, size: idMulFile.size } : null
	return input
}

// ─── Multer ───────────────────────────────────────────────────────────────────

const uploadDir = path.resolve(process.cwd(), 'uploads')

if (!fs.existsSync(uploadDir))
{
	fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
	destination: (
		_req: Request,
		_file: Express.Multer.File,
		cb: (error: Error | null, destination: string) => void,
	) =>
	{
		cb(null, uploadDir)
	},

	filename: (
		_req: Request,
		file: Express.Multer.File,
		cb: (error: Error | null, filename: string) => void,
	) =>
	{
		const ext  = path.extname(file.originalname)
		const safe = randomUUID()
		cb(null, `${safe}${ext}`)
	},
})

// Allows only PDF, JPEG, and PNG files through the multer upload pipeline.
function fileFilter(
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
const uploadFields = upload.fields([
	{ name: 'idDoc', maxCount: 1 },
])

// ─── Document Helpers ─────────────────────────────────────────────────────────

// Builds an IUploadedDocument from a multer file object with the given field name.
function buildDocument(file: Express.Multer.File, fieldName: string): IUploadedDocument
{
	return {
		fieldName,
		originalName: file.originalname,
		storagePath:  file.path,
		mimeType:     file.mimetype,
		sizeBytes:    file.size,
		uploadedAt:   new Date(),
	}
}

// Merges an incoming uploaded identity file with the application's existing documents, replacing the matching field.
function mergeDocuments(
	existing: IUploadedDocument[],
	idFile:   Express.Multer.File | null,
): IUploadedDocument[]
{
	const existingId = existing.find((d) => d.fieldName === 'identity_doc')

	const fallbackId      = createUploadedDocument()
	fallbackId.fieldName  = 'identity_doc'

	const idDoc: IUploadedDocument = idFile !== null
		? buildDocument(idFile, 'identity_doc')
		: (existingId !== undefined ? existingId : fallbackId)

	const others = existing.filter((d) => d.fieldName !== 'identity_doc')

	return [...others, idDoc]
}

// ─── Router ───────────────────────────────────────────────────────────────────

const router = Router()

// Verifies a resubmission token and returns the full application record for prefill, or an error if invalid.
router.get('/verify', async (req: Request, res: Response) =>
{
	const token = req.query['token']
	if (typeof token !== 'string' || token.trim() === '')
	{
		return res.status(400).json({ error: 'Missing or invalid token.' })
	}

	try
	{
		const tokenVerify = await verifyUserResubmissionToken(token.trim())
		if (!tokenVerify.valid)
		{
			return res.status(400).json({ error: tokenVerify.reason })
		}

		const application = await UserApplication.findById(tokenVerify.applicationId).lean()
		if (application === null)
		{
			return res.status(404).json({ error: 'Application record not found.' })
		}

		if (application.status !== 'awaiting_resubmit')
		{
			return res.status(409).json({ error: 'This application is no longer open for resubmission.' })
		}

		const idDocRaw = application.documents.find((d) => d.fieldName === 'identity_doc')
		const idDocOut = idDocRaw !== undefined
			? { name: idDocRaw.originalName, mimeType: idDocRaw.mimeType, bytes: idDocRaw.sizeBytes }
			: null

		const targetCompany = await Company.findById(application.targetCompanyId).select('_id name').lean()
		const targetCompanyName = targetCompany !== null ? targetCompany.name : ''

		return res.status(200).json({
			email:        tokenVerify.email,
			fullName:     application.fullName,
			dateOfBirth:  application.dateOfBirth,
			nationality:  application.nationality,
			gender:       application.gender,
			mobileNumber: application.mobileNumber,
			fullAddress:  application.fullAddress,
			documentType: application.documentType,
			targetCompanyId:   String(application.targetCompanyId),
			targetCompanyName: targetCompanyName,
			idDoc:        idDocOut,
		})
	}
	catch (err)
	{
		console.error('[user_resubmit_routes] verify error:', err)
		return res.status(500).json({ error: 'Could not verify resubmission link. Please try again.' })
	}
})

// Validates all resubmission fields, merges documents, and delegates persistence to completeUserResubmission.
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
		return res.status(400).json({
			error:  'Validation failed.',
			errors: collectErrorMessages(validationErrors),
		})
	}

	try
	{
		const tokenVerify = await verifyUserResubmissionToken(token)
		if (!tokenVerify.valid)
		{
			return res.status(400).json({ error: tokenVerify.reason })
		}

		const application = await UserApplication.findById(tokenVerify.applicationId).lean()
		if (application === null)
		{
			return res.status(404).json({ error: 'Application record not found.' })
		}

		if (application.status !== 'awaiting_resubmit')
		{
			return res.status(409).json({ error: 'This application is no longer open for resubmission.' })
		}

		const idMulFile  = resolveMulterFile(files, 'idDoc')
		const mergedDocs = mergeDocuments(application.documents, idMulFile)

		const payload         = createResubmitUserPayload()
		payload.fullName      = extractBodyString(body, 'fullName')
		payload.dateOfBirth   = extractBodyString(body, 'dateOfBirth')
		payload.nationality   = extractBodyString(body, 'nationality')
		payload.gender        = extractBodyString(body, 'gender')
		payload.mobileNumber  = extractBodyString(body, 'mobileNumber')
		payload.fullAddress   = extractBodyString(body, 'fullAddress')
		payload.documentType  = extractBodyString(body, 'documentType')
		payload.documents     = mergedDocs

		const resubmitResult = await completeUserResubmission(token, payload)
		if (!resubmitResult.success)
		{
			return res.status(400).json({ error: resubmitResult.reason })
		}

		return res.status(200).json({
			message: 'Resubmission received. Your application is under review.',
		})
	}
	catch (err)
	{
		console.error('[user_resubmit_routes] resubmit error:', err)
		return res.status(500).json({ error: 'Resubmission failed. Please try again.' })
	}
})

export default router