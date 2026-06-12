import bcrypt from 'bcrypt'
import mongoose, { Document, Schema } from 'mongoose'

export interface IUser extends Document
{
    email:          string
    passwordHash:   string
    role:           'user'
    isActive:       boolean
    loginAttempts:  number
    lockedUntil:    Date | null
    refreshTokens:  string[]
    createdAt:      Date
    lastLoginAt:    Date | null
    comparePassword(candidate: string): Promise<boolean>
}

const UserSchema = new Schema<IUser>(
{
    email:          { type: String,  required: true, unique: true, lowercase: true, trim: true },
    passwordHash:   { type: String, required: true, select: false },
    role:           { type: String,  enum: ['user'], default: 'user' },
    isActive:       { type: Boolean, default: true },
    loginAttempts:  { type: Number,  default: 0 },
    lockedUntil:    { type: Date,    default: null },
    refreshTokens:  [{ type: String, select: false }],
    lastLoginAt:    { type: Date,    default: null },
},
{ timestamps: true })

UserSchema.methods.comparePassword = function (candidate: string)
{
    return bcrypt.compare(candidate, this.passwordHash)
}

export default mongoose.model<IUser>('User', UserSchema)