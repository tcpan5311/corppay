import dotenv from 'dotenv'
dotenv.config()

import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import User from '../models/User'

// Seeds a single test user into the connected database and logs the result.
async function seed()
{
	try
	{
		await mongoose.connect(process.env.MONGODB_URI as string)

		console.log("Connected DB:", mongoose.connection.name)

		const hash = await bcrypt.hash('Test123456', 12)

		const created = await User.create
		({
			email: 'tc.pan@corppay.com',
			passwordHash: hash,
			role: 'user',
		})

		console.log("User created:", created)

		const allUsers = await User.find()
		console.log("All users:", allUsers)
	}
	catch (err)
	{
		console.error("ERROR:", err)
	}
	finally
	{
		await mongoose.disconnect()
	}
}

seed()
