import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import AdminUser from '../models/AdminUser'
import Company from '../models/Company'
import CompanyUser from '../models/CompanyUser'
import OnboardingToken from '../models/OnboardingToken'
import PendingRegistration from '../models/PendingRegistration'
import PendingUserRegistration from '../models/PendingUserRegistration'
import ResubmissionToken from '../models/ResubmissionToken'
import UserApplication from '../models/UserApplication'
import UserOnboardingToken from '../models/UserOnboardingToken'
import UserResubmissionToken from '../models/UserResubmissionToken'

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
    const companyUsersDeleted = await CompanyUser.deleteMany({})
    const pendingUserRegistrationsDeleted = await PendingUserRegistration.deleteMany({})
    const userApplicationsDeleted = await UserApplication.deleteMany({})
    const userOnboardingTokensDeleted = await UserOnboardingToken.deleteMany({})
    const userResubmissionTokensDeleted = await UserResubmissionToken.deleteMany({})

    console.log('\n🗑️ Deleted records:')
    console.log(`AdminUsers: ${adminUsersDeleted.deletedCount}`)
    console.log(`Companies: ${companiesDeleted.deletedCount}`)
    console.log(`OnboardingTokens: ${onboardingTokensDeleted.deletedCount}`)
    console.log(`PendingRegistrations: ${pendingRegistrationsDeleted.deletedCount}`)
    console.log(`ResubmissionTokens: ${resubmissionTokensDeleted.deletedCount}`)
    console.log(`CompanyUsers: ${companyUsersDeleted.deletedCount}`)
    console.log(`PendingUserRegistrations: ${pendingUserRegistrationsDeleted.deletedCount}`)
    console.log(`UserApplications: ${userApplicationsDeleted.deletedCount}`)
    console.log(`UserOnboardingTokens: ${userOnboardingTokensDeleted.deletedCount}`)
    console.log(`UserResubmissionTokens: ${userResubmissionTokensDeleted.deletedCount}`)

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