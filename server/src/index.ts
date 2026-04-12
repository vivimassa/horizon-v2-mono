import 'dotenv/config'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { connectDB } from './db/connection.js'
import { registerAuthMiddleware } from './middleware/authenticate.js'
import { authRoutes } from './routes/auth.js'
import { flightRoutes } from './routes/flights.js'
import { referenceRoutes } from './routes/reference.js'
import { userRoutes } from './routes/users.js'
import { cityPairRoutes } from './routes/city-pairs.js'
import { fdtlRoutes } from './routes/fdtl.js'
import { scheduledFlightRoutes } from './routes/scheduled-flights.js'
import { ssimRoutes } from './routes/ssim.js'
import { scenarioRoutes } from './routes/scenarios.js'
import { scheduleMessageRoutes } from './routes/schedule-messages.js'
import { movementMessageRoutes } from './routes/movement-messages.js'
import { rotationRoutes } from './routes/rotations.js'
import { ganttRoutes } from './routes/gantt.js'
import { slotRoutes } from './routes/slots.js'
import { codeshareRoutes } from './routes/codeshare.js'
import { charterRoutes } from './routes/charter.js'
import { recoveryRoutes } from './routes/recovery.js'
import { maintenanceCheckRoutes } from './routes/maintenance-checks.js'
import { loadOurAirportsData, startAutoRefresh } from './data/ourairports-cache.js'

const port = env.PORT

async function main(): Promise<void> {
  const app = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024 /* 10MB */ })

  // Ensure uploads directory exists
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const uploadsDir = path.resolve(__dirname, '..', 'uploads')
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

  // Plugins
  await app.register(cors, { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN })
  await app.register(jwt, {
    secret: env.JWT_SECRET,
  })
  await app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024 } }) // 2MB
  await app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: '/uploads/',
    decorateReply: false,
  })

  // Auth middleware — runs before every request, gates everything except PUBLIC_PATHS
  registerAuthMiddleware(app)

  // Database
  await connectDB(env.MONGODB_URI)

  // OurAirports reference data cache
  console.log('Loading OurAirports reference data…')
  await loadOurAirportsData()
  startAutoRefresh()

  // Health check
  app.get('/health', async () => ({ status: 'ok' }))

  // Routes
  await app.register(authRoutes)
  await app.register(flightRoutes)
  await app.register(referenceRoutes)
  await app.register(userRoutes)
  await app.register(cityPairRoutes)
  await app.register(fdtlRoutes)
  await app.register(scheduledFlightRoutes)
  await app.register(ssimRoutes)
  await app.register(scenarioRoutes)
  await app.register(scheduleMessageRoutes)
  await app.register(movementMessageRoutes)
  await app.register(rotationRoutes)
  await app.register(ganttRoutes)
  await app.register(slotRoutes)
  await app.register(codeshareRoutes)
  await app.register(charterRoutes)
  await app.register(recoveryRoutes)
  await app.register(maintenanceCheckRoutes)

  // Start
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`✓ Server listening on port ${port}`)

  // ── OOOI Simulation — seed actual times on startup + every 15 minutes ──
  const OOOI_SIM_INTERVAL = 15 * 60_000 // 15 minutes
  const OOOI_SIM_ENABLED = process.env.OOOI_SIM !== 'false' // enabled by default, set OOOI_SIM=false to disable

  if (OOOI_SIM_ENABLED) {
    const seedOooi = async (from?: string, to?: string) => {
      try {
        const today = new Date().toISOString().slice(0, 10)
        const res = await app.inject({
          method: 'POST',
          url: '/gantt/seed-oooi',
          headers: { 'content-type': 'application/json', 'x-internal': 'true' },
          payload: JSON.stringify({ operatorId: 'horizon', from: from ?? today, to: to ?? today, otpTarget: 0.85 }),
        })
        const result = JSON.parse(res.body)
        if (result.created) {
          console.log(`  OOOI sim: seeded ${result.created} flights (${from ?? today} → ${to ?? today})`)
        }
      } catch (e) {
        console.error('  OOOI sim error:', (e as Error).message)
      }
    }

    // Seed immediately on startup — backfill last 3 days to catch up after restarts
    console.log('✓ OOOI simulation enabled (startup + every 15 min)')
    const now = new Date()
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60_000).toISOString().slice(0, 10)
    const today = now.toISOString().slice(0, 10)
    await seedOooi(threeDaysAgo, today)

    // Then continue every 15 minutes
    setInterval(seedOooi, OOOI_SIM_INTERVAL)
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
