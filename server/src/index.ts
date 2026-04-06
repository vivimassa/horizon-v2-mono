import 'dotenv/config'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { connectDB } from './db/connection.js'
import { flightRoutes } from './routes/flights.js'
import { referenceRoutes } from './routes/reference.js'
import { userRoutes } from './routes/users.js'
import { cityPairRoutes } from './routes/city-pairs.js'
import { fdtlRoutes } from './routes/fdtl.js'
import { scheduledFlightRoutes } from './routes/scheduled-flights.js'
import { ssimRoutes } from './routes/ssim.js'
import { scenarioRoutes } from './routes/scenarios.js'
import { scheduleMessageRoutes } from './routes/schedule-messages.js'
import { loadOurAirportsData, startAutoRefresh } from './data/ourairports-cache.js'

const port = Number(process.env.PORT) || 3001

async function main(): Promise<void> {
  const app = Fastify({ logger: true })

  // Ensure uploads directory exists
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const uploadsDir = path.resolve(__dirname, '..', 'uploads')
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

  // Plugins
  await app.register(cors, { origin: true })
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
  })
  await app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024 } }) // 2MB
  await app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: '/uploads/',
    decorateReply: false,
  })

  // Database
  await connectDB()

  // OurAirports reference data cache
  console.log('Loading OurAirports reference data…')
  await loadOurAirportsData()
  startAutoRefresh()

  // Health check
  app.get('/health', async () => ({ status: 'ok' }))

  // Routes
  await app.register(flightRoutes)
  await app.register(referenceRoutes)
  await app.register(userRoutes)
  await app.register(cityPairRoutes)
  await app.register(fdtlRoutes)
  await app.register(scheduledFlightRoutes)
  await app.register(ssimRoutes)
  await app.register(scenarioRoutes)
  await app.register(scheduleMessageRoutes)

  // Start
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`✓ Server listening on port ${port}`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
