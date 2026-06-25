import mongoose, { Document, Schema } from 'mongoose'

import { IUploadedDocument } from './Company'

export type UserGender             = 'male' | 'female'
export type UserDocumentType       = 'passport' | 'national_id' | 'drivers_license'
export type ApplicationStatus      = 'pending' | 'approved' | 'rejected' | 'awaiting_resubmit'

export interface IUserApplication extends Document
{
	fullName:           string
	dateOfBirth:        string
	nationality:        string
	gender:             UserGender
	email:              string
	mobileNumber:       string
	fullAddress:        string
	documentType:       UserDocumentType
	documents:          IUploadedDocument[]
	status:             ApplicationStatus
	submittedBy:        string
	targetCompanyId:    mongoose.Types.ObjectId
	assignedCompanyId:  mongoose.Types.ObjectId | null
	assignedRole:       string | null
	assignedDepartment: string | null
	reviewedBy:         mongoose.Types.ObjectId | null
	reviewedAt:         Date | null
	reviewNote:         string | null
	resubmissionCount:  number
	createdAt:          Date
	updatedAt:          Date
}

const UploadedDocumentSchema = new Schema<IUploadedDocument>
(
	{
		fieldName:    { type: String, required: true, default: null },
		originalName: { type: String, required: true, default: null },
		storagePath:  { type: String, required: true, default: null },
		mimeType:     { type: String, required: true, default: null },
		sizeBytes:    { type: Number, required: true, default: null },
		uploadedAt:   { type: Date, default: null },
	},
	{ _id: false },
)

const UserApplicationSchema = new Schema<IUserApplication>
(
	{
		fullName:           { type: String, required: true, trim: true },
		dateOfBirth:        { type: String, required: true, trim: true },
		nationality:        { type: String, required: true, trim: true },
		gender:             { type: String, enum: ['male', 'female'], required: true },
		email:              { type: String, required: true, trim: true },
		mobileNumber:       { type: String, required: true, trim: true },
		fullAddress:        { type: String, required: true, trim: true },
		documentType:       { type: String, enum: ['passport', 'national_id', 'drivers_license'], required: true },
		documents:          { type: [UploadedDocumentSchema], default: [] },
		status:             { type: String, enum: ['pending', 'approved', 'rejected', 'awaiting_resubmit'], default: 'pending' },
		submittedBy:        { type: String, required: true },
		targetCompanyId:    { type: Schema.Types.ObjectId, ref: 'Company', required: true },
		assignedCompanyId:  { type: Schema.Types.ObjectId, ref: 'Company', default: null },
		assignedRole:       { type: String, default: null },
		assignedDepartment: { type: String, default: null },
		reviewedBy:         { type: Schema.Types.ObjectId, ref: 'AdminUser', default: null },
		reviewedAt:         { type: Date, default: null },
		reviewNote:         { type: String, default: null },
		resubmissionCount:  { type: Number, default: 0 },
	},
	{ timestamps: true },
)

UserApplicationSchema.index({ submittedBy: 1 })
UserApplicationSchema.index({ status: 1 })
UserApplicationSchema.index({ email: 1 })
UserApplicationSchema.index({ targetCompanyId: 1, status: 1 })

export default mongoose.model<IUserApplication>('UserApplication', UserApplicationSchema)