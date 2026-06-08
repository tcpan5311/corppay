import mongoose from 'mongoose'
import { IUploadedDocument } from '../models/Company'
import UserApplication, { ApplicationStatus, IUserApplication, UserDocumentType, UserGender } from '../models/UserApplication'

export type RegisterUserApplicationPayload =
{
	fullName:     string | null
	dateOfBirth:  string | null
	nationality:  string | null
	gender:       UserGender | null
	email:        string | null
	mobileNumber: string | null
	fullAddress:  string | null
	documentType: UserDocumentType | null
	targetCompanyId: string | null
	documents:    IUploadedDocument[]
	submittedBy:  string | null
}

// Creates a fully initialized RegisterUserApplicationPayload with null fields and an empty documents array.
export function createRegisterUserApplicationPayload(): RegisterUserApplicationPayload
{
	return {
		fullName:     null,
		dateOfBirth:  null,
		nationality:  null,
		gender:       null,
		email:        null,
		mobileNumber: null,
		fullAddress:  null,
		documentType: null,
		targetCompanyId: null,
		documents:    [],
		submittedBy:  null,
	}
}

// Returns the application record whose email matches the given value case-insensitively, or null if not found.
export async function findApplicationByEmail(email: string): Promise<IUserApplication | null>
{
	const normalized = email.trim().toLowerCase()
	return UserApplication.findOne({ email: normalized })
}

// Returns true when the thrown error is a MongoDB duplicate key violation.
function isDuplicateKeyError(err: unknown): boolean
{
	if (err === null || typeof err !== 'object') return false
	const record = err as Record<string, unknown>
	return record['code'] === 11000
}

// Validates the payload, resolves duplicate-email conflicts by status, and persists a new KYC application record.
export async function registerUserApplication(payload: RegisterUserApplicationPayload): Promise<IUserApplication>
{
	if (
		payload.fullName === null ||
		payload.dateOfBirth === null ||
		payload.nationality === null ||
		payload.gender === null ||
		payload.email === null ||
		payload.mobileNumber === null ||
		payload.fullAddress === null ||
		payload.documentType === null ||
		payload.targetCompanyId === null ||
		payload.submittedBy === null
	)
	{
		throw new Error('Missing required fields')
	}

	if (!mongoose.Types.ObjectId.isValid(payload.targetCompanyId))
	{
		throw new Error('A valid target company is required.')
	}

	const normalizedEmail = payload.email.trim().toLowerCase()
	const existing        = await UserApplication.findOne({ email: normalizedEmail })

	if (existing !== null)
	{
		if (existing.status === 'approved')
		{
			throw new Error('An application with this email is already approved.')
		}
		if (existing.status === 'pending')
		{
			throw new Error('An application for this email is already under review.')
		}

		// Rejected / awaiting_resubmit: update in place (preserve _id, history, referencing tokens).
		existing.fullName        = payload.fullName.trim()
		existing.dateOfBirth     = payload.dateOfBirth.trim()
		existing.nationality     = payload.nationality.trim()
		existing.gender          = payload.gender
		existing.mobileNumber    = payload.mobileNumber.trim()
		existing.fullAddress     = payload.fullAddress.trim()
		existing.documentType    = payload.documentType
		existing.targetCompanyId = new mongoose.Types.ObjectId(payload.targetCompanyId)
		existing.documents       = payload.documents
		existing.status          = 'pending'
		existing.reviewNote      = null
		existing.reviewedAt      = null
		existing.reviewedBy      = null
		existing.submittedBy     = payload.submittedBy
		await existing.save()
		return existing
	}

	try
	{
		const application = await UserApplication.create({
			fullName:     payload.fullName.trim(),
			dateOfBirth:  payload.dateOfBirth.trim(),
			nationality:  payload.nationality.trim(),
			gender:       payload.gender,
			email:        normalizedEmail,
			mobileNumber: payload.mobileNumber.trim(),
			fullAddress:  payload.fullAddress.trim(),
			documentType: payload.documentType,
			targetCompanyId: new mongoose.Types.ObjectId(payload.targetCompanyId),
			documents:    payload.documents,
			status:       'pending',
			submittedBy:  payload.submittedBy,
		})

		return application
	}
	catch (err)
	{
		if (isDuplicateKeyError(err))
		{
			throw new Error('An application with this email is already registered.')
		}
		throw err
	}
}

// Returns all application records submitted by the given user ID, sorted by creation date descending.
export async function getApplicationsByUser(userId: string): Promise<IUserApplication[]>
{
	return UserApplication.find({ submittedBy: userId }).sort({ createdAt: -1 })
}

// Returns the application record matching the given ID, or null if no match is found.
export async function getApplicationById(applicationId: string): Promise<IUserApplication | null>
{
	return UserApplication.findById(applicationId)
}

// Returns the difference in whole years between the given birth date and the reference date.
function computeAgeInYears(birth: Date, reference: Date): number
{
	let age = reference.getFullYear() - birth.getFullYear()
	const monthDelta = reference.getMonth() - birth.getMonth()
	const dayDelta   = reference.getDate() - birth.getDate()
	if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0))
	{
		age = age - 1
	}
	return age
}

// Returns the applicant age in whole years for a stored YYYY-MM-DD date of birth, or null when unparseable.
export function resolveApplicantAge(dateOfBirth: string, status: ApplicationStatus): number | null
{
	if (status === 'awaiting_resubmit' && dateOfBirth.trim() === '') return null
	const parsed = new Date(`${dateOfBirth.trim()}T00:00:00`)
	if (isNaN(parsed.getTime())) return null
	return computeAgeInYears(parsed, new Date())
}