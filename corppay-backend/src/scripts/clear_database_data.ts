import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import AdminUser from '../models/AdminUser'
import Company from '../models/Company'
import OnboardingToken from '../models/OnboardingToken'
import PendingRegistration from '../models/PendingRegistration'
import ResubmissionToken from '../models/ResubmissionToken'

async function clear()
{
  try
  {
    console.log('🔌 Connecting to:', process.env.MONGODB_URI)
    await mongoose.connect(process.env.MONGODB_URI as string)
    console.log('✅ Connected DB:', mongoose.connection.name)

    const adminUsersDeleted = await AdminUser.deleteMany({})
    const companiesDeleted = await Company.deleteMany({})
    const onboardingTokensDeleted = await OnboardingToken.deleteMany({})
    const pendingRegistrationsDeleted = await PendingRegistration.deleteMany({})
    const resubmissionTokensDeleted = await ResubmissionToken.deleteMany({})

    console.log('\n🗑️ Deleted records:')
    console.log(`AdminUsers: ${adminUsersDeleted.deletedCount}`)
    console.log(`Companies: ${companiesDeleted.deletedCount}`)
    console.log(`OnboardingTokens: ${onboardingTokensDeleted.deletedCount}`)
    console.log(`PendingRegistrations: ${pendingRegistrationsDeleted.deletedCount}`)
    console.log(`ResubmissionTokens: ${resubmissionTokensDeleted.deletedCount}`)

    console.log('\n✅ All target collections cleared.')
  }
  catch (err)
  {
    console.error('❌ ERROR:', err)
    process.exit(1)
  }
  finally
  {
    await mongoose.disconnect()
    console.log('\n🔌 Disconnected.')
  }
}

clear()