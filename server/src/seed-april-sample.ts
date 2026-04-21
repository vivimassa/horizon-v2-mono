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
 * Seed ~10 synthetic pairings across mid-April 2026 and attach one
 * distinct crew member to each. Idempotent-ish: uses a `__sample__`
 * prefix in pairingCode so a second run is easy to spot / clean up.
 *
 * Usage:  tsx server/src/seed-april-sample.ts [--operator=<id>]
 */

const DEFAULT_OPERATOR = '20169cc0-c914-4662-a300-1dbbe20d1416'

function iso(dateY: number, m: number, d: number, hh: number, mm: number): string {
  return new Date(Date.UTC(dateY, m - 1, d, hh, mm)).toISOString()
}

async function main() {
  const args = process.argv.slice(2)
  const operatorArg = args.find((a) => a.startsWith('--operator='))
  const operatorId = operatorArg ? operatorArg.split('=')[1] : DEFAULT_OPERATOR
  await connectDB(env.MONGODB_URI)
  console.log(`Operator: ${operatorId}`)

  const positions = await CrewPosition.find({ operatorId }).lean()
  const posByCode = new Map(positions.map((p) => [p.code, p]))
  const captain = posByCode.get('CP')
  if (!captain) {
    console.error('No Captain (CP) position — cannot assign.')
    process.exit(1)
  }
  const firstOfficer = posByCode.get('FO')

  // Pick 10 distinct crew members with a captain-eligible position.
  const candidateCaptains = await CrewMember.find({
    operatorId,
    position: captain._id as string,
    status: { $ne: 'inactive' },
  })
    .limit(10)
    .lean()
  if (candidateCaptains.length < 10) {
    console.warn(`Only ${candidateCaptains.length} Captain(s) available.`)
  }

  const crewList = candidateCaptains.slice(0, 10)
  if (crewList.length === 0) {
    console.error('No captains found. Aborting.')
    process.exit(1)
  }

  // Synthetic pairing template — point-to-point SGN↔HAN, 2.5h flight.
  // Spreads 10 pairings across days 13–17 of April 2026 (Mon–Fri).
  type Template = {
    day: number
    code: string
    dep: string
    arr: string
    dh: number
    dm: number
    ah: number
    am: number
    fn: string
  }
  const templates: Template[] = [
    { day: 13, code: 'P4101', dep: 'SGN', arr: 'HAN', dh: 6, dm: 0, ah: 8, am: 30, fn: 'VN1201' },
    { day: 13, code: 'P4102', dep: 'SGN', arr: 'DAD', dh: 7, dm: 30, ah: 8, am: 45, fn: 'VN1320' },
    { day: 14, code: 'P4103', dep: 'HAN', arr: 'SGN', dh: 5, dm: 15, ah: 7, am: 35, fn: 'VN1208' },
    { day: 14, code: 'P4104', dep: 'SGN', arr: 'HAN', dh: 10, dm: 0, ah: 12, am: 20, fn: 'VN1215' },
    { day: 15, code: 'P4105', dep: 'SGN', arr: 'CXR', dh: 6, dm: 45, ah: 7, am: 55, fn: 'VN1502' },
    { day: 15, code: 'P4106', dep: 'HAN', arr: 'DAD', dh: 9, dm: 0, ah: 10, am: 25, fn: 'VN1602' },
    { day: 16, code: 'P4107', dep: 'SGN', arr: 'HAN', dh: 14, dm: 30, ah: 16, am: 50, fn: 'VN1230' },
    { day: 16, code: 'P4108', dep: 'DAD', arr: 'SGN', dh: 11, dm: 0, ah: 12, am: 20, fn: 'VN1325' },
    { day: 17, code: 'P4109', dep: 'SGN', arr: 'HAN', dh: 7, dm: 0, ah: 9, am: 20, fn: 'VN1210' },
    { day: 17, code: 'P4110', dep: 'HAN', arr: 'SGN', dh: 16, dm: 0, ah: 18, am: 20, fn: 'VN1212' },
  ]

  const now = new Date().toISOString()
  const created: Array<{ code: string; crew: string; day: string; window: string }> = []

  for (let i = 0; i < Math.min(templates.length, crewList.length); i += 1) {
    const t = templates[i]
    const crew = crewList[i]
    const startDate = `2026-04-${String(t.day).padStart(2, '0')}`
    const stdUtcIso = iso(2026, 4, t.day, t.dh, t.dm)
    const staUtcIso = iso(2026, 4, t.day, t.ah, t.am)
    const blockMinutes = Math.round((new Date(staUtcIso).getTime() - new Date(stdUtcIso).getTime()) / 60_000)

    const pairingId = crypto.randomUUID()
    await Pairing.create({
      _id: pairingId,
      operatorId,
      scenarioId: null,
      seasonCode: null,
      pairingCode: `__sample__${t.code}`,
      baseAirport: t.dep,
      baseId: null,
      aircraftTypeIcao: 'A321',
      aircraftTypeId: null,
      fdtlStatus: 'legal',
      workflowStatus: 'committed',
      totalBlockMinutes: blockMinutes,
      totalDutyMinutes: blockMinutes + 90,
      pairingDays: 1,
      startDate,
      endDate: startDate,
      reportTime: new Date(new Date(stdUtcIso).getTime() - 60 * 60_000).toISOString(),
      releaseTime: new Date(new Date(staUtcIso).getTime() + 30 * 60_000).toISOString(),
      numberOfDuties: 1,
      numberOfSectors: 1,
      layoverAirports: [],
      complementKey: 'standard',
      cockpitCount: 2,
      facilityClass: null,
      crewCounts: firstOfficer ? { CP: 1, FO: 1, CC: 3 } : { CP: 1, CC: 3 },
      legs: [
        {
          flightId: `__sample_flt__${t.code}`,
          flightDate: startDate,
          legOrder: 0,
          isDeadhead: false,
          dutyDay: 1,
          depStation: t.dep,
          arrStation: t.arr,
          flightNumber: t.fn,
          stdUtcIso,
          staUtcIso,
          blockMinutes,
          aircraftTypeIcao: 'A321',
        },
      ],
      lastLegalityResult: null,
      routeChain: `${t.dep}-${t.arr}`,
      createdBy: 'seed-april-sample',
      createdAt: now,
      updatedAt: now,
    })

    const assignmentStart = new Date(new Date(stdUtcIso).getTime() - 60 * 60_000).toISOString()
    const assignmentEnd = new Date(new Date(staUtcIso).getTime() + 30 * 60_000).toISOString()

    await CrewAssignment.create({
      _id: crypto.randomUUID(),
      operatorId,
      scenarioId: null,
      pairingId,
      crewId: crew._id,
      seatPositionId: captain._id,
      seatIndex: 0,
      status: 'planned',
      startUtcIso: assignmentStart,
      endUtcIso: assignmentEnd,
      assignedByUserId: null,
      assignedAtUtc: now,
      createdAt: now,
      updatedAt: now,
    })

    created.push({
      code: t.code,
      crew: `${crew.lastName} ${crew.firstName} (${crew.employeeId})`,
      day: startDate,
      window: `${assignmentStart.slice(11, 16)}Z → ${assignmentEnd.slice(11, 16)}Z`,
    })
  }

  console.log('')
  console.log(`✓ Created ${created.length} pairing+assignment pair(s) across April 13–17, 2026:`)
  for (const c of created) {
    console.log(`  ${c.day}  ${c.code.padEnd(6)}  ${c.window}  ${c.crew}`)
  }
  console.log('')
  console.log('In the Gantt, pick period 2026-04-13 → 2026-04-17 and hit Go.')
  console.log('Clean up later with:  db.pairings.deleteMany({pairingCode: /^__sample__/})')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
