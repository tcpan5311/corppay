import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

type AuthenticatedUser =
{
	role:                string
	[key: string]: unknown
}

declare global
{
	namespace Express
	{
		interface Request
		{
			user: AuthenticatedUser | null
		}
	}
}

// Resolves the JWT access secret from the environment, returning an empty string if absent.
function resolveJwtSecret(): string
{
	return process.env.JWT_ACCESS_SECRET !== undefined ? process.env.JWT_ACCESS_SECRET : ''
}

// Narrows a raw decoded JWT value to an AuthenticatedUser, returning null if the shape is invalid.
function toAuthenticatedUser(decoded: string | jwt.JwtPayload): AuthenticatedUser | null
{
	if (typeof decoded === 'string')            return null
	if (typeof decoded['role'] !== 'string')    return null
	return decoded as AuthenticatedUser
}

// Validates the Bearer token and attaches the decoded user payload to the request, rejecting unauthorized calls.
export function authenticate(request: Request, response: Response, next: NextFunction): void
{
	const header = request.headers.authorization

	if (!header || !header.startsWith('Bearer '))
	{
		response.status(401).json({ error: 'Unauthorized' })
		return
	}

	try
	{
		const decoded = jwt.verify(header.slice(7), resolveJwtSecret())
		const user    = toAuthenticatedUser(decoded)

		if (user === null)
		{
			response.status(401).json({ error: 'Token expired or invalid' })
			return
		}

		request.user = user
		next()
	}
	catch
	{
		response.status(401).json({ error: 'Token expired or invalid' })
	}
}

// Checks that the authenticated user holds one of the permitted roles, rejecting forbidden access.
export function requireRole(...roles: string[])
{
	return (request: Request, result: Response, next: NextFunction): void =>
	{
		const user = request.user

		if (user === null || !roles.includes(user.role))
		{
			result.status(403).json({ error: 'Forbidden' })
			return
		}

		next()
	}
}