import 'dotenv/config'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { Pairing } from './models/Pairing.js'
import { Operator } from './models/Operator.js'
import { loadSerializedRuleSet } from './services/fdtl-rule-set.js'
import { evaluatePairingLegality, loadAirportTzCountryMaps } from './services/evaluate-pairing-legality.js'

/**
 * One-off backfill: run the FDTL engine over every existing pairing whose
 * `lastLegalityResult` is null / missing and persist the result + derived
 * `fdtlStatus` badge. After this runs, the crew-schedule inspector (and
 * any other consumer of `lastLegalityResult`) stops showing blanks for
 * pairings that were seeded before the auto-eval hook landed.
 *
 * Usage:
 *   tsx server/src/backfill-pairing-legality.ts [--operator=<id>] [--dry-run] [--all]
 *     --operator   Scope to a single operator. Defaults to the first active operator.
 *     --all        Re-evaluate every pairing, not just those missing a result.
 *     --dry-run    Log the numbers but don't persist.
 */
async function main() {
  const args = process.argv.slice(2)
  const operatorArg = args.find((a) => a.startsWith('--operator='))
  const dryRun = args.includes('--dry-run')
  const rebuildAll = args.includes('--all')

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
  console.log(`Mode: ${rebuildAll ? 'rebuild all' : 'missing only'}`)
  console.log(`Dry run: ${dryRun}\n`)

  const ruleSet = await loadSerializedRuleSet(operatorId)
  if (!ruleSet) {
    console.error('No FDTL scheme configured for this operator — aborting.')
    process.exit(1)
  }

  const opDoc = (await Operator.findById(operatorId).lean()) as { timezone?: string } | null
  const timezone = opDoc?.timezone ?? 'UTC'
  console.log(`Operator timezone: ${timezone} (fallback for FDP band lookup)\n`)

  const filter: Record<string, unknown> = { operatorId }
  if (!rebuildAll) filter.$or = [{ lastLegalityResult: null }, { lastLegalityResult: { $exists: false } }]

  const pairings = await Pairing.find(filter, {
    _id: 1,
    pairingCode: 1,
    baseAirport: 1,
    complementKey: 1,
    cockpitCount: 1,
    facilityClass: 1,
    legs: 1,
    fdtlStatus: 1,
  }).lean()

  console.log(`Pairings to evaluate: ${pairings.length}\n`)

  // Load airport tz + country maps once for the entire batch. Any IATA
  // that's missing from the collection falls back to operator tz.
  const allIatas = new Set<string>()
  for (const p of pairings) {
    for (const l of p.legs) {
      if (l.depStation) allIatas.add(l.depStation)
      if (l.arrStation) allIatas.add(l.arrStation)
    }
  }
  const maps = await loadAirportTzCountryMaps(allIatas)
  console.log(
    `Loaded tz for ${Object.keys(maps.tz).length} airports, country for ${Object.keys(maps.country).length}\n`,
  )

  let touched = 0
  let skipped = 0
  let failed = 0
  const statusCounts: Record<'legal' | 'warning' | 'violation', number> = {
    legal: 0,
    warning: 0,
    violation: 0,
  }

  for (const p of pairings) {
    try {
      const evalResult = evaluatePairingLegality(
        {
          baseAirport: p.baseAirport,
          complementKey: p.complementKey,
          cockpitCount: p.cockpitCount,
          facilityClass: p.facilityClass ?? null,
          legs: p.legs.map((l) => ({
            flightId: l.flightId,
            isDeadhead: l.isDeadhead,
            depStation: l.depStation,
            arrStation: l.arrStation,
            stdUtcIso: l.stdUtcIso,
            staUtcIso: l.staUtcIso,
            blockMinutes: l.blockMinutes,
            aircraftTypeIcao: l.aircraftTypeIcao,
          })),
          timezone,
          airportTimezones: maps.tz,
          airportCountries: maps.country,
        },
        ruleSet,
      )
      if (!evalResult) {
        skipped++
        continue
      }
      statusCounts[evalResult.status]++
      if (!dryRun) {
        await Pairing.updateOne(
          { _id: p._id },
          {
            $set: {
              lastLegalityResult: evalResult.result,
              fdtlStatus: evalResult.status,
              updatedAt: new Date().toISOString(),
            },
          },
        )
      }
      touched++
    } catch (err) {
      failed++
      console.error(`  ! ${p.pairingCode ?? p._id}: ${(err as Error).message}`)
    }
  }

  console.log('\n── Summary ──')
  console.log(`Touched:      ${touched}`)
  console.log(`  legal:      ${statusCounts.legal}`)
  console.log(`  warning:    ${statusCounts.warning}`)
  console.log(`  violation:  ${statusCounts.violation}`)
  console.log(`Skipped:      ${skipped} (empty legs)`)
  console.log(`Failed:       ${failed}`)
  if (dryRun) console.log('\n(dry run — no writes performed)')

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
