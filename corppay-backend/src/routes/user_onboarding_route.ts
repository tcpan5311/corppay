import { Request, Response, Router } from 'express'
import { completeUserOnboarding, verifyUserOnboardingToken } from '../services/user_onboarding_service'
import { validateAdminPassword } from '../validation/adminSetPasswordValidation'

// ─── Router ───────────────────────────────────────────────────────────────────

const router = Router()

// Returns token validity along with the associated email, role, and department for the given onboarding token.
router.get('/verify-token', async (req: Request, res: Response) =>
{
	const rawToken = req.query['token']

	if (!rawToken || typeof rawToken !== 'string' || rawToken.trim() === '')
	{
		return res.status(400).json({ valid: false, reason: 'Token is required.' })
	}

	try
	{
		const result = await verifyUserOnboardingToken(rawToken.trim())

		if (!result.valid)
		{
			return res.status(400).json({ valid: false, reason: result.reason })
		}

		return res.status(200).json({
			valid:      true,
			email:      result.email,
			role:       result.role,
			department: result.department,
		})
	}
	catch (err)
	{
		console.error('[user_onboarding_routes] verify-token error:', err)
		return res.status(500).json({ valid: false, reason: 'An unexpected error occurred.' })
	}
})

// Validates the onboarding token and password, creates the company user membership, and consumes the token.
router.post('/set-password', async (req: Request, res: Response) =>
{
	const body     = req.body as Record<string, unknown>
	const token    = typeof body['token']    === 'string' ? body['token'].trim() : ''
	const password = typeof body['password'] === 'string' ? body['password']     : ''

	if (token === '')
	{
		return res.status(400).json({ error: 'Token is required.' })
	}

	const passwordError = validateAdminPassword(password)
	if (passwordError !== null)
	{
		return res.status(400).json({ error: passwordError })
	}

	try
	{
		const result = await completeUserOnboarding(token, password)

		if (!result.success)
		{
			return res.status(400).json({ error: result.reason })
		}

		return res.status(200).json({ message: 'Password set successfully.' })
	}
	catch (e: unknown)
	{
		console.error('[user_onboarding_routes] set-password error:', e)
		return res.status(500).json({ error: 'An unexpected error occurred.' })
	}
})

export default router