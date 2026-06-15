import mongoose, { Document, Schema } from 'mongoose'

import { IUploadedDocument } from './Company'
import { UserDocumentType, UserGender } from './UserApplication'

export type PendingUserStatus = 'pending' | 'verified'

export interface IPendingUserRegistration extends Document
{
	token:        string
	expiresAt:    Date
	status:       PendingUserStatus
	fullName:     string
	dateOfBirth:  string
	nationality:  string
	gender:       UserGender
	email:        string
	mobileNumber: string
	fullAddress:  string
	documentType: UserDocumentType
	submittedBy:  string
	targetCompanyId: mongoose.Types.ObjectId
	documents:    IUploadedDocument[]
	createdAt:    Date
	updatedAt:    Date
}

// Builds an unsaved pending user registration document expiring 15 minutes from now with the given token.
export function buildPendingUserRegistrationDoc
(
	token:        string,
	fullName:     string,
	dateOfBirth:  string,
	nationality:  string,
	gender:       UserGender,
	email:        string,
	mobileNumber: string,
	fullAddress:  string,
	documentType: UserDocumentType,
	submittedBy:  string,
	targetCompanyId: mongoose.Types.ObjectId,
	documents:    IUploadedDocument[],
): Omit<IPendingUserRegistration, keyof Document>
{
	const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
	return {
		token,
		expiresAt,
		status: 'pending',
		fullName,
		dateOfBirth,
		nationality,
		gender,
		email,
		mobileNumber,
		fullAddress,
		documentType,
		submittedBy,
		targetCompanyId,
		documents,
		createdAt: new Date(),
		updatedAt: new Date(),
	} as Omit<IPendingUserRegistration, keyof Document>
}

const UploadedDocSubSchema = new Schema<IUploadedDocument>
(
	{
		fieldName:    { type: String, default: null },
		originalName: { type: String, default: null },
		storagePath:  { type: String, default: null },
		mimeType:     { type: String, default: null },
		sizeBytes:    { type: Number, default: null },
		uploadedAt:   { type: Date,   default: null },
	},
	{ _id: false },
)

const PendingUserRegistrationSchema = new Schema<IPendingUserRegistration>
(
	{
		token:        { type: String, required: true, unique: true, index: true },
		expiresAt:    { type: Date,   required: true, index: { expireAfterSeconds: 0 } },
		status:       { type: String, enum: ['pending', 'verified'], default: 'pending' },
		fullName:     { type: String, required: true, trim: true },
		dateOfBirth:  { type: String, required: true, trim: true },
		nationality:  { type: String, required: true, trim: true },
		gender:       { type: String, enum: ['male', 'female'], required: true },
		email:        { type: String, required: true, lowercase: true, trim: true },
		mobileNumber: { type: String, required: true, trim: true },
		fullAddress:  { type: String, required: true, trim: true },
		documentType: { type: String, enum: ['passport', 'national_id', 'drivers_license'], required: true },
		submittedBy:  { type: String, required: true },
		targetCompanyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
		documents:    { type: [UploadedDocSubSchema], default: [] },
	},
	{ timestamps: true },
)

export default mongoose.model<IPendingUserRegistration>('PendingUserRegistration', PendingUserRegistrationSchema)