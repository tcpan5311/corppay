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

dotenv.config()

// Fail fast if any required secret is missing — never start with insecure defaults.
const REQUIRED_ENV = [
	'JWT_ACCESS_SECRET',
	'JWT_REFRESH_SECRET',
	'ADMIN_REVIEW_TOKEN',
	'ADMIN_SESSION_SECRET',
	'ADMIN_TOTP_SECRET',
	'MONGODB_URI',
]
for (const key of REQUIRED_ENV)
{
	const value = process.env[key]
	if (value === undefined || value.trim() === '')
	{
		console.error(`❌ Missing required environment variable: ${key}`)
		process.exit(1)
	}
}

// Comma-separated allowlist of permitted web origins.
const rawAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS
const allowedOriginsValue = rawAllowedOrigins === undefined ? '' : rawAllowedOrigins
const ALLOWED_ORIGINS = allowedOriginsValue
	.split(',')
	.map((o) => o.trim())
	.filter((o) => o !== '')

const app = express()

// Trust the first proxy hop so req.ip reflects the real client behind a load balancer/CDN.
app.set('trust proxy', 1)

app.use(helmet())
app.use(cors({
	origin: (origin, callback) =>
	{
		// Allow non-browser clients (no Origin header) and any explicitly allow-listed origin.
		if (origin === undefined || ALLOWED_ORIGINS.includes(origin))
		{
			callback(null, true)
			return
		}
		callback(new Error('Origin not allowed by CORS policy.'))
	},
}))

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

// Returns a JSON 404 for any route no handler above matched.
app.use((request, response) =>
{
	response.status(404).json({ error: 'Not found' })
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