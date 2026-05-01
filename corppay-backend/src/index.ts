import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import helmet from 'helmet'
import mongoose from 'mongoose'
import authRoutes from './routes/auth_routes'
import companyRoutes from './routes/company_routes'

dotenv.config()

const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json())
app.use('/auth', authRoutes)
app.use('/companies', companyRoutes)

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