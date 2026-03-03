import express from 'express'
import cors from 'cors'
import { healthRouter } from './routes/health.js'
import { locationsRouter } from './routes/locations.js'
import { projectsRouter } from './routes/projects.js'
import { tariffRouter } from './routes/tariff.js'
import { errorHandler } from './middleware/errorHandler.js'

export const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/health', healthRouter)
app.use('/api/locations', locationsRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/tariff', tariffRouter)

app.use(errorHandler)
