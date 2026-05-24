import { Request, Response, Router } from 'express'
import { validateAdminPassword } from '../../../corppay-backend/src/validation/adminSetPasswordValidation'
import { completeOnboarding, verifyOnboardingToken } from '../services/admin_onboarding_service'

// ─── Types ────────────────────────────────────────────────────────────────────

type SetPasswordBody =
{
	token:    string
	password: string
}

// ─── Factories ────────────────────────────────────────────────────────────────

// Creates a fully initialized SetPasswordBody with empty string defaults.
function createSetPasswordBody(): SetPasswordBody
{
	return { token: '', password: '' }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Extracts and normalizes the token and password fields from an unknown request body.
function extractSetPasswordBody(body: Record<string, unknown>): SetPasswordBody
{
	const result    = createSetPasswordBody()
	result.token    = typeof body['token']    === 'string' ? body['token'].trim()    : ''
	result.password = typeof body['password'] === 'string' ? body['password']        : ''
	return result
}

// ─── Router ───────────────────────────────────────────────────────────────────

const router = Router()

// Returns token validity and the associated email address for the given onboarding token.
router.get('/verify-token', async (req: Request, res: Response) =>
{
	const rawToken = req.query['token']

	if (!rawToken || typeof rawToken !== 'string' || rawToken.trim() === '')
	{
		return res.status(400).json({ valid: false, reason: 'Token is required.' })
	}

	try
	{
		const result = await verifyOnboardingToken(rawToken.trim())

		if (!result.valid)
		{
			return res.status(400).json({ valid: false, reason: result.reason })
		}

		return res.status(200).json({ valid: true, email: result.email, ssmNumber: result.ssmNumber })
	}
	catch (err)
	{
		console.error('[onboarding_routes] verify-token error:', err)
		return res.status(500).json({ valid: false, reason: 'An unexpected error occurred.' })
	}
})

// Validates the onboarding token and password, creates the admin user, and consumes the token.
router.post('/set-password', async (req: Request, res: Response) =>
{
	const body     = req.body as Record<string, unknown>
	const token    = typeof body['token']    === 'string' ? body['token'].trim()    : ''
	const password = typeof body['password'] === 'string' ? body['password']        : ''

	if (token === '')
	{
		return res.status(400).json({ error: 'Token is required.' })
	}

	const passwordError = validateAdminPassword(password)
	if (passwordError !== null)
	{
		return res.status(400).json({ error: passwordError })
	}
	// ────────────────────────────────────────────────────────────────────────

	try
	{
		const result = await completeOnboarding(token, password)

		if (!result.success)
		{
			return res.status(400).json({ error: result.reason })
		}

		return res.status(200).json({ message: 'Password set successfully.' })
	}
	catch (e: unknown)
	{
		console.error('[onboarding_routes] set-password error:', e)
		return res.status(500).json({ error: 'An unexpected error occurred.' })
	}
})

export default router