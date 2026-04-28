import express, { type Express } from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { healthRouter } from './routes/health.js'
import { locationsRouter } from './routes/locations.js'
import { projectsRouter } from './routes/projects.js'
import { quotaRouter } from './routes/quota.js'
import { tariffRouter } from './routes/tariff.js'
import { errorHandler } from './middleware/errorHandler.js'
import { requestLogger } from './middleware/requestLogger.js'
import { env } from './config/env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const allowedOrigins = [env.FRONTEND_URL]
if (env.NODE_ENV === 'development') {
  const devDefault = 'http://localhost:5173'
  if (!allowedOrigins.includes(devDefault)) {
    allowedOrigins.push(devDefault)
  }
}

/**
 * Defines the app constant
 */
export const app: Express = express()

app.use(cors({ origin: allowedOrigins }))
app.use(express.json())
app.use(requestLogger)

app.use('/api/health', healthRouter)
app.use('/api/locations', locationsRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/quota', quotaRouter)
app.use('/api/tariff', tariffRouter)

// In production, serve the built frontend static files
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.resolve(__dirname, '../../frontend/dist')
  app.use(express.static(frontendDist))

  // Catch-all: send non-API requests to index.html for React Router
  app.get('{*path}', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
}

app.use(errorHandler)
