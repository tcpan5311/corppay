import crypto from 'crypto'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import User, { IUser } from '../models/User'
dotenv.config()

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET!
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET! 

const MAX_ATTEMPTS  = 5
const LOCK_DURATION  = 15 * 60 * 1000 // 15 minutes

export async function loginUser(email: string, password: string, role: 'user' | 'admin')
{
    const user = await User.findOne({ email }).select('+passwordHash +refreshTokens +loginAttempts +lockedUntil')

    const genericError = new Error('Invalid credentials')

    if (!user || !user.isActive || user.role !== role)
        throw genericError

    if (user.lockedUntil && user.lockedUntil > new Date())
    {
        throw new Error('Account temporarily locked. Try again later.')
    }

    const valid = await user.comparePassword(password)

    if (!valid)
    {
        user.loginAttempts += 1

        if (user.loginAttempts >= MAX_ATTEMPTS)
        {
            user.lockedUntil = new Date(Date.now() + LOCK_DURATION)
        }

        await user.save()
        throw genericError
    }

    user.loginAttempts = 0
    user.lockedUntil   = null
    user.lastLoginAt   = new Date()

    const accessToken  = issueAccessToken(user)
    const refreshToken = issueRefreshToken()

    if (!user.refreshTokens)
    {
        user.refreshTokens = []
    }

    const tokenHash = hashToken(refreshToken)
    user.refreshTokens.push(tokenHash)

    if (user.refreshTokens.length > 5)
    {
        user.refreshTokens.shift()
    }

    await user.save()

    return {
        accessToken,
        refreshToken,
        user
    }
}


export async function refreshAccessToken(rawRefreshToken: string)
{
    const tokenHash = hashToken(rawRefreshToken)
    const user = await User.findOne({ refreshTokens: tokenHash }).select('+refreshTokens')

    if (!user) throw new Error('Refresh token reuse detected or invalid token')

    user.refreshTokens = user.refreshTokens.filter(t => t !== tokenHash)

    const newRefreshToken = issueRefreshToken()
    user.refreshTokens.push(hashToken(newRefreshToken))

    await user.save()

    // Build the safe user object here
    const safeUser = {
        id: user._id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt
    }

    return {
        accessToken: issueAccessToken(user),
        refreshToken: newRefreshToken,
        user: safeUser   
    }
}

export async function logoutUser(userId: string, rawRefreshToken: string)
{
    const tokenHash = hashToken(rawRefreshToken)
    await User.findByIdAndUpdate(userId,{$pull: { refreshTokens: tokenHash }})
}


function issueAccessToken(user: IUser)
{
    return jwt.sign
    (
        {
            sub: user._id,
            role: user.role
        },
        ACCESS_SECRET,
        { expiresIn: '15m' }
    )
}

function issueRefreshToken()
{
    return crypto.randomBytes(64).toString('hex')
}


function hashToken(token: string)
{
    return crypto.createHash('sha256').update(token).digest('hex')
}