import 'dotenv/config'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { Pairing } from './models/Pairing.js'

/**
 * Strip phantom seat codes from every pairing's `crewCounts` map.
 *
 * These codes surface in the Crew Schedule right panel's "Seats" list
 * (4.1.6) because `crewCounts` is free-form key→count and some pairings
 * carry codes that don't map to a real CrewPosition.
 *
 * Usage:   tsx server/src/purge-pairing-seat-codes.ts PS FA TF [--dry-run]
 */
async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const codes = args.filter((a) => !a.startsWith('--')).map((c) => c.trim().toUpperCase())
  if (codes.length === 0) {
    console.error('Provide one or more seat codes, e.g. PS FA TF')
    process.exit(1)
  }

  await connectDB(env.MONGODB_URI)
  console.log(`Codes to strip from pairings.crewCounts: ${codes.join(', ')}`)
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY'}\n`)

  // Build an $or of existence filters — Mongoose lets us address Map subpaths
  // as `crewCounts.CODE`. Pairings with ANY of the listed codes match.
  const orFilter = codes.map((c) => ({ [`crewCounts.${c}`]: { $exists: true } }))
  const matched = await Pairing.find({ $or: orFilter }).lean()
  console.log(`Matched ${matched.length} pairing(s).`)

  if (matched.length > 0) {
    const sample = matched.slice(0, 5)
    for (const p of sample) {
      const keys = Object.keys((p as unknown as { crewCounts?: Record<string, number> }).crewCounts ?? {})
      console.log(
        `  ${p._id}  operatorId=${p.operatorId}  pairingCode=${(p as { pairingCode?: string }).pairingCode}  keys=[${keys.join(', ')}]`,
      )
    }
    if (matched.length > sample.length) console.log(`  … and ${matched.length - sample.length} more.`)
  }

  if (dryRun || matched.length === 0) {
    process.exit(0)
  }

  const unset: Record<string, ''> = {}
  for (const c of codes) unset[`crewCounts.${c}`] = ''
  const res = await Pairing.updateMany({ $or: orFilter }, { $unset: unset })
  console.log(`\n✓ updateMany: matched=${res.matchedCount} modified=${res.modifiedCount}`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
