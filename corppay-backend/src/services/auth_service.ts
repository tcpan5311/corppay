import crypto from 'crypto'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import AdminUser, { IAdminUser } from '../models/AdminUser'
import Company from '../models/Company'
import CompanyUser, { ICompanyUser } from '../models/CompanyUser'
import User, { IUser } from '../models/User'

dotenv.config()

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET  as string
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string

const FREE_ATTEMPTS    = 5
const BASE_BACKOFF_MS  = 1000
const MAX_BACKOFF_MS   = 15 * 60 * 1000
const ATTEMPT_RESET_MS = 15 * 60 * 1000

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

type LockableAccount =
{
	loginAttempts:     number
	lockedUntil:       Date | null
	lastFailedLoginAt: Date | null
}

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
	const adminList = await AdminUser.find({ email: email.trim() }).select('companyId').lean()

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

// Returns all companies the given email holds a company-user membership in.
export async function lookupUserCompanies(email: string): Promise<LookupAdminCompaniesResult>
{
	const result   = createLookupAdminCompaniesResult()
	const userList = await CompanyUser.find({ email: email.trim() }).select('companyId').lean()

	if (userList.length === 0) return result

	const companyIds  = userList.map((u) => u.companyId)
	const companyList = await Company.find({ _id: { $in: companyIds } }).select('_id name').lean()
	const nameMap     = new Map<string, string>()

	for (const c of companyList)
	{
		nameMap.set(String(c._id), c.name)
	}

	result.found     = true
	result.companies = userList.map((member) =>
	{
		const opt       = createAdminCompanyOption()
		const idStr     = String(member.companyId)
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

// Constructs token claims from a regular user document.
function claimsFromUser(user: IUser): TokenClaims
{
	const claims = createTokenClaims()
	claims.sub   = String(user._id)
	claims.role  = 'user'
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
	safe.role        = 'user'
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

// Constructs token claims from a company user membership document.
function claimsFromCompanyUser(member: ICompanyUser): TokenClaims
{
	const claims = createTokenClaims()
	claims.sub   = String(member._id)
	claims.role  = 'user'
	return claims
}

// Builds a SafeLoginUser from a company user membership document.
function safeUserFromCompanyUser(member: ICompanyUser): SafeLoginUser
{
	const safe       = createSafeLoginUser()
	safe.id          = String(member._id)
	safe.email       = member.email
	safe.role        = 'user'
	safe.isActive    = member.isActive
	safe.lastLoginAt = member.lastLoginAt
	return safe
}

// Issues a signed JWT access token for the given claims.
function issueAccessToken(claims: TokenClaims): string
{
	return jwt.sign({ sub: claims.sub, role: claims.role }, ACCESS_SECRET, { expiresIn: '15m', algorithm: 'HS256' })
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

// Adds a delay after repeated failed attempts, increasing up to a maximum limit.
function backoffDelayMs(failedAttempts: number): number
{
	if (failedAttempts <= FREE_ATTEMPTS)
	{
		return 0
	}

	const exponent = failedAttempts - FREE_ATTEMPTS - 1
	const delay    = BASE_BACKOFF_MS * Math.pow(2, exponent)
	return delay < MAX_BACKOFF_MS ? delay : MAX_BACKOFF_MS
}

// Resets the failure count after a period of inactivity to avoid unnecessary lockouts.
function applyAttemptReset(account: LockableAccount): void
{
	if (account.lastFailedLoginAt === null)
	{
		return
	}

	const elapsed = Date.now() - account.lastFailedLoginAt.getTime()

	if (elapsed >= ATTEMPT_RESET_MS)
	{
		account.loginAttempts     = 0
		account.lockedUntil       = null
		account.lastFailedLoginAt = null
	}
}

// Returns when another failed attempt is allowed and valid logins are never blocked.
function backoffRetryAt(account: LockableAccount): Date | null
{
	if (account.lastFailedLoginAt === null)
	{
		return null
	}

	const delay = backoffDelayMs(account.loginAttempts)

	if (delay <= 0)
	{
		return null
	}

	return new Date(account.lastFailedLoginAt.getTime() + delay)
}

// Authenticates a regular user with exponential backoff on failed attempts, and returns a LoginResult.
async function loginRegularUser(email: string, password: string): Promise<LoginResult>
{
	const genericError = new Error('Invalid credentials')
	const user = await User.findOne({ email }).select('+passwordHash +refreshTokens +loginAttempts +lockedUntil +lastFailedLoginAt')

	if (user === null || !user.isActive)
	{
		throw genericError
	}

	applyAttemptReset(user)

	const valid = await user.comparePassword(password)

	if (valid)
	{
		user.loginAttempts     = 0
		user.lockedUntil       = null
		user.lastFailedLoginAt = null
		user.lastLoginAt       = new Date()

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

	const now     = new Date()
	const retryAt = backoffRetryAt(user)

	if (retryAt === null || now >= retryAt)
	{
		user.loginAttempts    += 1
		user.lastFailedLoginAt = now
		user.lockedUntil       = backoffRetryAt(user)
		await user.save()
	}

	throw genericError
}

// Authenticates an admin user against the AdminUser collection with exponential backoff, and returns a LoginResult.
async function loginAdminUser(email: string, password: string, companyId: string): Promise<LoginResult>
{
	const genericError = new Error('Invalid credentials')
	const admin = await AdminUser.findOne({ email, companyId }).select('+passwordHash +refreshTokens +loginAttempts +lockedUntil +lastFailedLoginAt')

	if (admin === null || !admin.isActive)
	{
		throw genericError
	}

	applyAttemptReset(admin)

	const valid = await admin.comparePassword(password)

	if (valid)
	{
		admin.loginAttempts     = 0
		admin.lockedUntil       = null
		admin.lastFailedLoginAt = null
		admin.lastLoginAt       = new Date()

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

	const now     = new Date()
	const retryAt = backoffRetryAt(admin)

	if (retryAt === null || now >= retryAt)
	{
		admin.loginAttempts    += 1
		admin.lastFailedLoginAt = now
		admin.lockedUntil       = backoffRetryAt(admin)
		await admin.save()
	}

	throw genericError
}

// Authenticates a company user membership against the CompanyUser collection with exponential backoff, and returns a LoginResult.
async function loginCompanyUser(email: string, password: string, companyId: string): Promise<LoginResult>
{
	const genericError = new Error('Invalid credentials')
	const member = await CompanyUser.findOne({ email, companyId }).select('+passwordHash +refreshTokens +loginAttempts +lockedUntil +lastFailedLoginAt')

	if (member === null || !member.isActive)
	{
		throw genericError
	}

	applyAttemptReset(member)

	const valid = await member.comparePassword(password)

	if (valid)
	{
		member.loginAttempts     = 0
		member.lockedUntil       = null
		member.lastFailedLoginAt = null
		member.lastLoginAt       = new Date()

		const accessToken  = issueAccessToken(claimsFromCompanyUser(member))
		const refreshToken = issueRefreshToken()

		member.refreshTokens.push(hashToken(refreshToken))
		if (member.refreshTokens.length > 5)
		{
			member.refreshTokens.shift()
		}

		await member.save()

		const result        = createLoginResult()
		result.accessToken  = accessToken
		result.refreshToken = refreshToken
		result.user         = safeUserFromCompanyUser(member)
		return result
	}

	const now     = new Date()
	const retryAt = backoffRetryAt(member)

	if (retryAt === null || now >= retryAt)
	{
		member.loginAttempts    += 1
		member.lastFailedLoginAt = now
		member.lockedUntil       = backoffRetryAt(member)
		await member.save()
	}

	throw genericError
}

// Dispatches the login request to the correct handler based on the requested role.
export async function loginUser
(
	email:     string,
	password:  string,
	role:      'user' | 'admin',
	companyId: string,
): Promise<LoginResult>
{
	if (role === 'admin') return loginAdminUser(email, password, companyId)
	if (companyId !== '')  return loginCompanyUser(email, password, companyId)
	return loginRegularUser(email, password)
}

// Rotates the company user refresh token and returns a new LoginResult.
async function refreshCompanyUserAccessToken(tokenHash: string): Promise<LoginResult>
{
	const member = await CompanyUser.findOneAndUpdate
	(
		{ refreshTokens: tokenHash },
		{ $pull: { refreshTokens: tokenHash } },
		{ new: true },
	).select('+refreshTokens')

	if (member === null)
	{
		throw new Error('Refresh token reuse detected or invalid token')
	}

	const newRefreshToken = issueRefreshToken()
	member.refreshTokens.push(hashToken(newRefreshToken))
	if (member.refreshTokens.length > 5)
	{
		member.refreshTokens.shift()
	}
	await member.save()

	const result        = createLoginResult()
	result.accessToken  = issueAccessToken(claimsFromCompanyUser(member))
	result.refreshToken = newRefreshToken
	result.user         = safeUserFromCompanyUser(member)
	return result
}

// Rotates the admin refresh token and returns a new LoginResult, falling back to the company user collection.
async function refreshAdminAccessToken(tokenHash: string): Promise<LoginResult>
{
	const admin = await AdminUser.findOneAndUpdate
	(
		{ refreshTokens: tokenHash },
		{ $pull: { refreshTokens: tokenHash } },
		{ new: true },
	).select('+refreshTokens')

	if (admin === null)
	{
		return refreshCompanyUserAccessToken(tokenHash)
	}

	const newRefreshToken = issueRefreshToken()
	admin.refreshTokens.push(hashToken(newRefreshToken))
	if (admin.refreshTokens.length > 5)
	{
		admin.refreshTokens.shift()
	}
	await admin.save()

	const result        = createLoginResult()
	result.accessToken  = issueAccessToken(claimsFromAdminUser(admin))
	result.refreshToken = newRefreshToken
	result.user         = safeUserFromAdminUser(admin)
	return result
}

// Rotates the stored refresh token and returns a new access token, checking the User, AdminUser, and CompanyUser collections.
export async function refreshAccessToken(rawRefreshToken: string): Promise<LoginResult>
{
const tokenHash = hashToken(rawRefreshToken)

	// Atomically remove the presented token so concurrent/replayed refreshes cannot both succeed.
	const user = await User.findOneAndUpdate
	(
		{ refreshTokens: tokenHash },
		{ $pull: { refreshTokens: tokenHash } },
		{ new: true },
	).select('+refreshTokens')

	if (user === null)
	{
		return refreshAdminAccessToken(tokenHash)
	}

	const newRefreshToken = issueRefreshToken()
	user.refreshTokens.push(hashToken(newRefreshToken))
	if (user.refreshTokens.length > 5)
	{
		user.refreshTokens.shift()
	}
	await user.save()

	const result        = createLoginResult()
	result.accessToken  = issueAccessToken(claimsFromUser(user))
	result.refreshToken = newRefreshToken
	result.user         = safeUserFromUser(user)
	return result
}

// Removes the hashed refresh token from whichever collection owns the given userId.
export async function logoutUser(userId: string, rawRefreshToken: string): Promise<void>
{
	const tokenHash  = hashToken(rawRefreshToken)
	const userResult = await User.findByIdAndUpdate(userId, { $pull: { refreshTokens: tokenHash } })

	if (userResult === null)
	{
		const adminResult = await AdminUser.findByIdAndUpdate(userId, { $pull: { refreshTokens: tokenHash } })

		if (adminResult === null)
		{
			await CompanyUser.findByIdAndUpdate(userId, { $pull: { refreshTokens: tokenHash } })
		}
	}
}