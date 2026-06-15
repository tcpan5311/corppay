import mongoose from 'mongoose'

import { IUploadedDocument } from '../models/Company'
import UserApplication, { UserDocumentType, UserGender } from '../models/UserApplication'
import UserResubmissionToken, { buildUserResubmissionTokenDoc } from '../models/UserResubmissionToken'
import { generateSecureToken, hashToken } from '../utils/token_utils'

export type CreateUserResubmissionTokenResult =
{
	token:     string
	expiresAt: Date
}

// Creates a fully initialized CreateUserResubmissionTokenResult with an empty token and epoch date.
function createUserResubmissionTokenResult(): CreateUserResubmissionTokenResult
{
	return { token: '', expiresAt: new Date(0) }
}

// Invalidates all pending resubmission tokens for an application, then generates and persists a new one.
export async function createUserResubmissionToken
(
	email:         string,
	applicationId: mongoose.Types.ObjectId,
): Promise<CreateUserResubmissionTokenResult>
{
	await UserResubmissionToken.updateMany
	(
		{ applicationId, status: 'pending' },
		{ status: 'used' },
	)

	const rawToken = generateSecureToken()
	const doc      = buildUserResubmissionTokenDoc(hashToken(rawToken), email, applicationId)
	const saved    = await UserResubmissionToken.create(doc)

	const result     = createUserResubmissionTokenResult()
	result.token     = rawToken
	result.expiresAt = saved.expiresAt
	return result
}

export type UserResubmissionTokenVerifyResult =
{
	valid:         boolean
	reason:        string
	applicationId: string
	email:         string
}

// Creates a fully initialized UserResubmissionTokenVerifyResult defaulting to invalid with empty strings.
export function createUserResubmissionTokenVerifyResult(): UserResubmissionTokenVerifyResult
{
	return { valid: false, reason: '', applicationId: '', email: '' }
}

// Looks up and validates a user resubmission token, returning the associated application identifiers on success.
export async function verifyUserResubmissionToken(token: string): Promise<UserResubmissionTokenVerifyResult>
{
	const result  = createUserResubmissionTokenVerifyResult()
	const pending = await UserResubmissionToken.findOne({ token: hashToken(token) })

	if (pending === null)
	{
		result.reason = 'Resubmission link is invalid or has already been used.'
		return result
	}

	if (pending.status === 'used')
	{
		result.reason = 'This resubmission link has already been used.'
		return result
	}

	if (new Date() > pending.expiresAt)
	{
		result.reason = 'This resubmission link has expired. Please contact your administrator.'
		return result
	}

	result.valid         = true
	result.applicationId = pending.applicationId.toString()
	result.email         = pending.email
	return result
}

export type ResubmitUserPayload =
{
	fullName:     string
	dateOfBirth:  string
	nationality:  string
	gender:       string
	mobileNumber: string
	fullAddress:  string
	documentType: string
	documents:    IUploadedDocument[]
}

// Creates a fully initialized ResubmitUserPayload with empty string fields and an empty documents array.
export function createResubmitUserPayload(): ResubmitUserPayload
{
	return {
		fullName:     '',
		dateOfBirth:  '',
		nationality:  '',
		gender:       '',
		mobileNumber: '',
		fullAddress:  '',
		documentType: '',
		documents:    [],
	}
}

export type CompleteUserResubmissionResult =
{
	success: boolean
	reason:  string
}

// Creates a fully initialized CompleteUserResubmissionResult defaulting to unsuccessful with an empty reason.
export function createCompleteUserResubmissionResult(): CompleteUserResubmissionResult
{
	return { success: false, reason: '' }
}

// Verifies the token, updates the existing application document in place, and marks the token as consumed.
export async function completeUserResubmission
(
	token:   string,
	payload: ResubmitUserPayload,
): Promise<CompleteUserResubmissionResult>
{
	const result  = createCompleteUserResubmissionResult()
	const pending = await UserResubmissionToken.findOneAndUpdate
	(
		{ token: hashToken(token), status: 'pending', expiresAt: { $gt: new Date() } },
		{ status: 'used' },
		{ new: false },
	)
	if (pending === null)
	{
		result.reason = 'Resubmission link is invalid, expired, or already used.'
		return result
	}

	const application = await UserApplication.findById(pending.applicationId)

	if (application === null)
	{
		result.reason = 'Associated application record not found.'
		return result
	}

	if (application.status !== 'awaiting_resubmit')
	{
		result.reason = 'This application is not currently awaiting resubmission.'
		return result
	}

	application.fullName     = payload.fullName
	application.dateOfBirth  = payload.dateOfBirth
	application.nationality  = payload.nationality
	application.gender       = payload.gender as UserGender
	application.mobileNumber = payload.mobileNumber
	application.fullAddress  = payload.fullAddress
	application.documentType = payload.documentType as UserDocumentType
	application.documents    = payload.documents
	application.status       = 'pending'
	application.reviewNote   = null
	application.reviewedAt   = null
	application.reviewedBy   = null
	await application.save()

	result.success = true
	return result
}