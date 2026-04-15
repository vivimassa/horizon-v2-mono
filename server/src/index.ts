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
import { ssimImportRoutes } from './routes/ssim-import.js'
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
import { maintenanceEventRoutes } from './routes/maintenance-events.js'
import { aircraftStatusBoardRoutes } from './routes/aircraft-status-board.js'
import { contactSubmissionRoutes } from './routes/contact-submissions.js'
import { worldMapRoutes } from './routes/world-map.js'
import { disruptionRoutes } from './routes/disruptions.js'
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
  await app.register(ssimImportRoutes)
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
  await app.register(maintenanceEventRoutes)
  await app.register(aircraftStatusBoardRoutes)
  await app.register(contactSubmissionRoutes)
  await app.register(worldMapRoutes)
  await app.register(disruptionRoutes)

  // Start
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`✓ Server listening on port ${port}`)

  // ── OOOI Simulation — seed actual times on startup + every 15 minutes ──
  const OOOI_SIM_INTERVAL = 15 * 60_000 // 15 minutes
  const OOOI_SIM_ENABLED = process.env.OOOI_SIM !== 'false' // enabled by default, set OOOI_SIM=false to disable

  if (OOOI_SIM_ENABLED) {
    // Dynamically discover all active operators for seeding
    const { Operator } = await import('./models/Operator.js')

    const seedOooiForOperator = async (operatorId: string, from: string, to: string, forceReseed = false) => {
      try {
        const res = await app.inject({
          method: 'POST',
          url: '/gantt/seed-oooi',
          headers: { 'content-type': 'application/json', 'x-internal': 'true' },
          payload: JSON.stringify({ operatorId, from, to, otpTarget: 0.85, forceReseed }),
        })
        const result = JSON.parse(res.body)
        const parts: string[] = []
        if (result.cleared) parts.push(`cleared=${result.cleared}`)
        if (result.created) parts.push(`created=${result.created}`)
        if (result.alreadySeeded) parts.push(`existing=${result.alreadySeeded}`)
        if (result.skipped) parts.push(`future=${result.skipped}`)
        if (result.repaired) parts.push(`repaired=${result.repaired}`)
        if (result.progressed) parts.push(`progressed=${result.progressed}`)
        if (result.dateSkipped) parts.push(`dateSkipped=${result.dateSkipped}`)
        const detail = parts.length > 0 ? parts.join(', ') : 'no eligible flights'
        console.log(
          `  OOOI sim [${operatorId}] ${from} → ${to}: ${detail} (${result.scheduledFlightCount ?? 0} patterns)`,
        )
      } catch (e) {
        console.error(`  OOOI sim error [${operatorId}]:`, (e as Error).message)
      }
    }

    const runOooiSeed = async (from?: string, to?: string, forceReseed = false) => {
      try {
        const now = new Date()
        const today = now.toISOString().slice(0, 10)
        // Always include yesterday to catch flights that departed late in the day
        const yesterday = new Date(now.getTime() - DAY_MS).toISOString().slice(0, 10)
        const seedFrom = from ?? yesterday
        const seedTo = to ?? today

        const operators = await Operator.find({ isActive: { $ne: false } }, { _id: 1 }).lean()
        if (operators.length === 0) {
          console.warn('  OOOI sim: no active operators found — skipping')
          return
        }

        for (const op of operators) {
          await seedOooiForOperator(op._id as string, seedFrom, seedTo, forceReseed)
        }
      } catch (e) {
        console.error('  OOOI sim tick error:', (e as Error).message)
      }
    }

    // Seed immediately on startup — backfill last 3 days (incremental, no force)
    console.log('✓ OOOI simulation enabled (startup backfill + every 15 min)')
    const DAY_MS = 86_400_000
    const now = new Date()
    const threeDaysAgo = new Date(now.getTime() - 3 * DAY_MS).toISOString().slice(0, 10)
    const today = now.toISOString().slice(0, 10)
    await runOooiSeed(threeDaysAgo, today)

    // Then continue every 15 minutes (yesterday + today each tick)
    setInterval(() => {
      runOooiSeed().catch((e) => console.error('  OOOI sim interval error:', e))
    }, OOOI_SIM_INTERVAL)
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
