import 'dotenv/config'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import mongoose from 'mongoose'
import { connectDB } from './db/connection.js'
import { Pairing } from './models/Pairing.js'
import { ScheduledFlight } from './models/ScheduledFlight.js'
import { Operator } from './models/Operator.js'

/**
 * One-off backfill: populate `pairing.legs[i].tailNumber` for existing pairings
 * whose legs were saved before the server Zod schema accepted tail. Source
 * cascade per leg matches the runtime create path:
 *   1. FlightInstance.tail    (per-date assignment from Movement Control)
 *   2. ScheduledFlight.aircraftReg (pattern default)
 *   3. null
 *
 * Usage:
 *   tsx server/src/backfill-pairing-tails.ts [--operator=<id>] [--dry-run]
 */

type InstanceLean = {
  _id: string
  scheduledFlightId: string
  operatingDate: string
  tail?: { registration?: string | null } | null
}
type SfLean = { _id: string; aircraftReg?: string | null }

async function main() {
  const args = process.argv.slice(2)
  const operatorArg = args.find((a) => a.startsWith('--operator='))
  const dryRun = args.includes('--dry-run')

  await connectDB(env.MONGODB_URI)

  let operatorId: string
  if (operatorArg) {
    operatorId = operatorArg.split('=')[1]
  } else {
    const op = await Operator.findOne({ isActive: true }).lean()
    if (!op) {
      console.error('No active operator found — pass --operator=<id>')
      process.exit(1)
    }
    operatorId = op._id as string
  }

  console.log(`Operator: ${operatorId}`)
  console.log(`Dry run: ${dryRun}\n`)

  // ── Build a flight instance tail index (same shape as pairings.ts uses) ──
  const instancesCol = mongoose.connection.db!.collection<InstanceLean>('flightInstances')
  const instances = await instancesCol.find({ operatorId } as Record<string, unknown>).toArray()
  // Instance tail lives at `tail.registration` (nested), not a flat string.
  // Keyed by the pipe-delimited _id convention used elsewhere in the server.
  const instanceTailById = new Map<string, string>()
  for (const fi of instances) {
    const reg = fi.tail?.registration
    if (reg) {
      instanceTailById.set(`${fi.scheduledFlightId}|${fi.operatingDate}`, reg)
    }
  }
  console.log(`Flight-instance tail overlays loaded: ${instanceTailById.size}`)

  // ── Build a ScheduledFlight → aircraftReg index ─────────────────────────
  const sfs = await ScheduledFlight.find({ operatorId }, { _id: 1, aircraftReg: 1 }).lean<SfLean[]>()
  const sfRegById = new Map<string, string>()
  for (const sf of sfs) {
    if (sf.aircraftReg) sfRegById.set(sf._id as string, sf.aircraftReg)
  }
  console.log(`Scheduled-flight pattern regs loaded: ${sfRegById.size}\n`)

  // ── Walk every pairing, resolve tail per leg, write if changed ──────────
  const pairings = await Pairing.find({ operatorId }, { _id: 1, pairingCode: 1, legs: 1 })
  let pairingsTouched = 0
  let legsTouched = 0
  let legsAlreadySet = 0
  let legsUnresolvable = 0

  for (const p of pairings) {
    let changed = false
    for (const leg of p.legs) {
      if (leg.tailNumber) {
        legsAlreadySet++
        continue
      }
      // leg.flightId is stored as `${scheduledFlightId}__${date}` — strip the
      // date suffix before looking up the flight pool / instance overlay.
      const scheduledFlightId = leg.flightId.includes('__') ? leg.flightId.split('__')[0] : leg.flightId
      const instanceKey = `${scheduledFlightId}|${leg.flightDate}`
      const resolved = instanceTailById.get(instanceKey) ?? sfRegById.get(scheduledFlightId) ?? null
      if (!resolved) {
        legsUnresolvable++
        continue
      }
      leg.tailNumber = resolved
      legsTouched++
      changed = true
    }
    if (changed) {
      pairingsTouched++
      if (!dryRun) {
        p.markModified('legs')
        await p.save()
      }
    }
  }

  console.log(`Pairings scanned:        ${pairings.length}`)
  console.log(`Pairings updated:        ${pairingsTouched}`)
  console.log(`Legs backfilled:         ${legsTouched}`)
  console.log(`Legs already had tail:   ${legsAlreadySet}`)
  console.log(`Legs unresolvable (no overlay + no pattern reg): ${legsUnresolvable}`)

  console.log(`\nMode: ${dryRun ? 'DRY RUN — no writes performed' : 'WRITE — documents updated'}`)

  await new Promise((r) => setTimeout(r, 100))
  process.exit(0)
}

main().catch((err) => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
