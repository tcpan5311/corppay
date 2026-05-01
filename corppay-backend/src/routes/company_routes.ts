import { randomUUID } from 'crypto'
import { Request, Response, Router } from 'express'
import fs from 'fs'
import multer, { FileFilterCallback } from 'multer'
import path from 'path'

import { companyRateLimit } from '../middleware/company_middleware'
import { IUploadedDocument } from '../models/Company'
import { getCompaniesByUser, getCompanyById, registerCompany } from '../services/company_service'

const uploadDir = process.env.UPLOAD_DIR ? process.env.UPLOAD_DIR : 'uploads/'

if (!fs.existsSync(uploadDir))
{
	fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
	destination: (
		_req: Request,
		_file: Express.Multer.File,
		cb: (error: Error | null, destination: string) => void
	) =>
	{
		cb(null, uploadDir)
	},

	filename: (
		_req: Request,
		file: Express.Multer.File,
		cb: (error: Error | null, filename: string) => void
	) =>
	{
		const ext  = path.extname(file.originalname)
		const safe = randomUUID()
		cb(null, `${safe}${ext}`)
	},
})

// Rejects any uploaded file that is not a PDF, JPEG, or PNG.
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

const upload = multer({
	storage,
	fileFilter,
	limits: { fileSize: 5 * 1024 * 1024 },
})

const router = Router()

// Validates uploaded documents, builds the company payload, and persists a new company registration.
async function handleRegisterCompany(req: Request, res: Response): Promise<Response>
{
	const files = req.files as Record<string, Express.Multer.File[]> | null

	if (!files || !files.ssmDoc || !files.ssmDoc[0])
	{
		return res.status(400).json({ error: 'Certificate of Incorporation (SSM) is required.' })
	}

	if (!files.icDoc || !files.icDoc[0])
	{
		return res.status(400).json({ error: 'Director IC / Passport copy is required.' })
	}

	const ssmFile = files.ssmDoc[0]
	const icFile  = files.icDoc[0]

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
		const directorIcPassport =
			body &&
			body.director &&
			body.director.icPassport
				? body.director.icPassport
				: body['director.icPassport']

		const directorRole =
			body &&
			body.director &&
			body.director.role
				? body.director.role
				: body['director.role']

		const company = await registerCompany({
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
		const message = (err as Error).message ? (err as Error).message : 'Registration failed. Please try again.'

		if (message.includes('already'))
		{
			return res.status(409).json({ error: message })
		}

		console.error('[company_routes] registerCompany error:', err)
		return res.status(500).json({ error: message })
	}
}

// Returns all companies associated with the anonymous user account.
async function handleGetMyCompanies(_req: Request, res: Response): Promise<Response>
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
}

// Retrieves a single company by its ID and returns a 404 if not found.
async function handleGetCompanyById(req: Request<{ id: string }>, res: Response): Promise<Response>
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
}

router.post(
	'/register',
	companyRateLimit,
	upload.fields([
		{ name: 'ssmDoc', maxCount: 1 },
		{ name: 'icDoc',  maxCount: 1 },
	]),
	handleRegisterCompany
)

router.get('/mine', handleGetMyCompanies)

router.get('/:id', handleGetCompanyById)

export default router