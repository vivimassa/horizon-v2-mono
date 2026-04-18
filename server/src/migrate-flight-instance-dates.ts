// One-time migration: normalize FlightInstance.operatingDate to ISO YYYY-MM-DD,
// and rebuild the composite _id `${scheduledFlightId}|${opDate}` on the ISO form
// so Gantt / report overlays match the expanded pattern composite ids.
//
// Safe to re-run (idempotent).
//
//   Dry run:  pnpm --filter server exec tsx src/migrate-flight-instance-dates.ts --dry
//   Execute:  pnpm --filter server exec tsx src/migrate-flight-instance-dates.ts

import 'dotenv/config'
import mongoose from 'mongoose'
import { normalizeDate, isIsoDate } from './utils/normalize-date.js'

const DRY_RUN = process.argv.includes('--dry')

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI env var missing')

  console.log(`[migrate-flight-instance-dates] ${DRY_RUN ? 'DRY RUN' : 'EXECUTING'} against Mongo…`)
  await mongoose.connect(uri)

  // Mongoose-bound find() excludes rows with an _id schema string type here;
  // go through the raw collection to see every doc regardless of schema.
  const col = mongoose.connection.collection('flightInstances')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docs = await col
    .find<any>({}, { projection: { _id: 1, operatingDate: 1, scheduledFlightId: 1, flightNumber: 1, operatorId: 1 } })
    .toArray()

  console.log(`[migrate-flight-instance-dates] scanned ${docs.length} instances`)

  let alreadyIso = 0
  let fieldNormalized = 0
  let idRebuilt = 0
  let unparseable = 0
  let idConflict = 0
  const skippedExamples: string[] = []

  for (const d of docs) {
    const rawDate = d.operatingDate as string | null | undefined
    const rawId = d._id as string
    const sfId = d.scheduledFlightId as string | null | undefined

    const iso = isIsoDate(rawDate ?? '') ? (rawDate as string) : (normalizeDate(rawDate) ?? '')

    if (!iso || !isIsoDate(iso)) {
      unparseable++
      if (skippedExamples.length < 5) {
        skippedExamples.push(`${d.flightNumber}: id=${rawId} operatingDate=${rawDate}`)
      }
      continue
    }

    const dateFieldChanged = rawDate !== iso
    const expectedId = sfId ? `${sfId}|${iso}` : null
    const idChanged = expectedId != null && rawId !== expectedId

    if (!dateFieldChanged && !idChanged) {
      alreadyIso++
      continue
    }

    if (DRY_RUN) {
      if (dateFieldChanged) fieldNormalized++
      if (idChanged) idRebuilt++
      continue
    }

    // Update the field first (cheap); then re-id if needed.
    if (dateFieldChanged && !idChanged) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await col.updateOne({ _id: rawId as any }, { $set: { operatingDate: iso } })
      fieldNormalized++
      continue
    }

    // _id is immutable → insert-new + delete-old in a transaction-free sequence.
    // Check for conflict first.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clash = await col.findOne<any>({ _id: expectedId as any }, { projection: { _id: 1 } })
    if (clash && clash._id !== rawId) {
      idConflict++
      continue
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const full = await col.findOne<any>({ _id: rawId as any })
    if (!full) continue

    const next = { ...full, _id: expectedId, operatingDate: iso }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await col.insertOne(next as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await col.deleteOne({ _id: rawId as any })
    idRebuilt++
    if (dateFieldChanged) fieldNormalized++
  }

  console.log(`[migrate-flight-instance-dates] already ISO + ids aligned: ${alreadyIso}`)
  console.log(`[migrate-flight-instance-dates] operatingDate normalized:  ${fieldNormalized}`)
  console.log(`[migrate-flight-instance-dates] composite _id rebuilt:     ${idRebuilt}`)
  console.log(`[migrate-flight-instance-dates] id conflicts (left alone): ${idConflict}`)
  console.log(`[migrate-flight-instance-dates] unparseable (left alone):  ${unparseable}`)
  if (skippedExamples.length > 0) {
    console.log('[migrate-flight-instance-dates] unparseable samples:')
    for (const s of skippedExamples) console.log('   ', s)
  }

  if (DRY_RUN) console.log('[migrate-flight-instance-dates] DRY RUN — no writes performed.')

  await mongoose.disconnect()
  process.exit(0)
}

main().catch((err) => {
  console.error('[migrate-flight-instance-dates] FAILED:', err)
  process.exit(1)
})
