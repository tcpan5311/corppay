import bcrypt from 'bcrypt'
import mongoose, { Document, Schema } from 'mongoose'

export interface ICompanyUser extends Document
{
	email:             string
	passwordHash:      string
	companyId:         mongoose.Types.ObjectId
	applicationId:     mongoose.Types.ObjectId
	role:              string
	department:        string
	loginAttempts:     number
	lockedUntil:       Date | null
	lastFailedLoginAt: Date | null
	refreshTokens:     string[]
	isActive:          boolean
	lastLoginAt:       Date
	createdAt:         Date
	updatedAt:         Date
	comparePassword(candidate: string): Promise<boolean>
}

const CompanyUserSchema = new Schema<ICompanyUser>
(
	{
		email:             { type: String,   required: true, trim: true },
		passwordHash:      { type: String,   required: true,  select: false },
		companyId:         { type: Schema.Types.ObjectId, ref: 'Company', required: true },
		applicationId:     { type: Schema.Types.ObjectId, ref: 'UserApplication', required: true },
		role:              { type: String,   required: true },
		department:        { type: String,   required: true },
		loginAttempts:     { type: Number,   required: true,  default: 0 },
		lockedUntil:       { type: Date,     default: null },
		lastFailedLoginAt: { type: Date,     default: null },
		refreshTokens:     { type: [String], required: true,  default: [],   select: false },
		isActive:          { type: Boolean,  required: true,  default: true },
		lastLoginAt:       { type: Date,     required: true,  default: () => new Date(0) },
	},
	{ timestamps: true },
)

// Compares a plaintext candidate password against the stored bcrypt hash.
CompanyUserSchema.methods.comparePassword = async function(candidate: string): Promise<boolean>
{
	return bcrypt.compare(candidate, this.passwordHash as string)
}

CompanyUserSchema.index({ email: 1, companyId: 1 }, { unique: true })

export default mongoose.model<ICompanyUser>('CompanyUser', CompanyUserSchema)