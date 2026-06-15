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

const MAX_ATTEMPTS  = 5
const LOCK_DURATION = 15 * 60 * 1000

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

// Returns all companies the given email holds a company-user membership in.
export async function lookupUserCompanies(email: string): Promise<LookupAdminCompaniesResult>
{
	const result   = createLookupAdminCompaniesResult()
	const userList = await CompanyUser.find({ email: email.toLowerCase().trim() }).select('companyId').lean()

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
		throw genericError
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
		throw genericError
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

// Authenticates a company user membership against the CompanyUser collection, enforcing lockout policy, and returns a LoginResult.
async function loginCompanyUser(email: string, password: string, companyId: string): Promise<LoginResult>
{
	const genericError = new Error('Invalid credentials')
	const member = await CompanyUser.findOne({ email, companyId }).select('+passwordHash +refreshTokens +loginAttempts +lockedUntil')

	if (member === null || !member.isActive)
	{
		throw genericError
	}

	if (member.lockedUntil !== null && member.lockedUntil > new Date())
	{
		throw genericError
	}

	const valid = await member.comparePassword(password)

	if (!valid)
	{
		member.loginAttempts += 1
		if (member.loginAttempts >= MAX_ATTEMPTS)
		{
			member.lockedUntil = new Date(Date.now() + LOCK_DURATION)
		}
		await member.save()
		throw genericError
	}

	member.loginAttempts = 0
	member.lockedUntil   = null
	member.lastLoginAt   = new Date()

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