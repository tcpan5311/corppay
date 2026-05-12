import { Request, Response, Router } from 'express'
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
	const body  = req.body as Record<string, unknown>
	const input = extractSetPasswordBody(body)

	if (input.token === '')
	{
		return res.status(400).json({ error: 'Token is required.' })
	}

	if (input.password.length < 8)
	{
		return res.status(400).json({ error: 'Password must be at least 8 characters.' })
	}

	try
	{
		const result = await completeOnboarding(input.token, input.password)

		if (!result.success)
		{
			return res.status(400).json({ error: result.reason })
		}

		return res.status(201).json({ message: 'Account setup complete. You can now sign in.' })
	}
	catch (err)
	{
		console.error('[onboarding_routes] set-password error:', err)
		return res.status(500).json({ error: 'Account setup failed. Please try again.' })
	}
})

export default router