/**
 * Seed AircraftCumulative + AircraftCheckStatus for all active aircraft registrations.
 * Creates realistic scattered data — each aircraft is at a different stage in its
 * maintenance cycle so forecast trigger dates spread across the calendar.
 *
 * Usage:  npx tsx src/seed-maintenance-events.ts
 *   --reset   Wipe existing data before seeding
 */
import 'dotenv/config'
import crypto from 'node:crypto'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { AircraftRegistration } from './models/AircraftRegistration.js'
import { AircraftCumulative } from './models/AircraftCumulative.js'
import { AircraftCheckStatus } from './models/AircraftCheckStatus.js'
import { MaintenanceCheckType } from './models/MaintenanceCheckType.js'
import { MaintenanceEvent } from './models/MaintenanceEvent.js'

// Dynamic operator resolution
let OPERATOR_ID = ''

const doReset = process.argv.includes('--reset')

async function seed() {
  await connectDB(env.MONGODB_URI)
  console.log('Seeding maintenance baseline data…')

  const { Operator } = await import('./models/Operator.js')
  const ops = await Operator.find({}).lean()
  if (ops.length === 0) {
    console.log('No operators found — cannot seed.')
    process.exit(1)
  }
  OPERATOR_ID = ops[0]._id as string
  console.log(`Operator: ${OPERATOR_ID} (${(ops[0] as Record<string, unknown>).name})`)

  const aircraft = await AircraftRegistration.find({ operatorId: OPERATOR_ID, isActive: true })
    .select('_id registration')
    .lean()

  if (aircraft.length === 0) {
    console.log('No active aircraft — skipping.')
    process.exit(0)
  }
  console.log(`Found ${aircraft.length} active aircraft`)

  if (doReset) {
    console.log('  Resetting existing maintenance seed data…')
    await AircraftCumulative.deleteMany({ operatorId: OPERATOR_ID })
    await AircraftCheckStatus.deleteMany({ operatorId: OPERATOR_ID })
    await MaintenanceEvent.deleteMany({ operatorId: OPERATOR_ID, source: 'auto_proposed' })
    console.log('  Reset complete')
  }

  const now = new Date().toISOString()

  // ── Seed AircraftCumulative ──
  const existingCum = await AircraftCumulative.find({ operatorId: OPERATOR_ID }).select('aircraftId').lean()
  const existingCumIds = new Set(existingCum.map((c) => c.aircraftId))

  const cumDocs = []
  for (let i = 0; i < aircraft.length; i++) {
    const ac = aircraft[i]
    if (existingCumIds.has(ac._id)) continue

    // Each aircraft has different total hours based on fleet position
    // Spread from 5000h (newer) to 35000h (older) across the fleet
    const ageFraction = i / aircraft.length
    const baseHours = 5000 + ageFraction * 30000 + (Math.random() - 0.5) * 3000
    const baseCycles = Math.floor(baseHours * (0.5 + Math.random() * 0.2))
    // Daily utilization varies: 5–12 hours/day
    const avgDailyH = 5 + Math.random() * 7
    const avgDailyC = Math.round(avgDailyH * (0.4 + Math.random() * 0.2) * 10) / 10

    const anchorDaysAgo = 30 + Math.floor(Math.random() * 335)
    const anchorDate = new Date(Date.now() - anchorDaysAgo * 86400000).toISOString().slice(0, 10)

    cumDocs.push({
      _id: crypto.randomUUID(),
      operatorId: OPERATOR_ID,
      aircraftId: ac._id,
      totalFlightHours: Math.round(baseHours * 10) / 10,
      totalCycles: baseCycles,
      totalBlockHours: Math.round(baseHours * 1.05 * 10) / 10,
      todayFlightHours: 0,
      todayCycles: 0,
      avgDailyFlightHours: Math.round(avgDailyH * 10) / 10,
      avgDailyCycles: avgDailyC,
      anchorDate,
      anchorFlightHours: Math.round((baseHours - anchorDaysAgo * avgDailyH) * 10) / 10,
      anchorCycles: Math.round(baseCycles - anchorDaysAgo * avgDailyC),
      createdAt: now,
    })
  }

  if (cumDocs.length > 0) {
    await AircraftCumulative.insertMany(cumDocs)
    console.log(`  Inserted ${cumDocs.length} AircraftCumulative documents`)
  } else {
    console.log('  AircraftCumulative already seeded')
  }

  // ── Seed AircraftCheckStatus ──
  const checkTypes = await MaintenanceCheckType.find({ operatorId: OPERATOR_ID, isActive: true }).lean()
  const LINE_CHECKS = new Set(['TR', 'DY', 'WK'])
  const significantChecks = checkTypes.filter((ct) => !LINE_CHECKS.has(ct.code))

  const existingCS = await AircraftCheckStatus.find({ operatorId: OPERATOR_ID }).select('aircraftId checkTypeId').lean()
  const existingCSKeys = new Set(existingCS.map((c) => `${c.aircraftId}:${c.checkTypeId}`))

  const allCum = await AircraftCumulative.find({ operatorId: OPERATOR_ID }).lean()
  const cumMap = new Map(allCum.map((c) => [c.aircraftId, c]))

  const csDocs = []
  for (let acIdx = 0; acIdx < aircraft.length; acIdx++) {
    const ac = aircraft[acIdx]
    const cum = cumMap.get(ac._id)
    if (!cum) continue

    for (const ct of significantChecks) {
      const key = `${ac._id}:${ct._id}`
      if (existingCSKeys.has(key)) continue

      const hoursInterval = ct.defaultHoursInterval
      const cyclesInterval = ct.defaultCyclesInterval
      const daysInterval = ct.defaultDaysInterval

      // KEY FIX: Spread each aircraft across the FULL interval range (5–95%)
      // Use a hash-like distribution so different check types on the same aircraft
      // are at different stages independently
      const seed = (acIdx * 7 + significantChecks.indexOf(ct) * 13 + 37) % 100
      const intervalFraction = 0.05 + (seed / 100) * 0.9 // 5% to 95% through interval

      const lastCheckHours = hoursInterval
        ? Math.round((cum.totalFlightHours - hoursInterval * intervalFraction) * 10) / 10
        : null
      const lastCheckCycles = cyclesInterval ? Math.round(cum.totalCycles - cyclesInterval * intervalFraction) : null

      // Last check date: scattered across the interval
      const daysAgo = daysInterval
        ? Math.floor(daysInterval * intervalFraction)
        : Math.floor(30 + intervalFraction * 300)
      const lastCheckDate = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10)

      // Remaining
      const remH =
        hoursInterval && lastCheckHours != null
          ? Math.max(0, hoursInterval - (cum.totalFlightHours - lastCheckHours))
          : null
      const remC =
        cyclesInterval && lastCheckCycles != null
          ? Math.max(0, cyclesInterval - (cum.totalCycles - lastCheckCycles))
          : null
      const remD = daysInterval ? Math.max(0, daysInterval - daysAgo) : null

      csDocs.push({
        _id: crypto.randomUUID(),
        operatorId: OPERATOR_ID,
        aircraftId: ac._id,
        checkTypeId: ct._id,
        lastCheckDate,
        lastCheckHours,
        lastCheckCycles,
        remainingHours: remH != null ? Math.round(remH * 10) / 10 : null,
        remainingCycles: remC != null ? Math.round(remC) : null,
        remainingDays: remD,
        forecastDueDate: null,
        forecastDueTrigger: null,
        isDeferred: false,
        status: 'active',
        createdAt: now,
      })
    }
  }

  if (csDocs.length > 0) {
    for (let i = 0; i < csDocs.length; i += 500) {
      await AircraftCheckStatus.insertMany(csDocs.slice(i, i + 500))
    }
    console.log(`  Inserted ${csDocs.length} AircraftCheckStatus documents`)
  } else {
    console.log('  AircraftCheckStatus already seeded')
  }

  console.log('Done.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
