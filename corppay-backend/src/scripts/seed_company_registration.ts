import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import Company from '../models/Company'
import User from '../models/User'

async function seed()
{
  try
  {
    console.log('🔌 Connecting to:', process.env.MONGODB_URI)
    await mongoose.connect(process.env.MONGODB_URI as string)
    console.log('✅ Connected DB:', mongoose.connection.name)

    const user = await User.findOne({ email: 'tc.pan@corppay.com' })

    if (!user)
    {
      throw new Error(
        'Seed user not found. Run seed_user.ts first to create tc.pan@corppay.com.'
      )
    }

    await Company.deleteOne({ ssmNumber: 'MOCK202301234567' })

    const company = await Company.create({
      name: 'CorpPay Sdn Bhd',
      ssmNumber: 'MOCK202301234567',
      entityType: 'sdn_bhd',
      registeredAddress: 'Unit 12-3, Menara CorpPay, Jalan Sultan Ismail, 50250 Kuala Lumpur, Malaysia',
      director: {
        icPassport: '850101-14-1234',
        role: 'director',
        ownershipPct: 100,
      },
      documents: [
        {
          fieldName: 'ssm_cert',
          originalName: 'ssm_certificate.pdf',
          storagePath: 'uploads/mock-ssm-cert.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 102400,
          uploadedAt: new Date(),
        },
        {
          fieldName: 'director_ic',
          originalName: 'director_ic.pdf',
          storagePath: 'uploads/mock-director-ic.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 51200,
          uploadedAt: new Date(),
        },
      ],
      status: 'pending',
      submittedBy: 'anonymous',
    })

    console.log('\n🏢 Company created:')
    console.log(JSON.stringify(company.toObject(), null, 2))

    const allCompanies = await Company.find()
    console.log(`\n📋 Total companies in DB: ${allCompanies.length}`)
    allCompanies.forEach((c, i) =>
      console.log(`  [${i + 1}] ${c.name} (${c.ssmNumber}) — status: ${c.status}`)
    )
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

seed()