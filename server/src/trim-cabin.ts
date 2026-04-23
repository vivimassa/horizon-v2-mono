// One-off: trim PU + CA counts on A320 without touching A350/A380 crew.
// Soft-delete (status=inactive) unless --hard is passed.
//
// Usage:
//   tsx src/trim-cabin.ts <operatorId> <removePU> <removeCA> [--apply] [--hard]

import 'dotenv/config'
import mongoose from 'mongoose'
import { CrewMember } from './models/CrewMember.js'
import { CrewPosition } from './models/CrewPosition.js'
import { CrewQualification } from './models/CrewQualification.js'
import { CrewGroupAssignment } from './models/CrewGroupAssignment.js'
import { CrewAssignment } from './models/CrewAssignment.js'
import { CrewActivity } from './models/CrewActivity.js'

const PROTECTED_TYPES = ['A350', 'A359', 'A35K', 'A380']

async function main() {
  const [operatorId, removePUStr, removeCAStr, ...flags] = process.argv.slice(2)
  const apply = flags.includes('--apply')
  const hard = flags.includes('--hard')
  const removePU = parseInt(removePUStr ?? '', 10)
  const removeCA = parseInt(removeCAStr ?? '', 10)
  if (!operatorId || !Number.isFinite(removePU) || !Number.isFinite(removeCA)) {
    console.log('Usage: tsx src/trim-cabin.ts <operatorId> <removePU> <removeCA> [--apply] [--hard]')
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGODB_URI!)

  // Resolve positions
  const positions = await CrewPosition.find({ operatorId, code: { $in: ['PU', 'CA'] } })
    .select('_id code')
    .lean()
  const posByCode = new Map((positions as Array<{ _id: string; code: string }>).map((p) => [p.code, p._id]))
  const puId = posByCode.get('PU')
  const caId = posByCode.get('CA')
  if (!puId || !caId) {
    console.error('PU or CA position missing')
    process.exit(1)
  }

  // Protected set — A350/A380 qualified crew never touched.
  const protectedIds = new Set(
    (await CrewQualification.distinct('crewId', {
      operatorId,
      aircraftType: { $in: PROTECTED_TYPES },
    })) as string[],
  )

  // A320-qualified crew pool (the only crew this op flies)
  const a320Ids = (await CrewQualification.distinct('crewId', {
    operatorId,
    aircraftType: 'A320',
  })) as string[]

  async function pickForDeletion(posId: string, removeN: number, label: string) {
    const crew = await CrewMember.find({
      operatorId,
      position: posId,
      _id: { $in: a320Ids },
      status: { $in: ['active', 'suspended'] },
    })
      .select('_id seniority createdAt')
      .lean()

    const eligible = crew.filter((c) => !protectedIds.has(c._id as string))
    const protectedCount = crew.length - eligible.length

    // Least senior first (highest seniority number, or latest createdAt).
    eligible.sort((a, b) => {
      const sa = (a as { seniority?: number | null }).seniority ?? Number.NEGATIVE_INFINITY
      const sb = (b as { seniority?: number | null }).seniority ?? Number.NEGATIVE_INFINITY
      if (sa !== sb) return sb - sa
      const ca = String((a as { createdAt?: string }).createdAt ?? '')
      const cb = String((b as { createdAt?: string }).createdAt ?? '')
      return cb.localeCompare(ca)
    })

    const slice = eligible.slice(0, Math.min(removeN, eligible.length))
    console.log(`\n${label}: total=${crew.length}, protected=${protectedCount}, removing ${slice.length}/${removeN}.`)
    return slice.map((c) => c._id as string)
  }

  const puIds = await pickForDeletion(puId, removePU, 'PU')
  const caIds = await pickForDeletion(caId, removeCA, 'CA')
  const allIds = [...puIds, ...caIds]

  console.log(`\nPlan: remove ${allIds.length} crew total. Mode: ${hard ? 'HARD' : 'SOFT (status=inactive)'}`)
  if (!apply) {
    console.log('\n[dry-run] Add --apply to execute.')
    await mongoose.disconnect()
    return
  }
  if (allIds.length === 0) {
    console.log('\nNothing to remove.')
    await mongoose.disconnect()
    return
  }

  if (hard) {
    const [rmCrew, rmQual, rmGroup, rmAssign, rmAct] = await Promise.all([
      CrewMember.deleteMany({ _id: { $in: allIds } }),
      CrewQualification.deleteMany({ operatorId, crewId: { $in: allIds } }),
      CrewGroupAssignment.deleteMany({ operatorId, crewId: { $in: allIds } }),
      CrewAssignment.deleteMany({ operatorId, crewId: { $in: allIds } }),
      CrewActivity.deleteMany({ operatorId, crewId: { $in: allIds } }),
    ])
    console.log(
      `\nHard-delete: crew=${rmCrew.deletedCount}, qual=${rmQual.deletedCount}, group=${rmGroup.deletedCount}, assign=${rmAssign.deletedCount}, act=${rmAct.deletedCount}`,
    )
  } else {
    const r = await CrewMember.updateMany(
      { _id: { $in: allIds } },
      { $set: { status: 'inactive', updatedAt: new Date().toISOString() } },
    )
    console.log(`\nSoft-delete: ${r.modifiedCount} marked inactive.`)
  }

  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
