import jwt from 'jsonwebtoken'

type AdminSessionClaims =
{
	role: string
}

type SessionVerificationResult =
{
	valid:  boolean
	reason: string
}

// Creates a fully initialized AdminSessionClaims with the admin role.
function createAdminSessionClaims(): AdminSessionClaims
{
	return { role: 'admin' }
}

// Creates a fully initialized SessionVerificationResult defaulting to invalid with an empty reason.
function createSessionVerificationResult(): SessionVerificationResult
{
	return { valid: false, reason: '' }
}

// Reads the dedicated admin-session JWT signing key (distinct from the /setup key).
function resolveJwtSecret(): string
{
	const secret = process.env.ADMIN_SESSION_SECRET
	return typeof secret === 'string' ? secret.trim() : ''
}

// Signs and returns a 2-hour admin session JWT using the ADMIN_REVIEW_TOKEN as the signing key.
export function issueAdminSessionToken(): string
{
	const secret = resolveJwtSecret()
	if (secret === '') throw new Error('Admin session secret is not configured.')
	const claims = createAdminSessionClaims()
	return jwt.sign(claims, secret, { expiresIn: '2h' })
}

// Verifies the given JWT against the ADMIN_REVIEW_TOKEN signing key and returns the result.
export function verifyAdminSessionToken(token: string): SessionVerificationResult
{
	const result = createSessionVerificationResult()
	const secret = resolveJwtSecret()

	if (secret === '')
	{
		result.reason = 'Admin session secret is not configured.'
		return result
	}

	if (token === '')
	{
		result.reason = 'Session token is required.'
		return result
	}

	try
	{
		jwt.verify(token, secret)
		result.valid = true
		return result
	}
	catch (e: unknown)
	{
		if (e !== null && typeof e === 'object' && 'name' in e)
		{
			const name = (e as Record<string, unknown>)['name']
			if (name === 'TokenExpiredError')
			{
				result.reason = 'Session expired. Please re-authenticate.'
				return result
			}
		}
		result.reason = 'Invalid session token.'
		return result
	}
}