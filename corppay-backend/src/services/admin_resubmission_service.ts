import crypto from 'crypto'
import mongoose from 'mongoose'

import Company, { IDirector, IUploadedDocument } from '../models/Company'
import ResubmissionToken, { buildResubmissionTokenDoc } from '../models/ResubmissionToken'

// Generates a cryptographically secure 64-character hex token.
function generateSecureToken(): string
{
	return crypto.randomBytes(32).toString('hex')
}

export type CreateResubmissionTokenResult =
{
	token:     string
	expiresAt: Date
}

// Creates a fully initialized CreateResubmissionTokenResult with an empty token and epoch date.
function createResubmissionTokenResult(): CreateResubmissionTokenResult
{
	return { token: '', expiresAt: new Date(0) }
}

// Invalidates all pending resubmission tokens for a company, then generates and persists a new one.
export async function createResubmissionToken(
	email:     string,
	ssmNumber: string,
	companyId: mongoose.Types.ObjectId,
): Promise<CreateResubmissionTokenResult>
{
	await ResubmissionToken.updateMany(
		{ companyId, status: 'pending' },
		{ status: 'used' },
	)

	const token  = generateSecureToken()
	const doc    = buildResubmissionTokenDoc(token, email, ssmNumber, companyId)
	const saved  = await ResubmissionToken.create(doc)

	const result     = createResubmissionTokenResult()
	result.token     = saved.token
	result.expiresAt = saved.expiresAt
	return result
}

export type ResubmissionTokenVerifyResult =
{
	valid:     boolean
	reason:    string
	companyId: string
	email:     string
	ssmNumber: string
}

// Creates a fully initialized ResubmissionTokenVerifyResult defaulting to invalid with empty strings.
export function createResubmissionTokenVerifyResult(): ResubmissionTokenVerifyResult
{
	return { valid: false, reason: '', companyId: '', email: '', ssmNumber: '' }
}

// Looks up and validates a resubmission token, returning the associated company identifiers on success.
export async function verifyResubmissionToken(token: string): Promise<ResubmissionTokenVerifyResult>
{
	const result  = createResubmissionTokenVerifyResult()
	const pending = await ResubmissionToken.findOne({ token })

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

	result.valid     = true
	result.companyId = pending.companyId.toString()
	result.email     = pending.email
	result.ssmNumber = pending.ssmNumber
	return result
}

export type ResubmitCompanyPayload =
{
	name:              string
	entityType:        string
	registeredAddress: string
	director:          IDirector
	documents:         IUploadedDocument[]
}

// Creates a fully initialized ResubmitCompanyPayload with empty string fields and null director.
export function createResubmitCompanyPayload(): ResubmitCompanyPayload
{
	return {
		name:              '',
		entityType:        '',
		registeredAddress: '',
		director:          { icPassport: null, role: null, ownershipPct: null },
		documents:         [],
	}
}

export type CompleteResubmissionResult =
{
	success: boolean
	reason:  string
}

// Creates a fully initialized CompleteResubmissionResult defaulting to unsuccessful with an empty reason.
export function createCompleteResubmissionResult(): CompleteResubmissionResult
{
	return { success: false, reason: '' }
}

// Verifies the token, updates the existing Company document in place, and marks the token as consumed.
export async function completeResubmission(
	token:   string,
	payload: ResubmitCompanyPayload,
): Promise<CompleteResubmissionResult>
{
	const result  = createCompleteResubmissionResult()
	const pending = await ResubmissionToken.findOne({ token })

	if (pending === null)
	{
		result.reason = 'Resubmission link is invalid.'
		return result
	}

	if (pending.status === 'used')
	{
		result.reason = 'This resubmission link has already been used.'
		return result
	}

	if (new Date() > pending.expiresAt)
	{
		result.reason = 'This resubmission link has expired.'
		return result
	}

	const company = await Company.findById(pending.companyId)

	if (company === null)
	{
		result.reason = 'Associated company record not found.'
		return result
	}

	if (company.status !== 'awaiting_resubmit')
	{
		result.reason = 'This company is not currently awaiting resubmission.'
		return result
	}

	company.name              = payload.name
	company.entityType        = payload.entityType as 'sdn_bhd' | 'sole_proprietor'
	company.registeredAddress = payload.registeredAddress
	company.director          = payload.director
	company.documents         = payload.documents
	company.status            = 'pending'
	company.reviewNote        = null
	company.reviewedAt        = null
	company.reviewedBy        = null
	await company.save()

	await ResubmissionToken.updateOne({ _id: pending._id }, { status: 'used' })

	result.success = true
	return result
}