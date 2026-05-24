import bcrypt from 'bcrypt'
import mongoose, { Document, Schema } from 'mongoose'

export interface IAdminUser extends Document
{
	email:          string
	passwordHash:   string
	ssmNumber:      string
	companyId:      mongoose.Types.ObjectId
	loginAttempts:  number
	lockedUntil:    Date | null
	refreshTokens:  string[]
	isActive:       boolean
	lastLoginAt:    Date
	createdAt:      Date
	updatedAt:      Date
	comparePassword(candidate: string): Promise<boolean>
}

const AdminUserSchema = new Schema<IAdminUser>(
	{
		email:         { type: String,   required: true,  unique: true, lowercase: true, trim: true },
		passwordHash:  { type: String,   required: true,  select: false },
		ssmNumber:     { type: String,   required: true,  unique: true, uppercase: true, trim: true },
		companyId:     { type: Schema.Types.ObjectId, ref: 'Company', required: true },
		loginAttempts: { type: Number,   required: true,  default: 0 },
		lockedUntil:   { type: Date,     default: null },
		refreshTokens: { type: [String], required: true,  default: [],   select: false },
		isActive:      { type: Boolean,  required: true,  default: true },
		lastLoginAt:   { type: Date,     required: true,  default: () => new Date(0) },
	},
	{ timestamps: true }
)

// Compares a plaintext candidate password against the stored bcrypt hash.
AdminUserSchema.methods.comparePassword = async function(candidate: string): Promise<boolean>
{
	return bcrypt.compare(candidate, this.passwordHash as string)
}

export default mongoose.model<IAdminUser>('AdminUser', AdminUserSchema)