import express, { type Express } from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { healthRouter } from './routes/health.js'
import { locationsRouter } from './routes/locations.js'
import { projectsRouter } from './routes/projects.js'
import { chatRouter } from './routes/chat.js'
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
 * Configured Express app — CORS, JSON body parsing, request logging, all `/api/*` routers,
 * and (in production) a static + SPA-fallback handler for the built frontend.
 * The error middleware is registered last so it catches errors from every prior layer.
 */
export const app: Express = express()

app.use(cors({ origin: allowedOrigins }))
app.use(express.json())
app.use(requestLogger)

app.use('/api/health', healthRouter)
app.use('/api/locations', locationsRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/projects', chatRouter)
app.use('/api/quota', quotaRouter)
app.use('/api/tariff', tariffRouter)

// In production, serve the built frontend static files
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.resolve(__dirname, '../../frontend/dist')
  app.use(express.static(frontendDist))

  // Catch-all: send non-API requests to index.html for React Router. Skip
  // /assets/* so a stale asset URL after a deploy returns 404 instead of HTML
  // (otherwise the browser tries to execute index.html as JS and silently breaks).
  app.get('{*path}', (req, res, next) => {
    if (req.path.startsWith('/assets/')) return next()
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
}

app.use(errorHandler)
