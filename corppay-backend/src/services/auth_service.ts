import crypto from 'crypto'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import AdminUser, { IAdminUser } from '../models/AdminUser'
import Company from '../models/Company'
import User, { IUser } from '../models/User'

dotenv.config()

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET  as string
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string

const MAX_ATTEMPTS  = 5
const LOCK_DURATION = 15 * 60 * 1000

// ─── Types ────────────────────────────────────────────────────────────────────

export type SafeLoginUser =
{
	id:          string
	email:       string
	role:        string
	isActive:    boolean
	lastLoginAt: Date
}

export type LoginResult =
{
	accessToken:  string
	refreshToken: string
	user:         SafeLoginUser
}

type TokenClaims =
{
	sub:  string
	role: string
}

// ─── Factories ────────────────────────────────────────────────────────────────

// Creates a fully initialized SafeLoginUser with empty/zero defaults.
function createSafeLoginUser(): SafeLoginUser
{
	return {
		id:          '',
		email:       '',
		role:        '',
		isActive:    false,
		lastLoginAt: new Date(0),
	}
}

// Creates a fully initialized LoginResult with empty token strings and a zero safe user.
function createLoginResult(): LoginResult
{
	return {
		accessToken:  '',
		refreshToken: '',
		user:         createSafeLoginUser(),
	}
}

export type AdminCompanyOption =
{
	companyId:   string
	companyName: string
}

export type LookupAdminCompaniesResult =
{
	found:     boolean
	companies: AdminCompanyOption[]
}

// Creates a fully initialized AdminCompanyOption with empty string defaults.
function createAdminCompanyOption(): AdminCompanyOption
{
	return { companyId: '', companyName: '' }
}

// Creates a fully initialized LookupAdminCompaniesResult defaulting to not found with an empty list.
function createLookupAdminCompaniesResult(): LookupAdminCompaniesResult
{
	return { found: false, companies: [] }
}

// Returns all companies the given email holds an admin membership in.
export async function lookupAdminCompanies(email: string): Promise<LookupAdminCompaniesResult>
{
	const result    = createLookupAdminCompaniesResult()
	const adminList = await AdminUser.find({ email: email.toLowerCase().trim() }).select('companyId').lean()

	if (adminList.length === 0) return result

	const companyIds     = adminList.map((a) => a.companyId)
	const companyList    = await Company.find({ _id: { $in: companyIds } }).select('_id name').lean()
	const nameMap        = new Map<string, string>()

	for (const c of companyList)
	{
		nameMap.set(String(c._id), c.name)
	}

	result.found     = true
	result.companies = adminList.map((admin) =>
	{
		const opt       = createAdminCompanyOption()
		const idStr     = String(admin.companyId)
		opt.companyId   = idStr
		opt.companyName = nameMap.has(idStr) ? nameMap.get(idStr) as string : ''
		return opt
	})

	return result
}

// Creates a fully initialized TokenClaims with empty string defaults.
function createTokenClaims(): TokenClaims
{
	return { sub: '', role: '' }
}

// ─── Builders ─────────────────────────────────────────────────────────────────

// Constructs token claims from a regular user document.
function claimsFromUser(user: IUser): TokenClaims
{
	const claims = createTokenClaims()
	claims.sub   = String(user._id)
	claims.role  = user.role
	return claims
}

// Constructs token claims from an admin user document.
function claimsFromAdminUser(admin: IAdminUser): TokenClaims
{
	const claims = createTokenClaims()
	claims.sub   = String(admin._id)
	claims.role  = 'admin'
	return claims
}

// Builds a SafeLoginUser from a regular user document.
function safeUserFromUser(user: IUser): SafeLoginUser
{
	const safe       = createSafeLoginUser()
	safe.id          = String(user._id)
	safe.email       = user.email
	safe.role        = user.role
	safe.isActive    = user.isActive
	safe.lastLoginAt = user.lastLoginAt !== null ? user.lastLoginAt : new Date(0)
	return safe
}

// Builds a SafeLoginUser from an admin user document.
function safeUserFromAdminUser(admin: IAdminUser): SafeLoginUser
{
	const safe       = createSafeLoginUser()
	safe.id          = String(admin._id)
	safe.email       = admin.email
	safe.role        = 'admin'
	safe.isActive    = admin.isActive
	safe.lastLoginAt = admin.lastLoginAt
	return safe
}

// ─── Token Utilities ──────────────────────────────────────────────────────────

// Issues a signed JWT access token for the given claims.
function issueAccessToken(claims: TokenClaims): string
{
	return jwt.sign({ sub: claims.sub, role: claims.role }, ACCESS_SECRET, { expiresIn: '15m' })
}

// Generates a cryptographically secure random refresh token.
function issueRefreshToken(): string
{
	return crypto.randomBytes(64).toString('hex')
}

// Hashes a raw token string with SHA-256 for secure storage.
function hashToken(token: string): string
{
	return crypto.createHash('sha256').update(token).digest('hex')
}

// ─── Login ────────────────────────────────────────────────────────────────────

