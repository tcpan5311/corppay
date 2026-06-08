import mongoose from 'mongoose'

import { IUploadedDocument } from '../models/Company'
import PendingUserRegistration, { buildPendingUserRegistrationDoc, IPendingUserRegistration } from '../models/PendingUserRegistration'
import { UserDocumentType, UserGender } from '../models/UserApplication'
import { generateSecureToken, hashToken } from '../utils/token_utils'
import { createRegisterUserApplicationPayload, registerUserApplication } from './user_application_service'

export type SavePendingUserRegistrationPayload =
{
	fullName:     string
	dateOfBirth:  string
	nationality:  string
	gender:       string
	email:        string
	mobileNumber: string
	fullAddress:  string
	documentType: string
	submittedBy:  string
	targetCompanyId: string
	documents:    IUploadedDocument[]
}

// Creates a fully initialized SavePendingUserRegistrationPayload with safe empty-string defaults.
export function createSavePendingUserRegistrationPayload(): SavePendingUserRegistrationPayload
{
	return {
		fullName:     '',
		dateOfBirth:  '',
		nationality:  '',
		gender:       '',
		email:        '',
		mobileNumber: '',
		fullAddress:  '',
		documentType: '',
		submittedBy:  '',
		targetCompanyId: '',
		documents:    [],
	}
}

type SavePendingResult =
{
	token:     string
	expiresAt: Date
}

// Creates a fully initialized SavePendingResult with an empty token and epoch expiresAt.
function createSavePendingResult(): SavePendingResult
{
	return { token: '', expiresAt: new Date(0) }
}

// Returns an active (non-expired, non-verified) pending registration for the given email, or null if none exists.
export async function findActivePendingByEmail(email: string): Promise<IPendingUserRegistration | null>
{
	const normalized = email.trim().toLowerCase()
	return PendingUserRegistration.findOne({
		email:     normalized,
		status:    'pending',
		expiresAt: { $gt: new Date() },
	})
}

// Persists a pending user registration with a fresh token and 15-minute expiry, returning the token details.
export async function savePendingUserRegistration(payload: SavePendingUserRegistrationPayload): Promise<SavePendingResult>
{
	const token = generateSecureToken()

	const doc = buildPendingUserRegistrationDoc(
		token,
		payload.fullName,
		payload.dateOfBirth,
		payload.nationality,
		payload.gender as UserGender,
		payload.email,
		payload.mobileNumber,
		payload.fullAddress,
		payload.documentType as UserDocumentType,
		payload.submittedBy,
		new mongoose.Types.ObjectId(payload.targetCompanyId),
		payload.documents,
	)

	const created    = await PendingUserRegistration.create(doc)
	const result     = createSavePendingResult()
	result.token     = created.token
	result.expiresAt = created.expiresAt
	return result
}

export type VerifyTokenResult =
{
	success:      boolean
	errorMessage: string
}

// Creates a fully initialized VerifyTokenResult with success false and empty errorMessage.
export function createVerifyTokenResult(): VerifyTokenResult
{
	return { success: false, errorMessage: '' }
}

// Validates the token, promotes the pending registration to a KYC application record, and marks the token consumed.
export async function verifyEmailToken(token: string): Promise<VerifyTokenResult>
{
	const result  = createVerifyTokenResult()
	const tokenHash = hashToken(token)
	const pending = await PendingUserRegistration.findOneAndUpdate(
		{ token: tokenHash, status: 'pending', expiresAt: { $gt: new Date() } },
		{ status: 'verified' },
		{ new: false },
	)

	if (pending === null)
	{
		const existing = await PendingUserRegistration.findOne({ token: tokenHash })
		if (existing === null)                   result.errorMessage = 'Verification link is invalid or has already been used.'
		else if (existing.status === 'verified') result.errorMessage = 'This verification link has already been used.'
		else                                     result.errorMessage = 'Verification link has expired. Please submit the registration form again.'
		return result
	}

	const payload     = createRegisterUserApplicationPayload()
	payload.fullName     = pending.fullName
	payload.dateOfBirth  = pending.dateOfBirth
	payload.nationality  = pending.nationality
	payload.gender       = pending.gender
	payload.email        = pending.email
	payload.mobileNumber = pending.mobileNumber
	payload.fullAddress  = pending.fullAddress
	payload.documentType = pending.documentType
	payload.targetCompanyId = String(pending.targetCompanyId)
	payload.documents    = pending.documents
	payload.submittedBy  = pending.submittedBy

	await registerUserApplication(payload)
	result.success = true
	return result
}