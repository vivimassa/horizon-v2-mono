import 'dotenv/config'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { CrewPosition } from './models/CrewPosition.js'
import { CrewMember } from './models/CrewMember.js'
import { ExpiryCode } from './models/ExpiryCode.js'
import { CrewComplement } from './models/CrewComplement.js'
import { Operator } from './models/Operator.js'

/**
 * One-off: remove Crew Positions by code from the DB for a given operator.
 *
 * Safety: enforces the same rule the UI's DANGER ZONE uses — a position
 * with references (expiry codes, crew members, complements) is NOT deleted.
 * Usage:  tsx server/src/purge-crew-positions.ts PS FA TF [--operator=skyhub]
 */
async function main() {
  const args = process.argv.slice(2)
  const operatorArg = args.find((a) => a.startsWith('--operator='))
  const codes = args.filter((a) => !a.startsWith('--')).map((c) => c.trim().toUpperCase())
  if (codes.length === 0) {
    console.error('Provide one or more position codes, e.g. PS FA TF')
    process.exit(1)
  }

  await connectDB(env.MONGODB_URI)
  // Resolve operatorId from --operator=<id> or fall back to the first active
  // operator in the DB. Never a hardcoded string — those don't match real tenants.
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
  console.log(`Codes to purge: ${codes.join(', ')}\n`)

  const positions = await CrewPosition.find({ operatorId, code: { $in: codes } }).lean()
  if (positions.length === 0) {
    console.log('No matching positions found. Nothing to do.')
    process.exit(0)
  }

  for (const p of positions) {
    const posId = p._id as string
    const [expiryHits, crewHits, complementHits] = await Promise.all([
      ExpiryCode.countDocuments({ operatorId, applicablePositions: posId }),
      CrewMember.countDocuments({ operatorId, position: posId }),
      CrewComplement.countDocuments({ operatorId, [`counts.${p.code}`]: { $gt: 0 } }),
    ])
    const refs = expiryHits + crewHits + complementHits
    console.log(`${p.code} (${p.name}) [id=${posId}]`)
    console.log(`  expiryCodes=${expiryHits}  crewMembers=${crewHits}  complements=${complementHits}`)
    if (refs === 0) {
      const r = await CrewPosition.deleteOne({ _id: posId, operatorId })
      console.log(`  → deleted (deletedCount=${r.deletedCount})\n`)
    } else {
      console.log(`  → SKIPPED (referenced — deactivate instead via UI)\n`)
    }
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
