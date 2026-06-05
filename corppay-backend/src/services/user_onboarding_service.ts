import bcrypt from 'bcrypt'
import crypto from 'crypto'
import mongoose from 'mongoose'

import CompanyUser from '../models/CompanyUser'
import UserOnboardingToken, { buildUserOnboardingTokenDoc } from '../models/UserOnboardingToken'

const BCRYPT_ROUNDS = 12

// Generates a cryptographically secure 64-character hex token.
function generateSecureToken(): string
{
	return crypto.randomBytes(32).toString('hex')
}

export type CreateUserOnboardingTokenResult =
{
	token:     string
	expiresAt: Date
}

// Creates a fully initialized CreateUserOnboardingTokenResult with empty token and epoch date.
function createUserOnboardingTokenResult(): CreateUserOnboardingTokenResult
{
	return { token: '', expiresAt: new Date(0) }
}

// Generates and persists a secure 24-hour onboarding token binding the user to an assigned company, role, and department.
export async function createUserOnboardingToken(
	email:         string,
	applicationId: mongoose.Types.ObjectId,
	companyId:     mongoose.Types.ObjectId,
	role:          string,
	department:    string,
): Promise<CreateUserOnboardingTokenResult>
{
	const token = generateSecureToken()
	const doc   = buildUserOnboardingTokenDoc(token, email, applicationId, companyId, role, department)
	const saved = await UserOnboardingToken.create(doc)

	const result     = createUserOnboardingTokenResult()
	result.token     = saved.token
	result.expiresAt = saved.expiresAt
	return result
}

export type UserOnboardingTokenVerifyResult =
{
	valid:      boolean
	reason:     string
	email:      string
	role:       string
	department: string
}

// Creates a fully initialized UserOnboardingTokenVerifyResult defaulting to invalid with empty strings.
export function createUserOnboardingTokenVerifyResult(): UserOnboardingTokenVerifyResult
{
	return { valid: false, reason: '', email: '', role: '', department: '' }
}

// Looks up and validates a user onboarding token, returning the associated email, role, and department on success.
export async function verifyUserOnboardingToken(token: string): Promise<UserOnboardingTokenVerifyResult>
{
	const result  = createUserOnboardingTokenVerifyResult()
	const pending = await UserOnboardingToken.findOne({ token })

	if (pending === null)
	{
		result.reason = 'Onboarding link is invalid or has already been used.'
		return result
	}

	if (pending.status === 'used')
	{
		result.reason = 'This onboarding link has already been used.'
		return result
	}

	if (new Date() > pending.expiresAt)
	{
		result.reason = 'This onboarding link has expired. Please contact your administrator.'
		return result
	}

	result.valid      = true
	result.email      = pending.email
	result.role       = pending.role
	result.department = pending.department
	return result
}

export type CompleteUserOnboardingResult =
{
	success: boolean
	reason:  string
}

// Creates a fully initialized CompleteUserOnboardingResult defaulting to unsuccessful with an empty reason.
export function createCompleteUserOnboardingResult(): CompleteUserOnboardingResult
{
	return { success: false, reason: '' }
}

// Hashes the password, creates the company user membership record, and marks the onboarding token as consumed.
export async function completeUserOnboarding(
	token:    string,
	password: string,
): Promise<CompleteUserOnboardingResult>
{
	const result  = createCompleteUserOnboardingResult()
	const pending = await UserOnboardingToken.findOne({ token })

	if (pending === null)
	{
		result.reason = 'Onboarding link is invalid.'
		return result
	}

	if (pending.status === 'used')
	{
		result.reason = 'This onboarding link has already been used.'
		return result
	}

	if (new Date() > pending.expiresAt)
	{
		result.reason = 'This onboarding link has expired.'
		return result
	}

	const existingUser = await CompanyUser.findOne({
		email:     pending.email.toLowerCase(),
		companyId: pending.companyId,
	})

	if (existingUser !== null)
	{
		result.reason = 'A user account for this email already exists for this company.'
		return result
	}

	const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

	await CompanyUser.create({
		email:         pending.email.toLowerCase(),
		passwordHash,
		companyId:     pending.companyId,
		applicationId: pending.applicationId,
		role:          pending.role,
		department:    pending.department,
	})

	await UserOnboardingToken.updateOne({ _id: pending._id }, { status: 'used' })

	result.success = true
	return result
}