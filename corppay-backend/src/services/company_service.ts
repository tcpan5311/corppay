import Company, { createDirector, DirectorRole, EntityType, ICompany, IUploadedDocument } from '../models/Company'

export type RegisterDirectorPayload =
{
	icPassport:   string | null
	role:         DirectorRole | null
	ownershipPct: number | null
}

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

// Creates a fully initialized RegisterDirectorPayload with all fields set to null.
export function createRegisterDirectorPayload(): RegisterDirectorPayload
{
	return { icPassport: null, role: null, ownershipPct: null }
}

// Creates a fully initialized RegisterCompanyPayload with null fields and an empty documents array.
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

// Returns the company record matching the normalized SSM number, or null if not found.
export async function findCompanyBySsm(ssmNumber: string): Promise<ICompany | null>
{
	const normalized = ssmNumber.trim().toUpperCase()
	return Company.findOne({ ssmNumber: normalized })
}

// Validates the payload, resolves duplicate SSM conflicts, and persists a new company record.
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
	const normalizedSsm     = ssmNumber.trim().toUpperCase()
	const existing          = await Company.findOne({ ssmNumber: normalizedSsm })

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

	const company = await Company.create({
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

// Returns all company records associated with the given user ID, sorted by creation date descending.
export async function getCompaniesByUser(userId: string): Promise<ICompany[]>
{
	return Company.find({ submittedBy: userId }).sort({ createdAt: -1 })
}

// Returns the company record matching the given ID, or null if no match is found.
export async function getCompanyById(companyId: string): Promise<ICompany | null>
{
	return Company.findById(companyId)
}