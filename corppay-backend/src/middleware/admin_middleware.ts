import { NextFunction, Request, Response } from 'express'

type AdminTokenValidation =
{
	valid:  boolean
	reason: string
}

// Creates a fully initialized AdminTokenValidation defaulting to invalid with an empty reason.
function createAdminTokenValidation(): AdminTokenValidation
{
	return { valid: false, reason: '' }
}

// Extracts the admin token from the x-admin-token header or the t query parameter.
function extractTokenFromRequest(req: Request): string
{
	const header = req.headers['x-admin-token']
	if (typeof header === 'string' && header.trim() !== '') return header.trim()

	const query = req.query['t']
	if (typeof query === 'string' && query.trim() !== '') return query.trim()

	return ''
}

// Validates the supplied token against the ADMIN_REVIEW_TOKEN environment variable.
function checkAdminToken(token: string): AdminTokenValidation
{
	const result   = createAdminTokenValidation()
	const expected = process.env.ADMIN_REVIEW_TOKEN

	if (expected === undefined || expected.trim() === '')
	{
		result.reason = 'Admin access is not configured on this server.'
		return result
	}

	if (token === '')
	{
		result.reason = 'Admin token is required.'
		return result
	}

	if (token !== expected.trim())
	{
		result.reason = 'Invalid admin token.'
		return result
	}

	result.valid = true
	return result
}

// Returns true when the given token matches the configured ADMIN_REVIEW_TOKEN, false otherwise.
export function validateAdminTokenValue(token: string): boolean
{
	return checkAdminToken(token).valid
}

// Rejects the request with 401 when the admin token is missing or invalid, otherwise passes control to the next handler.
export function adminTokenMiddleware(req: Request, res: Response, next: NextFunction): void
{
	const token  = extractTokenFromRequest(req)
	const result = checkAdminToken(token)

	if (!result.valid)
	{
		res.status(401).json({ error: result.reason })
		return
	}

	next()
}