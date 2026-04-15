/**
 * Smart backfill of actual times for past flights.
 *
 * Rules:
 *  1. Per-aircraft chain delay: next flight's ATD cannot start before
 *     previous flight's ATA + minimum turnaround.
 *  2. No overlap within the same aircraft registration.
 *  3. Only backfill flights whose STD is already in the past and that are
 *     still missing atdUtc. Flights still in the future are left alone.
 *
 * Usage: npx tsx src/seed-smart-actuals.ts [--reset] [--from=YYYY-MM-DD] [--operator=horizon] [--dry]
 */
import 'dotenv/config'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import mongoose from 'mongoose'
import { FlightInstance } from './models/FlightInstance.js'

const args = process.argv.slice(2)
const getArg = (name: string, fallback?: string) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=')[1] : fallback
}

const OPERATOR_ID = getArg('operator', 'horizon')!
const FROM_DATE = getArg('from', '2026-04-13')! // inclusive
const RESET = args.includes('--reset')
const DRY = args.includes('--dry')

const MIN_TURNAROUND_MS = 35 * 60 * 1000 // narrowbody minimum turn
const MINUTE = 60 * 1000

// Realistic delay distribution (minutes of *independent* delay on top of chain delay)
function sampleIndependentDelayMinutes(): number {
  const r = Math.random()
  if (r < 0.6) return 0
  if (r < 0.82) return 5 + Math.floor(Math.random() * 10) // 5-14
  if (r < 0.94) return 15 + Math.floor(Math.random() * 15) // 15-29
  if (r < 0.99) return 30 + Math.floor(Math.random() * 30) // 30-59
  return 60 + Math.floor(Math.random() * 45) // 60-104
}

// Small variance on the enroute block time (+/- a few minutes)
function sampleBlockVarianceMs(): number {
  return Math.round((Math.random() * 10 - 3) * MINUTE) // -3 to +7 min bias late
}

const INDEPENDENT_CODES = ['11', '17', '41', '71', '89']
function pickIndependentCode(): string {
  return INDEPENDENT_CODES[Math.floor(Math.random() * INDEPENDENT_CODES.length)]
}

type Delay = { code: string; minutes: number; reason?: string; category?: string }

