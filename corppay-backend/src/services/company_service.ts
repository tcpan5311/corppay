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

// Returns the company record whose name matches the given value case-insensitively, or null if not found.
export async function findCompanyByName(name: string): Promise<ICompany | null>
{
	return Company.findOne({ name: name.trim() }).collation({ locale: 'en', strength: 2 })
}

// Returns true when the thrown error is a MongoDB duplicate key violation.
function isDuplicateKeyError(err: unknown): boolean
{
	if (err === null || typeof err !== 'object') return false
	const record = err as Record<string, unknown>
	return record['code'] === 11000
}

// Extracts the first field name from a MongoDB duplicate key error's keyValue map.
function resolveDuplicateKeyField(err: unknown): string
{
	if (err === null || typeof err !== 'object') return ''
	const record   = err as Record<string, unknown>
	const keyValue = record['keyValue']
	if (keyValue === null || typeof keyValue !== 'object') return ''
	const keys = Object.keys(keyValue as Record<string, unknown>)
	return keys.length > 0 ? keys[0] : ''
}

// Validates the payload, resolves duplicate SSM conflicts, and persists a new company record.
export async function registerCompany(payload: RegisterCompanyPayload): Promise<ICompany>
{
	if (!payload.name || !payload.ssmNumber || !payload.entityType || !payload.registeredAddress || !payload.submittedBy || payload.director.ownershipPct === null)
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

	const existingByName = await Company.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } })

	if (existingByName !== null)
	{
		if (existingByName.status === 'approved')
		{
			throw new Error('A company with this name is already registered.')
		}
		if (existingByName.status === 'pending')
		{
			throw new Error('A registration with this company name is already under review.')
		}
		await Company.deleteOne({ _id: existingByName._id })
	}

	const directorData        = createDirector()
	directorData.icPassport   = director.icPassport
	directorData.role         = director.role
	directorData.ownershipPct = director.ownershipPct

	try
	{
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
	catch (err)
	{
		if (isDuplicateKeyError(err))
		{
			const field = resolveDuplicateKeyField(err)
			if (field === 'ssmNumber') throw new Error('A company with this SSM number is already registered.')
			if (field === 'name')      throw new Error('A company with this name is already registered.')
		}
		throw err
	}
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