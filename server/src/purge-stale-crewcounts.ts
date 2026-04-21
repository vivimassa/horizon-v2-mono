import 'dotenv/config'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { Pairing } from './models/Pairing.js'
import { CrewPosition } from './models/CrewPosition.js'
import { CrewComplement } from './models/CrewComplement.js'
import { Operator } from './models/Operator.js'

/**
 * One-off purge: strip position codes from every `pairing.crewCounts` document
 * that are no longer ACTIVE in 5.4.2 Crew Positions. Stale codes (e.g. FA, PS
 * left over from a prior operator config) persist in older pairings and surface
 * in UIs that render the raw object — the fix at the UI layer only *hides*
 * them, this script *deletes* them from the database.
 *
 * Idempotent: re-running after a clean pass is a no-op.
 *
 * Usage:
 *   tsx server/src/purge-stale-crewcounts.ts [--operator=<id>] [--dry-run]
 */
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

  const activePositions = await CrewPosition.find({ operatorId, isActive: { $ne: false } }, { code: 1 }).lean()
  const activeCodes = new Set(activePositions.map((p) => p.code))
  console.log(`Operator: ${operatorId}`)
  console.log(`Active position codes (${activeCodes.size}): ${[...activeCodes].join(', ')}`)
  console.log(`Dry run: ${dryRun}\n`)

  const pairings = await Pairing.find({ operatorId }, { _id: 1, pairingCode: 1, crewCounts: 1 }).lean()

  let touched = 0
  let totalStaleKeys = 0
  const staleKeyTally = new Map<string, number>()

  for (const p of pairings) {
    const counts = p.crewCounts as Record<string, number> | null | undefined
    if (!counts || typeof counts !== 'object') continue

    const staleKeys = Object.keys(counts).filter((k) => !activeCodes.has(k))
    if (staleKeys.length === 0) continue

    touched++
    totalStaleKeys += staleKeys.length
    for (const k of staleKeys) staleKeyTally.set(k, (staleKeyTally.get(k) ?? 0) + 1)

    const cleaned: Record<string, number> = {}
    for (const [k, v] of Object.entries(counts)) {
      if (activeCodes.has(k)) cleaned[k] = v
    }

    if (!dryRun) {
      await Pairing.updateOne({ _id: p._id }, { $set: { crewCounts: cleaned } })
    }

    console.log(
      `  ${p.pairingCode}  stripped: ${staleKeys.map((k) => `${k}=${counts[k]}`).join(', ')}  →  ${Object.keys(cleaned).join(', ') || '(empty)'}`,
    )
  }

  console.log(`\nPairings scanned:      ${pairings.length}`)
  console.log(`Pairings with stale:   ${touched}`)
  console.log(`Total stale keys:      ${totalStaleKeys}`)
  if (staleKeyTally.size > 0) {
    console.log('Stale-key breakdown:')
    for (const [k, n] of [...staleKeyTally.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k.padEnd(6)}  ${n} pairing(s)`)
    }
  }
  // ── Pass 2: crewComplements master catalog ──────────────────────────
  // The 4.1.6 server enriches pairings with crewCounts from this table when
  // the denormalised cache is empty — that's how PS/FA/TF leak back into the
  // UI even after the pairings themselves are clean. Purge the same keys here.
  console.log('\n── Pass 2: crewComplements catalog ──')
  const complements = await CrewComplement.find(
    { operatorId },
    { _id: 1, aircraftTypeIcao: 1, templateKey: 1, counts: 1 },
  ).lean()
  let complementsTouched = 0
  let complementsStaleKeys = 0
  for (const c of complements) {
    const counts = c.counts as Record<string, number> | null | undefined
    if (!counts || typeof counts !== 'object') continue
    const staleKeys = Object.keys(counts).filter((k) => !activeCodes.has(k))
    if (staleKeys.length === 0) continue

    complementsTouched++
    complementsStaleKeys += staleKeys.length
    for (const k of staleKeys) staleKeyTally.set(k, (staleKeyTally.get(k) ?? 0) + 1)

    const cleaned: Record<string, number> = {}
    for (const [k, v] of Object.entries(counts)) {
      if (activeCodes.has(k)) cleaned[k] = v
    }

    if (!dryRun) {
      await CrewComplement.updateOne({ _id: c._id }, { $set: { counts: cleaned } })
    }

    console.log(
      `  ${c.aircraftTypeIcao}/${c.templateKey}  stripped: ${staleKeys.map((k) => `${k}=${counts[k]}`).join(', ')}  →  ${Object.keys(cleaned).join(', ') || '(empty)'}`,
    )
  }
  console.log(`Complements scanned:   ${complements.length}`)
  console.log(`Complements with stale: ${complementsTouched}`)
  console.log(`Total stale keys:       ${complementsStaleKeys}`)

  console.log(`\nMode: ${dryRun ? 'DRY RUN — no writes performed' : 'WRITE — documents updated'}`)

  await new Promise((r) => setTimeout(r, 100))
  process.exit(0)
}

main().catch((err) => {
  console.error('Purge failed:', err)
  process.exit(1)
})
