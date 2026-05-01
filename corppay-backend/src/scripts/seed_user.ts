import dotenv from 'dotenv'
dotenv.config()

import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import User from '../models/User'

async function seed() {
  try {
    console.log("Connecting to:", process.env.MONGODB_URI)

    await mongoose.connect(process.env.MONGODB_URI as string)

    console.log("Connected DB:", mongoose.connection.name)

    const hash = await bcrypt.hash('Test123456', 12)

    const created = await User.create({
      email: 'tc.pan@corppay.com',
      passwordHash: hash,
      role: 'user'
    })

    console.log("User created:", created)

    const allUsers = await User.find()
    console.log("All users:", allUsers)

  } catch (err) {
    console.error("ERROR:", err)
  } finally {
    await mongoose.disconnect()
  }
}

seed()