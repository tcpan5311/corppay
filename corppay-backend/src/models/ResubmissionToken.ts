import mongoose, { Document, Schema } from 'mongoose'

export type ResubmissionTokenStatus = 'pending' | 'used'

export interface IResubmissionToken extends Document
{
	token:     string
	email:     string
	companyId: mongoose.Types.ObjectId
	ssmNumber: string
	status:    ResubmissionTokenStatus
	expiresAt: Date
	createdAt: Date
	updatedAt: Date
}

// Creates a fully initialized IResubmissionToken document payload with a 24-hour expiry.
export function buildResubmissionTokenDoc(
	token:     string,
	email:     string,
	ssmNumber: string,
	companyId: mongoose.Types.ObjectId,
): Omit<IResubmissionToken, keyof Document>
{
	const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
	return { token, email, ssmNumber, companyId, status: 'pending', expiresAt } as Omit<IResubmissionToken, keyof Document>
}

const ResubmissionTokenSchema = new Schema<IResubmissionToken>(
	{
		token:     { type: String, required: true, unique: true },
		email:     { type: String, required: true },
		companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
		ssmNumber: { type: String, required: true },
		status:    { type: String, enum: ['pending', 'used'], default: 'pending' },
		expiresAt: { type: Date, required: true },
	},
	{ timestamps: true }
)

ResubmissionTokenSchema.index({ companyId: 1 })
ResubmissionTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.model<IResubmissionToken>('ResubmissionToken', ResubmissionTokenSchema)