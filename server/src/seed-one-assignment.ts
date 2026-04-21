import 'dotenv/config'
import crypto from 'node:crypto'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { Pairing } from './models/Pairing.js'
import { CrewMember } from './models/CrewMember.js'
import { CrewPosition } from './models/CrewPosition.js'
import { CrewAssignment } from './models/CrewAssignment.js'

/**
 * One-off: create a single CrewAssignment so the UI has a pairing bar
 * to right-click test. Picks the first pairing whose crewCounts has
 * at least one seat, then finds the first eligible crew member whose
 * position category matches that seat (strict + downrank).
 *
 * Usage:   tsx server/src/seed-one-assignment.ts [--operator=<id>]
 *          Defaults to the SkyHub operator UUID.
 */

const DEFAULT_OPERATOR = '20169cc0-c914-4662-a300-1dbbe20d1416'

async function main() {
  const args = process.argv.slice(2)
  const operatorArg = args.find((a) => a.startsWith('--operator='))
  const operatorId = operatorArg ? operatorArg.split('=')[1] : DEFAULT_OPERATOR
  await connectDB(env.MONGODB_URI)
  console.log(`Operator: ${operatorId}`)

  // Find a pairing that has crewCounts defined and hasn't already been
  // fully staffed. We keep it simple — just scan the first N that look
  // viable and pick one with an open seat.
  const candidatePairings = await Pairing.find({
    operatorId,
    scenarioId: { $in: [null, undefined] },
    crewCounts: { $ne: null },
  })
    .sort({ startDate: 1 })
    .limit(20)
    .lean()

  if (candidatePairings.length === 0) {
    console.error('No pairings with crewCounts found. Did you seed pairings?')
    process.exit(1)
  }

  const positions = await CrewPosition.find({ operatorId }).lean()
  const posByCode = new Map(positions.map((p) => [p.code, p]))

  // For each candidate pairing, look for (seatCode, open slot, eligible crew).
  for (const pairing of candidatePairings) {
    const counts = (pairing as unknown as { crewCounts?: Record<string, number> }).crewCounts ?? {}
    for (const [seatCode, needed] of Object.entries(counts)) {
      if (!needed || needed <= 0) continue
      const seat = posByCode.get(seatCode)
      if (!seat) continue

      // Any existing assignments on this (pairing, seat)? Free seatIndex = highest-used+1
      const existing = await CrewAssignment.find({
        operatorId,
        pairingId: pairing._id as string,
        seatPositionId: seat._id as string,
        status: { $ne: 'cancelled' },
      }).lean()
      const usedIndices = new Set(existing.map((a) => a.seatIndex))
      if (usedIndices.size >= needed) continue // fully staffed
      let seatIndex = 0
      while (usedIndices.has(seatIndex)) seatIndex += 1

      // Find an eligible crew member. Strict + downrank: exact position
      // match wins first; higher-rank crew with canDownrank as fallback.
      const preferredCrew = await CrewMember.findOne({
        operatorId,
        position: seat._id as string,
        status: { $ne: 'inactive' },
      }).lean()

      let crewToAssign = preferredCrew
      if (!crewToAssign) {
        // Fallback: any crew of same category with canDownrank + higher rank
        const downrankablePositions = positions
          .filter((p) => p.category === seat.category && p.rankOrder < seat.rankOrder && p.canDownrank === true)
          .map((p) => p._id as string)
        if (downrankablePositions.length > 0) {
          crewToAssign = await CrewMember.findOne({
            operatorId,
            position: { $in: downrankablePositions },
            status: { $ne: 'inactive' },
          }).lean()
        }
      }

      if (!crewToAssign) {
        console.log(`  ⚠ Pairing ${pairing.pairingCode} seat ${seatCode}: no eligible crew found`)
        continue
      }

      // Compute the window from the pairing — mirrors routes/crew-schedule.ts
      // computeAssignmentWindow: report → last-leg STA + 30m.
      const legs = pairing.legs ?? []
      const startUtcIso =
        (pairing as unknown as { reportTime?: string | null }).reportTime ??
        (legs[0]
          ? new Date(new Date(legs[0].staUtcIso).getTime() - 90 * 60_000).toISOString()
          : `${pairing.startDate}T00:00:00.000Z`)
      const endUtcIso = legs.length
        ? new Date(new Date(legs[legs.length - 1].staUtcIso).getTime() + 30 * 60_000).toISOString()
        : `${pairing.endDate}T23:59:00.000Z`

      const now = new Date().toISOString()
      const doc = await CrewAssignment.create({
        _id: crypto.randomUUID(),
        operatorId,
        scenarioId: null,
        pairingId: pairing._id,
        crewId: crewToAssign._id,
        seatPositionId: seat._id,
        seatIndex,
        status: 'planned',
        startUtcIso,
        endUtcIso,
        assignedByUserId: null,
        assignedAtUtc: now,
        createdAt: now,
        updatedAt: now,
      })

      console.log('✓ Created assignment:')
      console.log(`  pairing:  ${pairing.pairingCode}  (${pairing.startDate} → ${pairing.endDate})`)
      console.log(`  crew:     ${crewToAssign.lastName} ${crewToAssign.firstName}  (${crewToAssign.employeeId})`)
      console.log(`  seat:     ${seat.code}#${seatIndex}`)
      console.log(`  window:   ${startUtcIso} → ${endUtcIso}`)
      console.log(`  _id:      ${doc._id}`)
      console.log('')
      console.log('Open 4.1.6 Crew Schedule, load a period that covers the pairing,')
      console.log("and you should see a bar on that crew's row. Right-click it to test.")
      process.exit(0)
    }
  }

  console.error('Scanned pairings but found no open seats with an eligible crew.')
  console.error('Either pairings already fully crewed, or no crew match the seat positions.')
  process.exit(1)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
