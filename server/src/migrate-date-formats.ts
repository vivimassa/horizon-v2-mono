// One-time migration: normalize ScheduledFlight.effectiveFrom / effectiveUntil
// to ISO YYYY-MM-DD. Safe to re-run (idempotent).
//
//   Dry run:  pnpm --filter server exec tsx src/migrate-date-formats.ts --dry
//   Execute:  pnpm --filter server exec tsx src/migrate-date-formats.ts

import 'dotenv/config'
import mongoose from 'mongoose'
import { ScheduledFlight } from './models/ScheduledFlight.js'
import { normalizeDate, isIsoDate } from './utils/normalize-date.js'

const DRY_RUN = process.argv.includes('--dry')

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI env var missing')

  console.log(`[migrate-date-formats] ${DRY_RUN ? 'DRY RUN' : 'EXECUTING'} against Mongo…`)
  await mongoose.connect(uri)

  const docs = await ScheduledFlight.find(
    {},
    { _id: 1, effectiveFrom: 1, effectiveUntil: 1, flightNumber: 1, airlineCode: 1 },
  ).lean()

  console.log(`[migrate-date-formats] scanned ${docs.length} flights`)

  const ops: { updateOne: { filter: { _id: string }; update: { $set: Record<string, string> } } }[] = []
  const skippedExamples: string[] = []
  let alreadyIso = 0
  let normalized = 0
  let unparseable = 0

  for (const d of docs) {
    const from = d.effectiveFrom as string | null | undefined
    const to = d.effectiveUntil as string | null | undefined
    const set: Record<string, string> = {}

    const fromIso = isIsoDate(from ?? '') ? from! : normalizeDate(from) || ''
    const toIso = isIsoDate(to ?? '') ? to! : normalizeDate(to) || ''

    const fromChanged = from && from !== fromIso && isIsoDate(fromIso)
    const toChanged = to && to !== toIso && isIsoDate(toIso)

    if (fromChanged) set.effectiveFrom = fromIso
    if (toChanged) set.effectiveUntil = toIso

    // Count stats
    if (isIsoDate(from ?? '') && isIsoDate(to ?? '')) {
      alreadyIso++
    } else if (Object.keys(set).length > 0) {
      normalized++
    } else {
      unparseable++
      if (skippedExamples.length < 5) {
        skippedExamples.push(`${d.airlineCode}${d.flightNumber}: from=${from} to=${to}`)
      }
    }

    if (Object.keys(set).length > 0) {
      ops.push({ updateOne: { filter: { _id: d._id as string }, update: { $set: set } } })
    }
  }

  console.log(`[migrate-date-formats] already ISO: ${alreadyIso}`)
  console.log(`[migrate-date-formats] will normalize: ${normalized}`)
  console.log(`[migrate-date-formats] unparseable (left alone): ${unparseable}`)
  if (skippedExamples.length > 0) {
    console.log('[migrate-date-formats] unparseable samples:')
    for (const s of skippedExamples) console.log('   ', s)
  }

  if (DRY_RUN) {
    console.log('[migrate-date-formats] DRY RUN — no writes performed.')
  } else if (ops.length === 0) {
    console.log('[migrate-date-formats] Nothing to write.')
  } else {
    console.log(`[migrate-date-formats] Writing ${ops.length} updates…`)
    const res = await ScheduledFlight.bulkWrite(ops)
    console.log(`[migrate-date-formats] ✔ modifiedCount: ${res.modifiedCount}`)
  }

  await mongoose.disconnect()
  process.exit(0)
}

main().catch((err) => {
  console.error('[migrate-date-formats] FAILED:', err)
  process.exit(1)
})
