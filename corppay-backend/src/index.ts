import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import helmet from 'helmet'
import mongoose from 'mongoose'
import adminRoutes from './routes/admin_route'
import authRoutes from './routes/auth_route'
import companyRoutes from './routes/company_route'
import onboardingRoutes from './routes/onboarding_route'
import portalRoutes from './routes/portal_route'
import resubmitRoutes from './routes/resubmit_route'
import userOnboardingRoutes from './routes/user_onboarding_route'
import userResubmitRoutes from './routes/user_resubmit_route'
import userRoutes from './routes/user_route'

dotenv.config()

const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json())
app.use('/auth', authRoutes)
app.use('/companies', companyRoutes)
app.use('/admin/review', adminRoutes)   
app.use('/onboarding', onboardingRoutes)
app.use('/resubmit', resubmitRoutes)
app.use('/users', userRoutes)
app.use('/user-onboarding', userOnboardingRoutes)
app.use('/user-resubmit', userResubmitRoutes)
app.use('/portal', portalRoutes)


app.get('/', (request, response) =>
{
    response.json({ message: 'Corppay API running 🚀' })
})

const PORT = process.env.PORT || 5000

async function startServer()
{
    try
    {
        await mongoose.connect(process.env.MONGODB_URI as string)

        console.log('✅ MongoDB connected')

        app.listen(PORT, () =>
        {
            console.log(`🚀 Server running on http://localhost:${PORT}`)
        })
    }
    catch (error)
    {
        console.error('❌ Failed to start server:', error)
        process.exit(1)
    }
}

startServer()