import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { verifyAdminSessionToken } from '../services/root_session_service'

type AdminTokenValidation =
{
	valid:  boolean
	reason: string
}

type AdminSessionPayload =
{
	role: string
}

// Creates a fully initialized AdminTokenValidation defaulting to invalid with an empty reason.
function createAdminTokenValidation(): AdminTokenValidation
{
	return { valid: false, reason: '' }
}

// Creates a fully initialized AdminSessionPayload with an empty role string.
function createAdminSessionPayload(): AdminSessionPayload
{
	return { role: '' }
}

// Extracts the admin session token from the x-admin-token request header.
function extractTokenFromRequest(req: Request): string
{
	const header = req.headers['x-admin-token']
	if (typeof header === 'string' && header.trim() !== '') return header.trim()
	return ''
}

// Decodes and returns the role claim from a JWT without re-verifying the signature.
function decodeAdminPayload(token: string): AdminSessionPayload
{
	const payload = createAdminSessionPayload()
	const decoded = jwt.decode(token)

	if (decoded === null || typeof decoded !== 'object') return payload

	const record = decoded as Record<string, unknown>
	const role   = record['role']

	if (typeof role === 'string') payload.role = role
	return payload
}

// Returns true when the given key matches the ADMIN_REVIEW_TOKEN environment variable for setup-only access.
export function validateAdminSetupKey(key: string): boolean
{
	const expected = process.env.ADMIN_REVIEW_TOKEN
	if (expected === undefined || expected.trim() === '') return false
	if (key === '') return false
	return key === expected.trim()
}

// Rejects the request with 401 when the session JWT is missing or invalid, otherwise passes control to the next handler.
export function adminTokenMiddleware(req: Request, res: Response, next: NextFunction): void
{
	const token  = extractTokenFromRequest(req)
	const result = verifyAdminSessionToken(token)

	if (!result.valid)
	{
		res.status(401).json({ error: result.reason })
		return
	}

	next()
}

// Rejects the request when the session JWT is missing, invalid, or does not carry the admin role claim.
export function requireAdminRole(req: Request, res: Response, next: NextFunction): void
{
	const token      = extractTokenFromRequest(req)
	const authResult = verifyAdminSessionToken(token)

	if (!authResult.valid)
	{
		res.status(401).json({ error: authResult.reason })
		return
	}

	const payload = decodeAdminPayload(token)

	if (payload.role !== 'admin')
	{
		res.status(403).json({ error: 'Insufficient permissions. Admin role required.' })
		return
	}

	next()
}