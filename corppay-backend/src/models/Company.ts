import mongoose, { Document, Schema } from 'mongoose'

export type EntityType         = 'sdn_bhd' | 'sole_proprietor'
export type DirectorRole       = 'director' | 'owner'
export type RegistrationStatus = 'pending' | 'approved' | 'rejected'

export type IDirector =
{
	icPassport:   string | null
	role:         DirectorRole | null
	ownershipPct: number | null
}

export type IUploadedDocument =
{
	fieldName:    string | null
	originalName: string | null
	storagePath:  string | null
	mimeType:     string | null
	sizeBytes:    number | null
	uploadedAt:   Date | null
}

export interface ICompany extends Document
{
	name:              string
	ssmNumber:         string
	entityType:        EntityType
	registeredAddress: string
	director:          IDirector
	documents:         IUploadedDocument[]
	status:            RegistrationStatus
	submittedBy:       string
	reviewedBy:        mongoose.Types.ObjectId | null
	reviewedAt:        Date | null
	reviewNote:        string | null
	createdAt:         Date
	updatedAt:         Date
}

// Creates a fully initialized IDirector with all fields set to null.
export function createDirector(): IDirector
{
	return { icPassport: null, role: null, ownershipPct: null }
}

// Creates a fully initialized IUploadedDocument with all fields set to null.
export function createUploadedDocument(): IUploadedDocument
{
	return {
		fieldName:    null,
		originalName: null,
		storagePath:  null,
		mimeType:     null,
		sizeBytes:    null,
		uploadedAt:   null,
	}
}

const DirectorSchema = new Schema<IDirector>(
	{
		icPassport:   { type: String, required: true, trim: true, default: null },
		role:         { type: String, enum: ['director', 'owner'], required: true, default: null },
		ownershipPct: { type: Number, min: 0, max: 100, required: true },
	},
	{ _id: false }
)

const UploadedDocumentSchema = new Schema<IUploadedDocument>(
	{
		fieldName:    { type: String, required: true, default: null },
		originalName: { type: String, required: true, default: null },
		storagePath:  { type: String, required: true, default: null },
		mimeType:     { type: String, required: true, default: null },
		sizeBytes:    { type: Number, required: true, default: null },
		uploadedAt:   { type: Date, default: null },
	},
	{ _id: false }
)

const CompanySchema = new Schema<ICompany>(
	{
		name:              { type: String, required: true, trim: true },
		ssmNumber:         { type: String, required: true, unique: true, trim: true, uppercase: true },
		entityType:        { type: String, enum: ['sdn_bhd', 'sole_proprietor'], required: true },
		registeredAddress: { type: String, required: true, trim: true },
		director:          { type: DirectorSchema, required: true },
		documents:         { type: [UploadedDocumentSchema], default: [] },
		status:            { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
		submittedBy:       { type: String, required: true },
		reviewedBy:        { type: Schema.Types.ObjectId, ref: 'User', default: null },
		reviewedAt:        { type: Date, default: null },
		reviewNote:        { type: String, default: null },
	},
	{ timestamps: true }
)

CompanySchema.index({ submittedBy: 1 })
CompanySchema.index({ status: 1 })

export default mongoose.model<ICompany>('Company', CompanySchema)