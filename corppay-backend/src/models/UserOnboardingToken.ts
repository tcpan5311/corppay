import mongoose, { Document, Schema } from 'mongoose'

export type UserOnboardingStatus = 'pending' | 'used'

export interface IUserOnboardingToken extends Document
{
	token:         string
	email:         string
	applicationId: mongoose.Types.ObjectId
	companyId:     mongoose.Types.ObjectId
	role:          string
	department:    string
	status:        UserOnboardingStatus
	expiresAt:     Date
	createdAt:     Date
	updatedAt:     Date
}

// Builds an unsaved user onboarding token document expiring 24 hours from now.
export function buildUserOnboardingTokenDoc
(
	token:         string,
	email:         string,
	applicationId: mongoose.Types.ObjectId,
	companyId:     mongoose.Types.ObjectId,
	role:          string,
	department:    string,
): Omit<IUserOnboardingToken, keyof Document>
{
	const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
	return {
		token,
		email,
		applicationId,
		companyId,
		role,
		department,
		status:    'pending',
		expiresAt,
		createdAt: new Date(),
		updatedAt: new Date(),
	} as Omit<IUserOnboardingToken, keyof Document>
}

const UserOnboardingTokenSchema = new Schema<IUserOnboardingToken>
(
	{
		token:         { type: String, required: true, unique: true, index: true },
		email:         { type: String, required: true },
		applicationId: { type: Schema.Types.ObjectId, ref: 'UserApplication', required: true },
		companyId:     { type: Schema.Types.ObjectId, ref: 'Company', required: true },
		role:          { type: String, required: true },
		department:    { type: String, required: true },
		status:        { type: String, enum: ['pending', 'used'], default: 'pending' },
		expiresAt:     { type: Date, required: true, index: { expireAfterSeconds: 0 } },
	},
	{ timestamps: true },
)

export default mongoose.model<IUserOnboardingToken>('UserOnboardingToken', UserOnboardingTokenSchema)