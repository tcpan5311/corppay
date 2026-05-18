import mongoose, { Document, Schema } from 'mongoose'

export interface IAdminUser extends Document
{
	email:        string
	passwordHash: string
	ssmNumber:    string
	companyId:    mongoose.Types.ObjectId
	createdAt:    Date
	updatedAt:    Date
}

const AdminUserSchema = new Schema<IAdminUser>(
	{
		email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
		passwordHash: { type: String, required: true },
		ssmNumber:    { type: String, required: true, unique: true, uppercase: true, trim: true },
		companyId:    { type: Schema.Types.ObjectId, ref: 'Company', required: true },
	},
	{ timestamps: true }
)

export default mongoose.model<IAdminUser>('AdminUser', AdminUserSchema)