import { createDirector, DirectorRole, EntityType, IUploadedDocument } from '../models/Company'
import PendingRegistration, { buildPendingRegistrationDoc, IPendingRegistration } from '../models/PendingRegistration'
import { generateSecureToken, hashToken } from '../utils/token_utils'
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

// Returns the active pending registration whose name matches the given value case-insensitively, or null if absent.
export async function findActivePendingByName(name: string): Promise<IPendingRegistration | null>
{
	return PendingRegistration.findOne({
		name:      name.trim(),
		status:    'pending',
		expiresAt: { $gt: new Date() },
	}).collation({ locale: 'en', strength: 2 })
}

// Persists a pending registration with a fresh token and 15-minute expiry, returning the token details.
export async function savePendingRegistration(payload: SavePendingRegistrationPayload): Promise<SavePendingResult>
{
	const rawToken            = generateSecureToken()
	const director            = createDirector()
	director.icPassport       = payload.directorIcPassport
	director.role             = payload.directorRole as DirectorRole
	director.ownershipPct     = payload.directorOwnershipPct

	const doc = buildPendingRegistrationDoc(
		hashToken(rawToken),
		payload.name,
		payload.ssmNumber,
		payload.entityType as EntityType,
		payload.registeredAddress,
		payload.submittedBy,
		director,
		payload.documents,
	)

	const created    = await PendingRegistration.create(doc)
	const result     = createSavePendingResult()
	result.token     = rawToken
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
	const result    = createVerifyTokenResult()
	const tokenHash = hashToken(token)

	// Atomically claim the pending registration so it cannot be verified twice concurrently.
	const pending = await PendingRegistration.findOneAndUpdate(
		{ token: tokenHash, status: 'pending', expiresAt: { $gt: new Date() } },
		{ status: 'verified' },
		{ new: false },
	)

	if (pending === null)
	{
		const existing = await PendingRegistration.findOne({ token: tokenHash })
		if (existing === null)                   result.errorMessage = 'Verification link is invalid or has already been used.'
		else if (existing.status === 'verified') result.errorMessage = 'This verification link has already been used.'
		else                                     result.errorMessage = 'Verification link has expired. Please submit the registration form again.'
		return result
	}

	await registerCompany({
		name:              pending.name,
		ssmNumber:         pending.ssmNumber,
		entityType:        pending.entityType,
		registeredAddress: pending.registeredAddress,
		director: {
			icPassport:   pending.director.icPassport,
			role:         pending.director.role,
			ownershipPct: pending.director.ownershipPct,
		},
		documents:   pending.documents,
		submittedBy: pending.submittedBy,
	})

	result.success = true
	return result
}