import mongoose, { Document, Schema } from 'mongoose'

export type OnboardingStatus = 'pending' | 'used'

export interface IOnboardingToken extends Document
{
	token:     string
	email:     string
	ssmNumber: string
	companyId: mongoose.Types.ObjectId
	status:    OnboardingStatus
	expiresAt: Date
	createdAt: Date
	updatedAt: Date
}

// Builds an unsaved onboarding token document expiring 24 hours from now.
export function buildOnboardingTokenDoc(
	token:     string,
	email:     string,
	ssmNumber: string,
	companyId: mongoose.Types.ObjectId,
): Omit<IOnboardingToken, keyof Document>
{
	const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
	return {
		token,
		email,
		ssmNumber,
		companyId,
		status:    'pending',
		expiresAt,
		createdAt: new Date(),
		updatedAt: new Date(),
	} as Omit<IOnboardingToken, keyof Document>
}

const OnboardingTokenSchema = new Schema<IOnboardingToken>(
	{
		token:     { type: String, required: true, unique: true, index: true },
		email:     { type: String, required: true },
		ssmNumber: { type: String, required: true },
		companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
		status:    { type: String, enum: ['pending', 'used'], default: 'pending' },
		expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
	},
	{ timestamps: true }
)

export default mongoose.model<IOnboardingToken>('OnboardingToken', OnboardingTokenSchema)