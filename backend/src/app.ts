import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { healthRouter } from './routes/health.js'
import { locationsRouter } from './routes/locations.js'
import { projectsRouter } from './routes/projects.js'
import { tariffRouter } from './routes/tariff.js'
import { errorHandler } from './middleware/errorHandler.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/health', healthRouter)
app.use('/api/locations', locationsRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/tariff', tariffRouter)

// In production, serve the built frontend static files
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.resolve(__dirname, '../../frontend/dist')
  app.use(express.static(frontendDist))

  // Catch-all: send non-API requests to index.html for React Router
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
}

app.use(errorHandler)
