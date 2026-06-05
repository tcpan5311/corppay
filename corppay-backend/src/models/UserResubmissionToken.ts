import mongoose, { Document, Schema } from 'mongoose'

export type UserResubmissionTokenStatus = 'pending' | 'used'

export interface IUserResubmissionToken extends Document
{
	token:         string
	email:         string
	applicationId: mongoose.Types.ObjectId
	status:        UserResubmissionTokenStatus
	expiresAt:     Date
	createdAt:     Date
	updatedAt:     Date
}

// Creates a fully initialized user resubmission token document payload with a 24-hour expiry.
export function buildUserResubmissionTokenDoc(
	token:         string,
	email:         string,
	applicationId: mongoose.Types.ObjectId,
): Omit<IUserResubmissionToken, keyof Document>
{
	const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
	return { token, email, applicationId, status: 'pending', expiresAt } as Omit<IUserResubmissionToken, keyof Document>
}

const UserResubmissionTokenSchema = new Schema<IUserResubmissionToken>(
	{
		token:         { type: String, required: true, unique: true },
		email:         { type: String, required: true },
		applicationId: { type: Schema.Types.ObjectId, ref: 'UserApplication', required: true },
		status:        { type: String, enum: ['pending', 'used'], default: 'pending' },
		expiresAt:     { type: Date, required: true },
	},
	{ timestamps: true },
)

UserResubmissionTokenSchema.index({ applicationId: 1 })
UserResubmissionTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.model<IUserResubmissionToken>('UserResubmissionToken', UserResubmissionTokenSchema)