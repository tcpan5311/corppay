import { Request, Response, Router } from 'express'
import fs from 'fs'
import path from 'path'
import { adminTokenMiddleware, validateAdminTokenValue } from '../middleware/admin_middleware'

import Company from '../models/Company'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Returns true when the filename contains only safe alphanumeric and extension characters.
function isSafeFilename(filename: string): boolean
{
	return /^[a-zA-Z0-9_\-.]+$/.test(filename)
}

// Resolves the upload directory from the environment variable, falling back to the default path.
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

// ─── Router ───────────────────────────────────────────────────────────────────

const router = Router()

// Validates the submitted admin token against the environment secret and responds with the result.
router.post('/validate-token', (req: Request, res: Response) =>
{
	const body  = req.body as Record<string, unknown>
	const token = extractBodyString(body, 'token')
	const valid = validateAdminTokenValue(token)

	if (!valid)
	{
		return res.status(401).json({ valid: false, error: 'Invalid token.' })
	}

	return res.status(200).json({ valid: true })
})

// Returns all company registration records sorted by newest submission first.
router.get('/companies', adminTokenMiddleware, async (_req: Request, res: Response) =>
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

// Streams an uploaded document file to the client after token and filename validation.
router.get('/file/:filename', adminTokenMiddleware, (req: Request<{ filename: string }>, res: Response) =>
{
	const filename  = req.params.filename
	const uploadDir = resolveUploadDir()

	if (!isSafeFilename(filename))
	{
		return res.status(400).json({ error: 'Invalid filename.'})
	}

	const filePath = path.resolve(path.join(uploadDir, filename))

	if (!fs.existsSync(filePath))
	{
		return res.status(404).json({ error: 'File not found.', message: uploadDir })
	}

	return res.sendFile(filePath)
})

export default router