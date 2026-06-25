import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import { generateSecureToken, hashToken } from '../utils/token_utils'

import AdminUser from '../models/AdminUser'
import OnboardingToken, { buildOnboardingTokenDoc } from '../models/OnboardingToken'

const BCRYPT_ROUNDS = 12

export type CreateOnboardingTokenResult =
{
	token:     string
	expiresAt: Date
}

// Creates a fully initialized CreateOnboardingTokenResult with empty token and epoch date.
function createOnboardingTokenResult(): CreateOnboardingTokenResult
{
	return { token: '', expiresAt: new Date(0) }
}

// Generates and persists a secure 24-hour onboarding token for the given company.
export async function createOnboardingToken
(
	email:     string,
	ssmNumber: string,
	companyId: mongoose.Types.ObjectId,
): Promise<CreateOnboardingTokenResult>
{
	const rawToken = generateSecureToken()
	const doc      = buildOnboardingTokenDoc(hashToken(rawToken), email, ssmNumber, companyId)
	const saved    = await OnboardingToken.create(doc)
	const result     = createOnboardingTokenResult()
	result.token     = rawToken
	result.expiresAt = saved.expiresAt
	return result
}

export type OnboardingTokenVerifyResult =
{
	valid:     boolean
	reason:    string
	email:     string
	ssmNumber: string
}

// Creates a fully initialized OnboardingTokenVerifyResult defaulting to invalid with empty strings.
export function createOnboardingTokenVerifyResult(): OnboardingTokenVerifyResult
{
	return { valid: false, reason: '', email: '', ssmNumber: '' }
}

// Looks up and validates an onboarding token, returning the associated email and ssmNumber on success.
export async function verifyOnboardingToken(token: string): Promise<OnboardingTokenVerifyResult>
{
	const result  = createOnboardingTokenVerifyResult()
	const pending = await OnboardingToken.findOne({ token: hashToken(token) })

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

	result.valid     = true
	result.email     = pending.email
	result.ssmNumber = pending.ssmNumber
	return result
}

export type CompleteOnboardingResult =
{
	success: boolean
	reason:  string
}

// Creates a fully initialized CompleteOnboardingResult defaulting to unsuccessful with an empty reason.
export function createCompleteOnboardingResult(): CompleteOnboardingResult
{
	return { success: false, reason: '' }
}

// Hashes the password, creates the admin user record, and marks the onboarding token as consumed.
export async function completeOnboarding
(
	token:    string,
	password: string,
): Promise<CompleteOnboardingResult>
{
	const result  = createCompleteOnboardingResult()

	// Atomically claim the token (pending + unexpired) so it can only be consumed once.
	const pending = await OnboardingToken.findOneAndUpdate
	(
		{ token: hashToken(token), status: 'pending', expiresAt: { $gt: new Date() } },
		{ status: 'used' },
		{ new: false },
	)

	if (pending === null)
	{
		result.reason = 'Onboarding link is invalid, expired, or already used.'
		return result
	}

	const existingAdmin = await AdminUser.findOne({ email: pending.email, companyId: pending.companyId })
	if (existingAdmin !== null)
	{
		result.reason = 'An admin account for this email already exists.'
		return result
	}

	const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

	await AdminUser.create
	({
		email:        pending.email,
		passwordHash,
		ssmNumber:    pending.ssmNumber.trim().toUpperCase(),
		companyId:    pending.companyId,
	})

	result.success = true
	return result
}