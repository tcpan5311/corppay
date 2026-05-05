import crypto from 'crypto'

import { createDirector, IUploadedDocument } from '../models/Company'
import PendingRegistration, { buildPendingRegistrationDoc, IPendingRegistration } from '../models/PendingRegistration'
import { registerCompany } from './company_service'

export type SavePendingRegistrationPayload =
{
	name:                 string
	ssmNumber:            string
	entityType:           string
	registeredAddress:    string
	submittedBy:          string
	directorIcPassport:   string
	directorRole:         string
	directorOwnershipPct: number | null
	documents:            IUploadedDocument[]
}

// Creates a fully initialized SavePendingRegistrationPayload with safe empty-string defaults.
export function createSavePendingRegistrationPayload(): SavePendingRegistrationPayload
{
	return {
		name:                 '',
		ssmNumber:            '',
		entityType:           '',
		registeredAddress:    '',
		submittedBy:          '',
		directorIcPassport:   '',
		directorRole:         '',
		directorOwnershipPct: null,
		documents:            [],
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

// Generates a cryptographically secure 64-character hex token.
function generateSecureToken(): string
{
	return crypto.randomBytes(32).toString('hex')
}

// Returns an active (non-expired, non-verified) pending registration for the given SSM number, or null if none exists.
export async function findActivePendingBySsm(ssmNumber: string): Promise<IPendingRegistration | null>
{
	const normalized = ssmNumber.trim().toUpperCase()
	return PendingRegistration.findOne({
		ssmNumber: normalized,
		status:    'pending',
		expiresAt: { $gt: new Date() },
	})
}

// Persists a pending registration with a fresh token and 15-minute expiry, returning the token details.
export async function savePendingRegistration(payload: SavePendingRegistrationPayload): Promise<SavePendingResult>
{
	const token    = generateSecureToken()
	const director = createDirector()
	director.icPassport   = payload.directorIcPassport
	director.role         = payload.directorRole as any
	director.ownershipPct = payload.directorOwnershipPct

	const doc = buildPendingRegistrationDoc(
		token,
		payload.name,
		payload.ssmNumber,
		payload.entityType as any,
		payload.registeredAddress,
		payload.submittedBy,
		director,
		payload.documents,
	)

	const created    = await PendingRegistration.create(doc)
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

// Validates the token, promotes the pending registration to a confirmed company record, and marks the token consumed.
export async function verifyEmailToken(token: string): Promise<VerifyTokenResult>
{
	const result = createVerifyTokenResult()

	const pending: IPendingRegistration | null = await PendingRegistration.findOne({ token })

	if (pending === null)
	{
		result.errorMessage = 'Verification link is invalid or has already been used.'
		return result
	}

	if (pending.status === 'verified')
	{
		result.errorMessage = 'This verification link has already been used.'
		return result
	}

	if (new Date() > pending.expiresAt)
	{
		result.errorMessage = 'Verification link has expired. Please submit the registration form again.'
		return result
	}

	await registerCompany
	({
		name:              pending.name,
		ssmNumber:         pending.ssmNumber,
		entityType:        pending.entityType,
		registeredAddress: pending.registeredAddress,
		director:
		{
			icPassport:   pending.director.icPassport,
			role:         pending.director.role,
			ownershipPct: pending.director.ownershipPct,
		},
		documents:   pending.documents,
		submittedBy: pending.submittedBy,
	})

	await PendingRegistration.updateOne({ _id: pending._id }, { status: 'verified' })

	result.success = true
	return result
}