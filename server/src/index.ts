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
import { operatorDisruptionConfigRoutes } from './routes/operator-disruption-config.js'
import { operatorMessagingConfigRoutes } from './routes/operator-messaging-config.js'
import { operatorPairingConfigRoutes } from './routes/operator-pairing-config.js'
import { operatorSchedulingConfigRoutes } from './routes/operator-scheduling-config.js'
import { operatorHotacConfigRoutes } from './routes/operator-hotac-config.js'
import { asmSsmConsumerRoutes } from './routes/asm-ssm-consumers.js'
import { integrationPullRoutes } from './routes/integration-pull.js'
import { mlRoutes } from './routes/ml.js'
import { weatherRoutes } from './routes/weather.js'
import { feedRoutes } from './routes/feeds.js'
import { nonCrewPeopleRoutes } from './routes/non-crew-people.js'
import { crewRoutes } from './routes/crew.js'
import { crewDocumentsRoutes } from './routes/crew-documents.js'
import { ensureSystemFolders } from './services/ensure-crew-document-folders.js'
import { manpowerRoutes } from './routes/manpower.js'
import { pairingRoutes } from './routes/pairings.js'
import { crewScheduleRoutes } from './routes/crew-schedule.js'
import { autoRosterRoutes } from './routes/auto-roster.js'
import { crewHotelRoutes } from './routes/crew-hotels.js'
import { hotelBookingRoutes } from './routes/hotel-bookings.js'
import { hotelEmailRoutes } from './routes/hotel-emails.js'
import { crewTransportVendorRoutes } from './routes/crew-transport-vendors.js'
import { ensureManpowerBasePlan } from './services/ensure-manpower-base-plan.js'
import { startWeatherPoll } from './jobs/weather-poll.js'
import { startAutoTransmitScheduler } from './jobs/mvt-auto-transmit.js'
import { startAsmSsmDeliveryScheduler } from './jobs/asm-ssm-deliver.js'
import { startHotelEmailDeliveryScheduler } from './jobs/hotel-email-deliver.js'
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
    // Browser EventSource can't set Authorization header — accept ?token= on
    // SSE endpoints (e.g. /auto-roster/:runId/stream) as a fallback.
    // Note: this runs in onRequest where request.query isn't parsed yet,
    // so we parse the raw URL ourselves.
    verify: {
      extractToken: (request) => {
        const auth = request.headers.authorization
        if (auth?.startsWith('Bearer ')) return auth.slice(7)
        const qIdx = request.url.indexOf('?')
        if (qIdx >= 0) {
          const params = new URLSearchParams(request.url.slice(qIdx + 1))
          const tok = params.get('token')
          if (tok) return tok
        }
        return undefined
      },
    },
  })
  await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } }) // 20MB — covers crew documents (PDFs, scans)
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
  await app.register(operatorDisruptionConfigRoutes)
  await app.register(operatorMessagingConfigRoutes)
  await app.register(operatorPairingConfigRoutes)
  await app.register(operatorSchedulingConfigRoutes)
  await app.register(operatorHotacConfigRoutes)
  await app.register(asmSsmConsumerRoutes)
  await app.register(integrationPullRoutes)
  await app.register(mlRoutes)
  await app.register(weatherRoutes)
  await app.register(feedRoutes)
  await app.register(nonCrewPeopleRoutes)
  await app.register(crewRoutes)
  await app.register(crewDocumentsRoutes)
  await app.register(manpowerRoutes)
  await app.register(pairingRoutes)
  await app.register(crewScheduleRoutes)
  await app.register(autoRosterRoutes)
  await app.register(crewHotelRoutes)
  await app.register(hotelBookingRoutes)
  await app.register(hotelEmailRoutes)
  await app.register(crewTransportVendorRoutes)

  // ── Bootstrap: ensure every active operator has the 4 system document
  // folders (Crew Photos / Passports & Licenses / Medical Certificates /
  // Training Documents). Idempotent; safe to run on every boot.
  try {
    const { Operator: Op } = await import('./models/Operator.js')
    const operators = await Op.find({ isActive: { $ne: false } }, { _id: 1 }).lean()
    for (const op of operators) await ensureSystemFolders(op._id as string)
    console.log(`✓ Ensured system document folders for ${operators.length} operator(s)`)
    for (const op of operators) await ensureManpowerBasePlan(op._id as string)
    console.log(`✓ Ensured manpower base plans for ${operators.length} operator(s)`)
  } catch (e) {
    console.error('  ensureSystemFolders bootstrap error:', (e as Error).message)
  }

  // Lock SBY activity-code color to STBY-group orange (#f59e0b) so it matches
  // HSBY on the Gantt. Idempotent — runs every boot.
  try {
    const { ActivityCode } = await import('./models/ActivityCode.js')
    const res = await ActivityCode.updateMany(
      { code: 'SBY', isSystem: true, $or: [{ color: { $ne: '#f59e0b' } }, { color: null }] },
      { $set: { color: '#f59e0b', updatedAt: new Date().toISOString() } },
    )
    if (res.modifiedCount > 0) console.log(`✓ SBY color backfilled on ${res.modifiedCount} record(s)`)
  } catch (e) {
    console.error('  SBY color backfill error:', (e as Error).message)
  }

  // Start
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`✓ Server listening on port ${port}`)

  // Live weather polling — fetches METAR observations for monitored airports every ~15 min.
  startWeatherPoll()

  // Outbound auto-transmit scheduler — sweeps Held MVT/LDM per operator at their
  // configured cadence. Disable with ENABLE_AUTO_TRANSMIT=false.
  startAutoTransmitScheduler()

  // 7.1.5.1 ASM/SSM delivery worker — drains pending SMTP/SFTP deliveries.
  // pull_api deliveries are drained synchronously by the consumer's HTTP pull.
  // Disable with ENABLE_ASM_SSM_DELIVERY=false.
  startAsmSsmDeliveryScheduler()
  startHotelEmailDeliveryScheduler()

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
