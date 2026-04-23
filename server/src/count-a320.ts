import 'dotenv/config'
import mongoose from 'mongoose'
import { CrewMember } from './models/CrewMember.js'
import { CrewQualification } from './models/CrewQualification.js'
import { CrewPosition } from './models/CrewPosition.js'
import { Airport } from './models/Airport.js'

const OPID = '20169cc0-c914-4662-a300-1dbbe20d1416'

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!)

  const a320Ids = (await CrewQualification.distinct('crewId', { operatorId: OPID, aircraftType: 'A320' })) as string[]
  const a321Ids = (await CrewQualification.distinct('crewId', { operatorId: OPID, aircraftType: 'A321' })) as string[]
  const both = new Set([...a320Ids, ...a321Ids])

  const [activeA320, activeA321, activeBoth] = await Promise.all([
    CrewMember.find({ operatorId: OPID, _id: { $in: a320Ids }, status: { $in: ['active', 'suspended'] } })
      .select('_id position base')
      .lean(),
    CrewMember.find({ operatorId: OPID, _id: { $in: a321Ids }, status: { $in: ['active', 'suspended'] } })
      .select('_id position base')
      .lean(),
    CrewMember.find({ operatorId: OPID, _id: { $in: [...both] }, status: { $in: ['active', 'suspended'] } })
      .select('_id position base')
      .lean(),
  ])

  const [positions, airports] = await Promise.all([
    CrewPosition.find({ operatorId: OPID }).select('_id code').lean(),
    Airport.find({}).select('_id iataCode').lean(),
  ])
  const posMap = new Map(positions.map((p) => [p._id as string, (p as { code: string }).code]))
  const baseMap = new Map(airports.map((a) => [a._id as string, (a as { iataCode?: string }).iataCode ?? '—']))

  const byPos320: Record<string, number> = {}
  const byBase320: Record<string, number> = {}
  for (const c of activeA320) {
    const p = posMap.get(String((c as { position?: string }).position ?? '')) ?? '—'
    const b = baseMap.get(String((c as { base?: string }).base ?? '')) ?? '—'
    byPos320[p] = (byPos320[p] ?? 0) + 1
    byBase320[b] = (byBase320[b] ?? 0) + 1
  }

  console.log('\n── A320 qualified crew ──')
  console.log(`Total qualified: ${a320Ids.length}`)
  console.log(`Active/suspended: ${activeA320.length}`)
  console.log('By position:', byPos320)
  console.log('By base:', byBase320)

  console.log('\n── A321 qualified crew ──')
  console.log(`Total qualified: ${a321Ids.length}`)
  console.log(`Active/suspended: ${activeA321.length}`)

  console.log('\n── A320 OR A321 (unique crew) ──')
  console.log(`Active/suspended: ${activeBoth.length}`)

  await mongoose.disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
