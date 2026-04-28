import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { CrewMember } from './models/CrewMember.js'

const OPID = '20169cc0-c914-4662-a300-1dbbe20d1416'
const EID = process.argv[2] ?? '10178'
const PIN = process.argv[3] ?? '123456'
const TTL_HOURS = 72

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!)

  const crew = await CrewMember.findOne({ operatorId: OPID, employeeId: EID }).lean()
  if (!crew) {
    console.error(`Crew not found: operatorId=${OPID} employeeId=${EID}`)
    process.exit(1)
  }
  if ((crew as any).status !== 'active') {
    console.error(`Crew ${EID} status=${(crew as any).status} — must be active`)
    process.exit(1)
  }

  const hash = await bcrypt.hash(PIN, 12)
  const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60_000).toISOString()

  await CrewMember.updateOne(
    { _id: (crew as any)._id, operatorId: OPID },
    {
      $set: {
        'crewApp.tempPinHash': hash,
        'crewApp.tempPinExpiresAt': expiresAt,
        'crewApp.pinHash': null,
        'crewApp.pinFailedAttempts': 0,
        'crewApp.pinLockedUntil': null,
        updatedAt: new Date().toISOString(),
      },
    },
  )

  console.log(`OK — issued temp PIN for EID=${EID}`)
  console.log(`  crewId:    ${(crew as any)._id}`)
  console.log(`  name:      ${(crew as any).firstName} ${(crew as any).lastName}`)
  console.log(`  tempPin:   ${PIN}`)
  console.log(`  expiresAt: ${expiresAt}`)
  console.log(`  ttl:       ${TTL_HOURS}h`)
  console.log('\nUse: operatorId=SkyHub Aviation, EID=' + EID + ', tempPin=' + PIN)
  console.log('First-login flow will prompt for new permanent 6-digit PIN.')

  await mongoose.disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
