import { Request, Response, Router } from 'express'
import rateLimit from 'express-rate-limit'
import { body, validationResult } from 'express-validator'

import { authenticate } from '../middleware/auth_middleware'
import { loginUser, logoutUser, refreshAccessToken } from '../services/auth_service'

const router = Router()

const loginLimiter = rateLimit
({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many login attempts. Try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
})

router.post('/login',loginLimiter,
[
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
    body('role').isIn(['user', 'admin']),
],
async (request: Request, response: Response) =>
{
    const errors = validationResult(request)

    if (!errors.isEmpty())
    {
        return response.status(400).json({ errors: errors.array() })
    }

    try
    {
        const { accessToken, refreshToken, user } = await loginUser(
            request.body.email,
            request.body.password,
            request.body.role
        )

        const safeUser = 
        {
            id: user._id,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            lastLoginAt: user.lastLoginAt
        }

        return response.json
        ({
            accessToken,
            refreshToken,
            user: safeUser
        })
    }
    catch (error)
    {
        console.error(error)
        return response.status(401).json
        ({
            error: (error as Error).message || 'Invalid credentials'
        })
    }
})


router.post('/refresh', async (request: Request, response: Response) =>
{
    const token = request.body?.refreshToken || request.headers['x-refresh-token']

    if (!token)
    {
        return response.status(400).json({ error: 'Refresh token required' })
    }

    try
    {
        const { accessToken, refreshToken, user } = await refreshAccessToken(token)

        return response.json({
            accessToken,
            refreshToken,
            user,           // ← add this
            expiresIn: 900
        })
    }
    catch (error)
    {
        console.error(error)
        return response.status(401).json({ error: 'Invalid or expired refresh token' })
    }
})

router.post('/logout',authenticate, async (request: Request, response: Response) =>
{
    const token = request.body?.refreshToken || request.headers['x-refresh-token']

    if (!token)
    {
        return response.status(400).json
        ({
            error: 'Refresh token required'
        })
    }

    const reqUser = request as Request & 
    {
        user?: { sub: string }
    }

    try
    {
        await logoutUser(reqUser.user!.sub, token)

        return response.json
        ({
            message: 'Logged out successfully'
        })
    }
    catch (err)
    {
        console.error(err)
        return response.status(500).json
        ({
            error: 'Logout failed'
        })
    }
})

export default router