async function run() {
  await connectDB(env.MONGODB_URI)

  const now = Date.now()
  console.log(
    `[smart-actuals] operator=${OPERATOR_ID} from=${FROM_DATE} now=${new Date(now).toISOString()} reset=${RESET} dry=${DRY}`,
  )

  // Pull all flights from FROM_DATE onward for the operator, sorted by tail + std.
  const flights = await FlightInstance.find({
    operatorId: OPERATOR_ID,
    operatingDate: { $gte: FROM_DATE },
  })
    .select({
      _id: 1,
      flightNumber: 1,
      operatingDate: 1,
      scheduledFlightId: 1,
      'tail.registration': 1,
      'schedule.stdUtc': 1,
      'schedule.staUtc': 1,
      'actual.atdUtc': 1,
      'actual.ataUtc': 1,
      'actual.doorCloseUtc': 1,
      'actual.offUtc': 1,
      'actual.onUtc': 1,
      delays: 1,
    })
    .lean()

  console.log(`[smart-actuals] loaded ${flights.length} flights`)

  // Load rotationId map from ScheduledFlight to chain by aircraft rotation.
  const scheduledIds = Array.from(new Set(flights.map((f) => f.scheduledFlightId).filter(Boolean))) as string[]
  const schedCol = mongoose.connection.collection('scheduledFlights')
  const schedDocs = await schedCol
    .find(
      { _id: { $in: scheduledIds as unknown as string[] } },
      { projection: { rotationId: 1, rotationLabel: 1, aircraftReg: 1 } },
    )
    .toArray()
  const rotationBySched = new Map<string, { rotationId: string | null; label: string | null; reg: string | null }>()
  for (const s of schedDocs) {
    rotationBySched.set(s._id as unknown as string, {
      rotationId: (s as Record<string, unknown>).rotationId as string | null,
      label: (s as Record<string, unknown>).rotationLabel as string | null,
      reg: (s as Record<string, unknown>).aircraftReg as string | null,
    })
  }
  console.log(`[smart-actuals] linked ${schedDocs.length}/${scheduledIds.length} scheduled flights for rotation`)

  if (RESET) {
    const past = flights.filter((f) => (f.schedule?.stdUtc ?? Infinity) < now)
    if (!DRY) {
      await FlightInstance.updateMany(
        { _id: { $in: past.map((f) => f._id) } },
        {
          $set: {
            'actual.doorCloseUtc': null,
            'actual.atdUtc': null,
            'actual.offUtc': null,
            'actual.onUtc': null,
            'actual.ataUtc': null,
            delays: [],
          },
        },
      )
    }
    console.log(`[smart-actuals] reset actuals on ${past.length} past flights${DRY ? ' (dry)' : ''}`)
    // Re-read so subsequent logic sees the reset state
    for (const f of past) {
      if (f.actual) {
        f.actual.atdUtc = null
        f.actual.ataUtc = null
      }
      f.delays = []
    }
  }

  // Group by rotationId (preferred) or fall back to tail.registration.
  // Flights with no chain key are processed as singletons (no chain delay).
  const byChain = new Map<string, typeof flights>()
  let orphanChainIdx = 0
  for (const f of flights) {
    const sched = f.scheduledFlightId ? rotationBySched.get(f.scheduledFlightId) : null
    const key = sched?.rotationId || f.tail?.registration || `__orphan__${orphanChainIdx++}`
    if (!byChain.has(key)) byChain.set(key, [])
    byChain.get(key)!.push(f)
  }

  let updated = 0
  let skippedFuture = 0
  const skippedExisting = 0
  void skippedExisting
  const ops: Array<{ updateOne: { filter: { _id: string }; update: Record<string, unknown> } }> = []

  for (const [, chain] of byChain) {
    chain.sort((a, b) => (a.schedule?.stdUtc ?? 0) - (b.schedule?.stdUtc ?? 0))

    let prevAta: number | null = null

    for (const f of chain) {
      const std = f.schedule?.stdUtc
      const sta = f.schedule?.staUtc
      if (!std || !sta) {
        prevAta = null
        continue
      }

      const existingAtd = f.actual?.atdUtc ?? null
      const existingAta = f.actual?.ataUtc ?? null

      // Don't invent actual times for flights whose STD is still in the future.
      if (std >= now) {
        skippedFuture++
        prevAta = null // future flights break the chain for backfill purposes
        continue
      }

      const scheduledBlockMs = sta - std

      let atd: number
      let chainDelayMs = 0
      let indepDelayMin = 0
      let overrodeExisting = false

      const earliestAtd = prevAta ? Math.max(std, prevAta + MIN_TURNAROUND_MS) : std

      if (existingAtd && existingAtd >= earliestAtd) {
        // Preserve existing ATD; only backfill the arrival side.
        atd = existingAtd
        chainDelayMs = Math.max(0, existingAtd - std)
      } else {
        // Either no existing ATD, or existing ATD violates turnaround — override.
        overrodeExisting = !!existingAtd
        chainDelayMs = Math.max(0, earliestAtd - std)

        indepDelayMin = sampleIndependentDelayMinutes()
        const indepDelayMs = indepDelayMin * MINUTE

        atd = earliestAtd + indepDelayMs
        // Do not place ATD in the future
        if (atd > now) atd = Math.max(std, now - Math.floor(Math.random() * 5 * MINUTE))
      }

      const blockMs = Math.max(20 * MINUTE, scheduledBlockMs + sampleBlockVarianceMs())
      const ata = existingAta && existingAta > atd + 20 * MINUTE ? existingAta : atd + blockMs
      // ATA may legitimately be in the future if the flight is airborne;
      // if ata is in the future, we mark status=departed (not arrived).

      const doorCloseUtc = Math.round(atd - 4 * MINUTE)
      const offUtc = Math.round(atd + 15 * MINUTE) // wheels up after taxi-out
      const onUtc = Math.round(ata - 7 * MINUTE) // wheels down before on-blocks
      // Guard: offUtc must be before onUtc
      const safeOff = Math.min(offUtc, onUtc - 10 * MINUTE)

      const delays: Delay[] = []
      const chainDelayMin = Math.round(chainDelayMs / MINUTE)
      if (chainDelayMin > 0) {
        delays.push({
          code: '93',
          minutes: chainDelayMin,
          reason: 'Aircraft rotation / late arrival of aircraft',
          category: 'rotation',
        })
      }
      if (indepDelayMin > 0) {
        delays.push({
          code: pickIndependentCode(),
          minutes: indepDelayMin,
          reason: 'Operational delay',
          category: 'operational',
        })
      }

      const totalDelayMin = chainDelayMin + indepDelayMin
      const status = ata < now ? 'arrived' : atd < now ? 'departed' : totalDelayMin > 0 ? 'delayed' : 'scheduled'

      // Preserve existing ATD/doorClose/off when present, but fill any null OOOI fields.
      const set: Record<string, unknown> = {
        status,
        'syncMeta.updatedAt': Date.now(),
      }
      if (!existingAtd || overrodeExisting) {
        set['actual.atdUtc'] = Math.round(atd)
        set.delays = delays
      }
      if (!f.actual?.doorCloseUtc || overrodeExisting) set['actual.doorCloseUtc'] = doorCloseUtc
      if (!f.actual?.offUtc || overrodeExisting) set['actual.offUtc'] = Math.round(safeOff)
      if (!f.actual?.onUtc || overrodeExisting) set['actual.onUtc'] = Math.round(onUtc)
      if (!existingAta || overrodeExisting) {
        set['actual.ataUtc'] = ata < now ? Math.round(ata) : null
      }

      ops.push({
        updateOne: {
          filter: { _id: f._id as string },
          update: {
            $set: set,
            $inc: { 'syncMeta.version': 1 },
          },
        },
      })

      prevAta = ata
      updated++
    }
  }

  console.log(
    `[smart-actuals] will update=${updated} skippedFuture=${skippedFuture} skippedExisting=${skippedExisting} chains=${byChain.size}`,
  )

  if (DRY) {
    console.log('[smart-actuals] dry run — no writes')
    process.exit(0)
  }

  // Bulk in chunks of 500
  const CHUNK = 500
  for (let i = 0; i < ops.length; i += CHUNK) {
    const slice = ops.slice(i, i + CHUNK)
    const res = await FlightInstance.bulkWrite(slice, { ordered: false })
    console.log(
      `[smart-actuals] bulk ${i}-${i + slice.length}: matched=${res.matchedCount} modified=${res.modifiedCount}`,
    )
  }

  console.log('[smart-actuals] done')
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
