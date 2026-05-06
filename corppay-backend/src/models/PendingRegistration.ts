import mongoose, { Document, Schema } from 'mongoose'

import { EntityType, IDirector, IUploadedDocument } from './Company'

export type PendingStatus = 'pending' | 'verified'

export interface IPendingRegistration extends Document
{
	token:             string
	expiresAt:         Date
	status:            PendingStatus
	name:              string
	ssmNumber:         string
	entityType:        EntityType
	registeredAddress: string
	submittedBy:       string
	director:          IDirector
	documents:         IUploadedDocument[]
	createdAt:         Date
	updatedAt:         Date
}

// Creates a pending registration document expiring 15 minutes from now with the given token.
export function buildPendingRegistrationDoc(
	token:             string,
	name:              string,
	ssmNumber:         string,
	entityType:        EntityType,
	registeredAddress: string,
	submittedBy:       string,
	director:          IDirector,
	documents:         IUploadedDocument[],
): Omit<IPendingRegistration, keyof Document>
{
	const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
	return {
		token,
		expiresAt,
		status: 'pending',
		name,
		ssmNumber,
		entityType,
		registeredAddress,
		submittedBy,
		director,
		documents,
		createdAt: new Date(),
		updatedAt: new Date(),
	} as Omit<IPendingRegistration, keyof Document>
}

const DirectorSubSchema = new Schema<IDirector>(
	{
		icPassport:   { type: String, default: null },
		role:         { type: String, enum: ['director', 'owner'], default: null },
		ownershipPct: { type: Number, default: null },
	},
	{ _id: false }
)

const UploadedDocSubSchema = new Schema<IUploadedDocument>(
	{
		fieldName:    { type: String, default: null },
		originalName: { type: String, default: null },
		storagePath:  { type: String, default: null },
		mimeType:     { type: String, default: null },
		sizeBytes:    { type: Number, default: null },
		uploadedAt:   { type: Date,   default: null },
	},
	{ _id: false }
)

const PendingRegistrationSchema = new Schema<IPendingRegistration>(
	{
		token:             { type: String, required: true, unique: true, index: true },
		expiresAt:         { type: Date,   required: true, index: { expireAfterSeconds: 0 } },
		status:            { type: String, enum: ['pending', 'verified'], default: 'pending' },
		name:              { type: String, required: true, trim: true },
		ssmNumber:         { type: String, required: true, trim: true, uppercase: true },
		entityType:        { type: String, enum: ['sdn_bhd', 'sole_proprietor'], required: true },
		registeredAddress: { type: String, required: true, trim: true },
		submittedBy:       { type: String, required: true },
		director:          { type: DirectorSubSchema,      required: true },
		documents:         { type: [UploadedDocSubSchema], default: [] },
	},
	{ timestamps: true }
)

export default mongoose.model<IPendingRegistration>('PendingRegistration', PendingRegistrationSchema)