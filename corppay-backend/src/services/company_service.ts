import Company, { createDirector, DirectorRole, EntityType, ICompany, IUploadedDocument } from '../models/Company'

export type RegisterCompanyPayload =
{
	name:              string | null
	ssmNumber:         string | null
	entityType:        EntityType | null
	registeredAddress: string | null
	director:          RegisterDirectorPayload
	documents:         IUploadedDocument[]
	submittedBy:       string | null
}

export type RegisterDirectorPayload =
{
	icPassport:   string | null
	role:         DirectorRole | null
	ownershipPct: number | null
}

// Creates a fully initialised RegisterDirectorPayload with all fields set to null pending assignment.
export function createRegisterDirectorPayload(): RegisterDirectorPayload
{
	return {
		icPassport:   null,
		role:         null,
		ownershipPct: null,
	}
}

// Creates a fully initialised RegisterCompanyPayload with all scalar fields null and arrays empty.
export function createRegisterCompanyPayload(): RegisterCompanyPayload
{
	return {
		name:              null,
		ssmNumber:         null,
		entityType:        null,
		registeredAddress: null,
		director:          createRegisterDirectorPayload(),
		documents:         [],
		submittedBy:       null,
	}
}

// Validates payload, resolves duplicate SSM records, and persists a new company document with pending status.
export async function registerCompany(payload: RegisterCompanyPayload): Promise<ICompany>
{
	if (!payload.name || !payload.ssmNumber || !payload.entityType || !payload.registeredAddress || !payload.submittedBy)
	{
		throw new Error('Missing required fields')
	}

	const name              = payload.name
	const ssmNumber         = payload.ssmNumber
	const entityType        = payload.entityType
	const registeredAddress = payload.registeredAddress
	const director          = payload.director
	const documents         = payload.documents
	const submittedBy       = payload.submittedBy

	const normalizedSsm = ssmNumber.trim().toUpperCase()

	const existing = await Company.findOne({ ssmNumber: normalizedSsm })

	if (existing !== null)
	{
		if (existing.status === 'approved')
		{
			throw new Error('A company with this SSM number is already registered.')
		}

		if (existing.status === 'pending')
		{
			throw new Error('A registration for this SSM number is already under review.')
		}

		await Company.deleteOne({ _id: existing._id })
	}

	const directorData        = createDirector()
	directorData.icPassport   = director.icPassport
	directorData.role         = director.role
	directorData.ownershipPct = director.ownershipPct

	const company = await Company.create
	({
		name:              name.trim(),
		ssmNumber:         normalizedSsm,
		entityType,
		registeredAddress: registeredAddress.trim(),
		director:          directorData,
		documents,
		status:            'pending',
		submittedBy,
	})

	return company
}

// Returns all companies submitted by the given user ID, sorted newest first.
export async function getCompaniesByUser(userId: string): Promise<ICompany[]>
{
	return Company.find({ submittedBy: userId }).sort({ createdAt: -1 })
}

// Returns a single company document by its MongoDB ID, or null if not found.
export async function getCompanyById(companyId: string): Promise<ICompany | null>
{
	return Company.findById(companyId)
}