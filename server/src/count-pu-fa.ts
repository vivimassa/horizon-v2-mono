import 'dotenv/config'
import mongoose from 'mongoose'
import { CrewMember } from './models/CrewMember.js'
import { CrewQualification } from './models/CrewQualification.js'
import { CrewPosition } from './models/CrewPosition.js'

const OPID = '20169cc0-c914-4662-a300-1dbbe20d1416'

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!)
  const positions = await CrewPosition.find({ operatorId: OPID }).select('_id code name').lean()
  console.log('All positions:', positions.map((p) => `${(p as any).code}=${(p as any).name}`).join(' · '))

  const a320Ids = (await CrewQualification.distinct('crewId', { operatorId: OPID, aircraftType: 'A320' })) as string[]
  const crew = await CrewMember.find({
    operatorId: OPID,
    _id: { $in: a320Ids },
    status: { $in: ['active', 'suspended'] },
  })
    .select('_id position')
    .lean()

  const posMap = new Map(positions.map((p: any) => [p._id as string, p.code as string]))
  const byPos: Record<string, number> = {}
  for (const c of crew) {
    const code = posMap.get(String((c as any).position ?? '')) ?? '—'
    byPos[code] = (byPos[code] ?? 0) + 1
  }
  console.log('\nA320 active/suspended by position:')
  for (const [k, v] of Object.entries(byPos).sort()) console.log(`  ${k.padEnd(6)} ${v}`)
  await mongoose.disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