// Authenticates a regular user, enforcing lockout policy, and returns a LoginResult.
async function loginRegularUser(email: string, password: string): Promise<LoginResult>
{
	const genericError = new Error('Invalid credentials')
	const user = await User.findOne({ email }).select('+passwordHash +refreshTokens +loginAttempts +lockedUntil')

	if (user === null || !user.isActive)
	{
		throw genericError
	}

	if (user.lockedUntil !== null && user.lockedUntil !== undefined && user.lockedUntil > new Date())
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

	const accessToken  = issueAccessToken(claimsFromUser(user))
	const refreshToken = issueRefreshToken()

	if (!user.refreshTokens)
	{
		user.refreshTokens = []
	}

	user.refreshTokens.push(hashToken(refreshToken))
	if (user.refreshTokens.length > 5)
	{
		user.refreshTokens.shift()
	}

	await user.save()

	const result        = createLoginResult()
	result.accessToken  = accessToken
	result.refreshToken = refreshToken
	result.user         = safeUserFromUser(user)
	return result
}

// Authenticates an admin user against the AdminUser collection, enforcing lockout policy, and returns a LoginResult.
async function loginAdminUser(email: string, password: string, companyId: string): Promise<LoginResult>
{
	const genericError = new Error('Invalid credentials')
	const admin = await AdminUser.findOne({ email, companyId }).select('+passwordHash +refreshTokens +loginAttempts +lockedUntil')

	if (admin === null || !admin.isActive)
	{
		throw genericError
	}

	if (admin.lockedUntil !== null && admin.lockedUntil > new Date())
	{
		throw new Error('Account temporarily locked. Try again later.')
	}

	const valid = await admin.comparePassword(password)

	if (!valid)
	{
		admin.loginAttempts += 1
		if (admin.loginAttempts >= MAX_ATTEMPTS)
		{
			admin.lockedUntil = new Date(Date.now() + LOCK_DURATION)
		}
		await admin.save()
		throw genericError
	}

	admin.loginAttempts = 0
	admin.lockedUntil   = null
	admin.lastLoginAt   = new Date()

	const accessToken  = issueAccessToken(claimsFromAdminUser(admin))
	const refreshToken = issueRefreshToken()

	admin.refreshTokens.push(hashToken(refreshToken))
	if (admin.refreshTokens.length > 5)
	{
		admin.refreshTokens.shift()
	}

	await admin.save()

	const result        = createLoginResult()
	result.accessToken  = accessToken
	result.refreshToken = refreshToken
	result.user         = safeUserFromAdminUser(admin)
	return result
}

// Dispatches the login request to the correct handler based on the requested role.
export async function loginUser(
	email:     string,
	password:  string,
	role:      'user' | 'admin',
	companyId: string,
): Promise<LoginResult>
{
	if (role === 'admin') return loginAdminUser(email, password, companyId)
	return loginRegularUser(email, password)
}

// ─── Refresh ──────────────────────────────────────────────────────────────────

// Rotates the admin refresh token and returns a new LoginResult.
async function refreshAdminAccessToken(tokenHash: string): Promise<LoginResult>
{
	const admin = await AdminUser.findOne({ refreshTokens: tokenHash }).select('+refreshTokens')

	if (admin === null)
	{
		throw new Error('Refresh token reuse detected or invalid token')
	}

	admin.refreshTokens = admin.refreshTokens.filter(t => t !== tokenHash)

	const newRefreshToken = issueRefreshToken()
	admin.refreshTokens.push(hashToken(newRefreshToken))
	await admin.save()

	const result        = createLoginResult()
	result.accessToken  = issueAccessToken(claimsFromAdminUser(admin))
	result.refreshToken = newRefreshToken
	result.user         = safeUserFromAdminUser(admin)
	return result
}

// Rotates the stored refresh token and returns a new access token, checking both User and AdminUser collections.
export async function refreshAccessToken(rawRefreshToken: string): Promise<LoginResult>
{
	const tokenHash = hashToken(rawRefreshToken)
	const user = await User.findOne({ refreshTokens: tokenHash }).select('+refreshTokens')

	if (user === null)
	{
		return refreshAdminAccessToken(tokenHash)
	}

	user.refreshTokens = user.refreshTokens.filter(t => t !== tokenHash)

	const newRefreshToken = issueRefreshToken()
	user.refreshTokens.push(hashToken(newRefreshToken))
	await user.save()

	const result        = createLoginResult()
	result.accessToken  = issueAccessToken(claimsFromUser(user))
	result.refreshToken = newRefreshToken
	result.user         = safeUserFromUser(user)
	return result
}

// ─── Logout ───────────────────────────────────────────────────────────────────

// Removes the hashed refresh token from whichever collection owns the given userId.
export async function logoutUser(userId: string, rawRefreshToken: string): Promise<void>
{
	const tokenHash  = hashToken(rawRefreshToken)
	const userResult = await User.findByIdAndUpdate(userId, { $pull: { refreshTokens: tokenHash } })

	if (userResult === null)
	{
		await AdminUser.findByIdAndUpdate(userId, { $pull: { refreshTokens: tokenHash } })
	}
}