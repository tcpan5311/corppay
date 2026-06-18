import { Request, Response, Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../middleware/auth_middleware'
import { loginUser, logoutUser, lookupAdminCompanies, lookupUserCompanies, refreshAccessToken } from '../services/auth_service'
import { validateLoginFields } from '../validation/loginValidation'

const router = Router()

const loginLimiter = rateLimit
({
	windowMs:               15 * 60 * 1000,
	max:                    10,
	skipSuccessfulRequests: true,
	message:                { error: 'Too many login attempts. Try again in 15 minutes.' },
	standardHeaders:        true,
	legacyHeaders:          false,
})

// Resolves a string or string-array header value to a plain string, returning empty on absence.
function resolveStringHeader(value: string | string[] | undefined): string
{
	if (value === undefined)         return ''
	if (Array.isArray(value))        return value.length > 0 ? value[0] : ''
	return value
}

// Extracts the refresh token from the request body or x-refresh-token header.
function extractRefreshToken(body: Record<string, unknown>, headers: Record<string, unknown>): string
{
	const fromBody   = typeof body['refreshToken']              === 'string' ? body['refreshToken'] : ''
	const headerRaw  = headers['x-refresh-token']
	const fromHeader = typeof headerRaw === 'string' ? headerRaw : ''
	return fromBody !== '' ? fromBody : fromHeader
}

// Finds all companies an email holds an admin membership in and returns them for the company picker.
router.post('/lookup', loginLimiter, async (request: Request, response: Response) =>
{
	const rawBody = request.body as Record<string, unknown>
	const email   = typeof rawBody['email'] === 'string' ? rawBody['email'].trim().toLowerCase() : ''

	if (email === '')
	{
		return response.status(400).json({ error: 'Email is required.' })
	}

	try
	{
		const result = await lookupAdminCompanies(email)
		return response.json({ found: result.found, companies: result.companies })
	}
	catch (error)
	{
		console.error('[auth_route] lookup error:', error)
		return response.status(500).json({ error: 'Lookup failed.' })
	}
})

// Finds all companies an email holds a company-user membership in and returns them for the company picker.
router.post('/lookup-user', loginLimiter, async (request: Request, response: Response) =>
{
	const rawBody = request.body as Record<string, unknown>
	const email   = typeof rawBody['email'] === 'string' ? rawBody['email'].trim().toLowerCase() : ''

	if (email === '')
	{
		return response.status(400).json({ error: 'Email is required.' })
	}

	try
	{
		const result = await lookupUserCompanies(email)
		return response.json({ found: result.found, companies: result.companies })
	}
	catch (error)
	{
		console.error('[auth_route] lookup-user error:', error)
		return response.status(500).json({ error: 'Lookup failed.' })
	}
})

// Validates credentials and role, issues tokens, and returns the safe user payload.
router.post('/login', loginLimiter, async (request: Request, response: Response) =>
{
	const rawBody  = request.body  as Record<string, unknown>
	const email     = typeof rawBody['email']     === 'string' ? rawBody['email']     : ''
	const password  = typeof rawBody['password']  === 'string' ? rawBody['password']  : ''
	const roleRaw   = typeof rawBody['role']      === 'string' ? rawBody['role']      : ''
	const companyId = typeof rawBody['companyId'] === 'string' ? rawBody['companyId'] : ''

	const validationError = validateLoginFields(email, password, roleRaw)
	if (validationError !== null)
	{
		return response.status(400).json({ error: validationError })
	}

	if (roleRaw !== 'user' && roleRaw !== 'admin')
	{
		return response.status(400).json({ error: 'Invalid role.' })
	}

	try
	{
		const result = await loginUser(email, password, roleRaw, companyId)

		return response.json
		({
			accessToken:  result.accessToken,
			refreshToken: result.refreshToken,
			user:         result.user,
		})
	}
	catch (error)
	{
		console.error('[auth_route] login error:', error)
		return response.status(401).json
		({
			error: error instanceof Error ? error.message : 'Invalid credentials',
		})
	}
})

// Rotates the refresh token and returns a new access token and user payload.
router.post('/refresh',
	async (request: Request, response: Response) =>
	{
		const rawBody = request.body    as Record<string, unknown>
		const headers = request.headers as Record<string, unknown>
		const token   = extractRefreshToken(rawBody, headers)

		if (token === '')
		{
			return response.status(400).json({ error: 'Refresh token required' })
		}

		try
		{
			const result = await refreshAccessToken(token)

			return response.json
			({
				accessToken:  result.accessToken,
				refreshToken: result.refreshToken,
				user:         result.user,
				expiresIn:    900,
			})
		}
		catch (error)
		{
			console.error('[auth_route] refresh error:', error)
			return response.status(401).json({ error: 'Invalid or expired refresh token' })
		}
	},
)

// Invalidates the user's refresh token and logs them out.
router.post('/logout', authenticate, async (request: Request, response: Response) =>
{
	const rawBody = request.body    as Record<string, unknown>
	const headers = request.headers as Record<string, unknown>
	const token   = extractRefreshToken(rawBody, headers)

	if (token === '')
	{
		return response.status(400).json({ error: 'Refresh token required' })
	}

	const reqUser = request.user
	if (reqUser === null)
	{
		return response.status(401).json({ error: 'Unauthorized' })
	}

	try
	{
		const sub = typeof reqUser.sub === 'string' ? reqUser.sub : ''
		if (sub === '')
		{
			return response.status(401).json({ error: 'Unauthorized' })
		}
		await logoutUser(sub, token)
		return response.json({ message: 'Logged out successfully' })
	}
	catch (err)
	{
		console.error('[auth_route] logout error:', err)
		return response.status(500).json({ error: 'Logout failed' })
	}
})

export default router