// Trim crew by base + position. Reports A/C-type distribution first so you
// can confirm the pool doesn't include types you want to keep (e.g. A350 /
// A380). Defaults to soft-delete (status='inactive'); pass --hard for a
// destructive prune that also removes dependent records.
//
// Usage:
//   tsx src/trim-crew.ts <operatorId> <baseIata> <positionCode> <targetCount> [--apply] [--hard]
//
// Examples:
//   tsx src/trim-crew.ts 20169cc0-c914-4662-a300-1dbbe20d1416 HAN CP 265
//   tsx src/trim-crew.ts 20169cc0-c914-4662-a300-1dbbe20d1416 HAN CP 265 --apply
//   tsx src/trim-crew.ts 20169cc0-c914-4662-a300-1dbbe20d1416 HAN CP 265 --apply --hard

import 'dotenv/config'
import mongoose from 'mongoose'
import { CrewMember } from './models/CrewMember.js'
import { CrewPosition } from './models/CrewPosition.js'
import { CrewQualification } from './models/CrewQualification.js'
import { CrewGroupAssignment } from './models/CrewGroupAssignment.js'
import { CrewAssignment } from './models/CrewAssignment.js'
import { CrewActivity } from './models/CrewActivity.js'
import { Airport } from './models/Airport.js'

const PROTECTED_TYPES = new Set(['A350', 'A359', 'A35K', 'A380'])

async function main() {
  const [operatorId, baseIata, positionCode, targetStr, ...flags] = process.argv.slice(2)
  const apply = flags.includes('--apply')
  const hard = flags.includes('--hard')
  const target = parseInt(targetStr ?? '', 10)
  if (!operatorId || !baseIata || !positionCode || !Number.isFinite(target)) {
    console.log('Usage: tsx src/trim-crew.ts <operatorId> <baseIata> <positionCode> <targetCount> [--apply] [--hard]')
    process.exit(1)
  }

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI missing')
  await mongoose.connect(uri)

  const [base, position] = await Promise.all([
    Airport.findOne({ $or: [{ iataCode: baseIata }, { icaoCode: baseIata }] })
      .select('_id iataCode')
      .lean(),
    CrewPosition.findOne({ operatorId, code: positionCode }).select('_id code').lean(),
  ])
  if (!base) {
    console.error(`Base not found: ${baseIata}`)
    process.exit(1)
  }
  if (!position) {
    console.error(`Position not found: ${positionCode} (operator ${operatorId})`)
    process.exit(1)
  }

  const baseId = (base as { _id: string })._id
  const positionId = (position as { _id: string })._id

  const crew = await CrewMember.find({
    operatorId,
    base: baseId,
    position: positionId,
    status: { $in: ['active', 'suspended'] },
  })
    .select('_id firstName lastName seniority createdAt status')
    .sort({ createdAt: -1 })
    .lean()

  console.log(`\nFound ${crew.length} ${positionCode} at ${baseIata} (active/suspended).`)

  const crewIds = crew.map((c) => c._id as string)
  const quals = await CrewQualification.find({
    operatorId,
    crewId: { $in: crewIds },
  })
    .select('crewId aircraftType')
    .lean()

  // Distribution by A/C type (a crew can hold multiple quals).
  const byType = new Map<string, Set<string>>()
  for (const q of quals) {
    const t = (q as { aircraftType?: string }).aircraftType ?? 'unknown'
    const cid = String((q as { crewId: unknown }).crewId)
    if (!byType.has(t)) byType.set(t, new Set())
    byType.get(t)!.add(cid)
  }
  const unqualified = crewIds.filter((cid) => !quals.some((q) => String((q as { crewId: unknown }).crewId) === cid))

  console.log('\nA/C-type distribution (unique crew per type):')
  const entries = [...byType.entries()].sort((a, b) => b[1].size - a[1].size)
  for (const [t, set] of entries) console.log(`  ${t.padEnd(6)} ${set.size}`)
  if (unqualified.length > 0) console.log(`  (no quals) ${unqualified.length}`)

  const protectedIds = new Set<string>()
  for (const [t, set] of byType) {
    if (PROTECTED_TYPES.has(t)) for (const cid of set) protectedIds.add(cid)
  }
  console.log(`\nProtected (A350/A380) crew: ${protectedIds.size}`)

  const toKeep = new Set(protectedIds)
  // Fill the remaining slots up to `target` with highest-seniority crew first
  // (lowest seniority number = most senior, using createdAt desc as a stable
  // fallback if the field is missing).
  const sortedCandidates = crew
    .filter((c) => !protectedIds.has(c._id as string))
    .sort((a, b) => {
      const sa = (a as { seniority?: number | null }).seniority ?? Number.POSITIVE_INFINITY
      const sb = (b as { seniority?: number | null }).seniority ?? Number.POSITIVE_INFINITY
      if (sa !== sb) return sa - sb
      const ca = String((a as { createdAt?: string }).createdAt ?? '')
      const cb = String((b as { createdAt?: string }).createdAt ?? '')
      return ca.localeCompare(cb)
    })

  for (const c of sortedCandidates) {
    if (toKeep.size >= target) break
    toKeep.add(c._id as string)
  }

  const toRemoveIds = crew.map((c) => c._id as string).filter((id) => !toKeep.has(id))

  console.log(`\nPlan: keep ${toKeep.size}, remove ${toRemoveIds.length}. Target was ${target}.`)
  console.log(`Mode: ${hard ? 'HARD DELETE (+ cascade dependent records)' : 'SOFT (status=inactive)'}`)

  if (!apply) {
    console.log('\n[dry-run] Re-run with --apply to execute.')
    await mongoose.disconnect()
    return
  }

  if (toRemoveIds.length === 0) {
    console.log('\nNothing to remove.')
    await mongoose.disconnect()
    return
  }

  if (hard) {
    const [rmCrew, rmQual, rmGroup, rmAssign, rmAct] = await Promise.all([
      CrewMember.deleteMany({ _id: { $in: toRemoveIds } }),
      CrewQualification.deleteMany({ operatorId, crewId: { $in: toRemoveIds } }),
      CrewGroupAssignment.deleteMany({ operatorId, crewId: { $in: toRemoveIds } }),
      CrewAssignment.deleteMany({ operatorId, crewId: { $in: toRemoveIds } }),
      CrewActivity.deleteMany({ operatorId, crewId: { $in: toRemoveIds } }),
    ])
    console.log('\nHard-delete result:')
    console.log(`  CrewMember          ${rmCrew.deletedCount}`)
    console.log(`  CrewQualification   ${rmQual.deletedCount}`)
    console.log(`  CrewGroupAssignment ${rmGroup.deletedCount}`)
    console.log(`  CrewAssignment      ${rmAssign.deletedCount}`)
    console.log(`  CrewActivity        ${rmAct.deletedCount}`)
  } else {
    const r = await CrewMember.updateMany(
      { _id: { $in: toRemoveIds } },
      { $set: { status: 'inactive', updatedAt: new Date().toISOString() } },
    )
    console.log(`\nSoft-delete result: ${r.modifiedCount} crew marked inactive.`)
  }

  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
