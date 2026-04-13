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

  // ── Seed MaintenanceEvent documents ──
  // Strategically place grounding events so 3-4 aircraft are unavailable daily
  await seedMaintenanceEvents(aircraft, checkTypes)

  console.log('Done.')
  process.exit(0)
}

/**
 * Seed MaintenanceEvent documents with strategic placement:
 * On any given day, 3-4 aircraft out of 100 are grounded for maintenance.
 *
 * Strategy:
 * - 180-day window: 90 days past → 90 days future from today
 * - Day-by-day fill algorithm: if grounded count < target, start a new event
 * - Realistic check type mix weighted by frequency
 * - Events distributed across 4 Vietnamese bases (VVTS primary)
 * - Past events → completed, current → in_progress, future → planned/confirmed
 */
async function seedMaintenanceEvents(
  aircraft: Array<{ _id: unknown; registration: unknown }>,
  allCheckTypes: Array<{
    _id: unknown
    code: string
    defaultDurationHours: number
    requiresGrounding: boolean
    defaultStation?: string | null
  }>,
) {
  if (doReset) {
    await MaintenanceEvent.deleteMany({ operatorId: OPERATOR_ID })
    console.log('  Cleared existing MaintenanceEvent documents')
  }

  const existing = await MaintenanceEvent.countDocuments({ operatorId: OPERATOR_ID })
  if (existing > 0 && !doReset) {
    console.log(`  MaintenanceEvents already seeded (${existing} docs) — skipping`)
    return
  }

  const NOW = Date.now()
  const DAY_MS = 86_400_000
  const WINDOW_PAST_DAYS = 90
  const WINDOW_FUTURE_DAYS = 90
  const TOTAL_DAYS = WINDOW_PAST_DAYS + WINDOW_FUTURE_DAYS
  const windowStartMs = NOW - WINDOW_PAST_DAYS * DAY_MS

  // Target: 3-4 grounded per day → average 3.5
  const TARGET_MIN = 3
  const TARGET_MAX = 4

  // Only grounding checks, exclude line checks (TR/DY/WK) and non-grounding (EWW/BSI)
  const groundingChecks = allCheckTypes.filter((ct) => ct.requiresGrounding && !['TR', 'DY', 'WK'].includes(ct.code))

  // Weighted check type selection — more frequent short checks, rare heavy checks
  // This produces a realistic maintenance schedule
  const checkWeights: Array<{ code: string; weight: number; durationDays: number }> = [
    { code: '1A', weight: 40, durationDays: 1 }, // A1: 24h = 1 day, very frequent
    { code: '2A', weight: 20, durationDays: 2 }, // A2: 48h = 2 days
    { code: '4A', weight: 10, durationDays: 3 }, // A4: 72h = 3 days
    { code: '1C', weight: 5, durationDays: 7 }, // C1: 168h = 7 days
    { code: '2C', weight: 2, durationDays: 14 }, // C2: 336h = 14 days
    { code: 'LG', weight: 3, durationDays: 10 }, // Landing gear: 10 days
    { code: 'APU', weight: 3, durationDays: 20 }, // APU: 20 days
    { code: 'CSI', weight: 2, durationDays: 2 }, // Composite: 2 days (A350/A380 only)
    { code: 'ENG', weight: 2, durationDays: 30 }, // Engine shop visit: 30 days
  ]

  // Build lookup: code → check type doc
  const checkByCode = new Map(groundingChecks.map((ct) => [ct.code, ct]))

  // Filter to only codes that exist in the database
  const availableWeights = checkWeights.filter((w) => checkByCode.has(w.code))
  const totalWeight = availableWeights.reduce((sum, w) => sum + w.weight, 0)

  // Bases with realistic distribution (SGN is primary MRO hub)
  const BASES = [
    { icao: 'VVTS', weight: 50 }, // Ho Chi Minh City — main MRO
    { icao: 'VVNB', weight: 30 }, // Hanoi — secondary
    { icao: 'VVDN', weight: 12 }, // Da Nang — light maintenance
    { icao: 'VVCR', weight: 8 }, // Cam Ranh — light maintenance
  ]
  const totalBaseWeight = BASES.reduce((sum, b) => sum + b.weight, 0)

  // Seeded PRNG for reproducible results
  let prngState = 42
  function nextRandom(): number {
    prngState = (prngState * 1664525 + 1013904223) & 0x7fffffff
    return prngState / 0x7fffffff
  }

  function pickWeighted<T extends { weight: number }>(items: T[]): T {
    const total = items.reduce((s, i) => s + i.weight, 0)
    let r = nextRandom() * total
    for (const item of items) {
      r -= item.weight
      if (r <= 0) return item
    }
    return items[items.length - 1]
  }

  // Track which aircraft are grounded on which days
  // grounded[dayIndex] = Set of aircraft indices currently grounded
  const aircraftEvents: Array<{ startDay: number; endDay: number; acIdx: number }> = []

  function groundedOnDay(day: number): number {
    let count = 0
    for (const ev of aircraftEvents) {
      if (day >= ev.startDay && day < ev.endDay) count++
    }
    return count
  }

  function isAircraftGroundedOnDay(acIdx: number, day: number): boolean {
    for (const ev of aircraftEvents) {
      if (ev.acIdx === acIdx && day >= ev.startDay && day < ev.endDay) return true
    }
    return false
  }

  // Fill algorithm: iterate each day, maintain 3-4 grounded
  const events: Array<{
    acIdx: number
    startDay: number
    durationDays: number
    checkCode: string
    base: string
  }> = []

  for (let day = 0; day < TOTAL_DAYS; day++) {
    const currentGrounded = groundedOnDay(day)

    // Oscillate target between 3 and 4 to create natural variation
    const target = day % 7 < 4 ? TARGET_MAX : TARGET_MIN

    if (currentGrounded < target) {
      const needed = target - currentGrounded

      for (let n = 0; n < needed; n++) {
        // Pick a check type
        const checkInfo = pickWeighted(availableWeights)
        const durationDays = checkInfo.durationDays

        // Don't start events that extend too far beyond the window
        if (day + durationDays > TOTAL_DAYS + 30) continue

        // Pick an aircraft that's not already grounded
        const startIdx = Math.floor(nextRandom() * aircraft.length)
        let acIdx = -1
        for (let attempt = 0; attempt < aircraft.length; attempt++) {
          const candidate = (startIdx + attempt) % aircraft.length
          if (!isAircraftGroundedOnDay(candidate, day)) {
            acIdx = candidate
            break
          }
        }
        if (acIdx === -1) continue // all grounded (shouldn't happen with 100 aircraft)

        // Pick a base (heavy checks → VVTS, lighter → distributed)
        let base: string
        if (['1C', '2C', '4C', '6Y', '12Y', 'ENG', 'APU'].includes(checkInfo.code)) {
          base = 'VVTS' // Heavy maintenance always at SGN
        } else {
          base = pickWeighted(BASES).icao
        }

        aircraftEvents.push({ startDay: day, endDay: day + durationDays, acIdx })
        events.push({ acIdx, startDay: day, durationDays, checkCode: checkInfo.code, base })
      }
    }
  }

  // Convert to MaintenanceEvent documents
  const eventDocs = []
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayMs = today.getTime()

  for (const ev of events) {
    const ac = aircraft[ev.acIdx]
    const ct = checkByCode.get(ev.checkCode)
    if (!ct) continue

    const startMs = windowStartMs + ev.startDay * DAY_MS
    // Start at a realistic time: 18:00 UTC (01:00 local Vietnam) for overnight
    const startDate = new Date(startMs)
    startDate.setUTCHours(18, 0, 0, 0)
    const plannedStartUtc = startDate.toISOString()

    const endDate = new Date(startMs + ev.durationDays * DAY_MS)
    endDate.setUTCHours(6, 0, 0, 0) // End at 06:00 UTC (13:00 local)
    const plannedEndUtc = endDate.toISOString()

    // Determine status based on timing relative to today
    const startDayMs = startDate.getTime()
    const endDayMs = endDate.getTime()
    let status: string
    let phase: string
    let actualStartUtc: string | null = null
    let actualEndUtc: string | null = null

    if (endDayMs < todayMs) {
      // Fully in the past → completed
      status = 'completed'
      phase = 'return_to_flight'
      actualStartUtc = plannedStartUtc
      // Actual end: slight variation from planned (-6h to +12h)
      const variance = Math.floor((nextRandom() - 0.3) * 12 * 3600000)
      actualEndUtc = new Date(endDayMs + variance).toISOString()
    } else if (startDayMs <= todayMs && endDayMs >= todayMs) {
      // Currently active → in_progress
      status = 'in_progress'
      // Phase depends on how far through we are
      const elapsed = (todayMs - startDayMs) / (endDayMs - startDayMs)
      if (elapsed < 0.15) phase = 'arrived'
      else if (elapsed < 0.3) phase = 'inducted'
      else if (elapsed < 0.75) phase = 'in_work'
      else if (elapsed < 0.9) phase = 'qa'
      else phase = 'released'
      actualStartUtc = plannedStartUtc
    } else if (startDayMs - todayMs < 14 * DAY_MS) {
      // Within 2 weeks → confirmed
      status = 'confirmed'
      phase = 'planned'
    } else {
      // Further out → planned
      status = 'planned'
      phase = 'planned'
    }

    eventDocs.push({
      _id: crypto.randomUUID(),
      operatorId: OPERATOR_ID,
      aircraftId: ac._id,
      checkTypeId: ct._id,
      plannedStartUtc,
      plannedEndUtc,
      actualStartUtc,
      actualEndUtc,
      station: ev.base,
      hangar: status === 'in_progress' || status === 'completed' ? `H${Math.floor(nextRandom() * 4) + 1}` : null,
      status,
      phase,
      phaseUpdatedAtUtc: status !== 'planned' ? new Date(startMs).toISOString() : null,
      source: 'manual',
      completionHours:
        status === 'completed' ? Math.round(ev.durationDays * 12 + nextRandom() * ev.durationDays * 6) : null,
      completionCycles: null,
      workItems: null,
      notes: null,
      createdBy: 'seed',
      createdAt: new Date(startMs - 7 * DAY_MS).toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  // Insert in batches
  if (eventDocs.length > 0) {
    for (let i = 0; i < eventDocs.length; i += 500) {
      await MaintenanceEvent.insertMany(eventDocs.slice(i, i + 500))
    }
  }

  // Print daily grounding stats
  const dailyCounts: number[] = []
  for (let day = 0; day < TOTAL_DAYS; day++) {
    dailyCounts.push(groundedOnDay(day))
  }
  const avg = dailyCounts.reduce((s, c) => s + c, 0) / dailyCounts.length
  const min = Math.min(...dailyCounts)
  const max = Math.max(...dailyCounts)

  console.log(`  Inserted ${eventDocs.length} MaintenanceEvent documents`)
  console.log(`  Daily grounding stats over ${TOTAL_DAYS} days:`)
  console.log(`    Average: ${avg.toFixed(1)} aircraft/day`)
  console.log(`    Min: ${min}, Max: ${max}`)
  console.log(`    Target: ${TARGET_MIN}-${TARGET_MAX} (3-4% of 100 fleet)`)

  // Show today's snapshot
  const todayDay = WINDOW_PAST_DAYS
  const todayGrounded = events
    .filter((ev) => todayDay >= ev.startDay && todayDay < ev.startDay + ev.durationDays)
    .map((ev) => ({
      reg: (aircraft[ev.acIdx] as Record<string, unknown>).registration,
      check: ev.checkCode,
      base: ev.base,
      daysLeft: ev.startDay + ev.durationDays - todayDay,
    }))
  console.log(`  Today's grounded aircraft (${todayGrounded.length}):`)
  for (const g of todayGrounded) {
    console.log(`    ${g.reg} — ${g.check} at ${g.base} (${g.daysLeft} day(s) remaining)`)
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
