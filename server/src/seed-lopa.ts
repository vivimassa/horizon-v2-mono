import 'dotenv/config'
import crypto from 'node:crypto'
import { connectDB } from './db/connection.js'
import { CabinClass } from './models/CabinClass.js'
import { LopaConfig } from './models/LopaConfig.js'

const OPERATOR_ID = 'horizon'

const CABIN_CLASSES = [
  { code: 'F', name: 'First Class',       color: '#d97706', sortOrder: 1, seatLayout: '1-1',  seatPitchIn: 82, seatWidthIn: 36, seatType: 'suite',    hasIfe: true,  hasPower: true },
  { code: 'J', name: 'Business Class',    color: '#3b82f6', sortOrder: 2, seatLayout: '2-2',  seatPitchIn: 42, seatWidthIn: 21, seatType: 'lie-flat',  hasIfe: true,  hasPower: true },
  { code: 'W', name: 'Premium Economy',   color: '#8b5cf6', sortOrder: 3, seatLayout: '3-3',  seatPitchIn: 34, seatWidthIn: 19, seatType: 'premium',   hasIfe: true,  hasPower: true },
  { code: 'Y', name: 'Economy',           color: '#22c55e', sortOrder: 4, seatLayout: '3-3',  seatPitchIn: 29, seatWidthIn: 17, seatType: 'standard',  hasIfe: false, hasPower: true },
]

const LOPA_CONFIGS = [
  {
    aircraftType: 'A321',
    configName: 'A321 Standard (Y240)',
    cabins: [{ classCode: 'Y', seats: 240 }],
    totalSeats: 240,
    isDefault: true,
    notes: 'VietJet standard single-class A321 layout',
  },
]

async function seedLopa() {
  await connectDB()

  // Seed cabin classes (idempotent — skip existing)
  for (const cc of CABIN_CLASSES) {
    const existing = await CabinClass.findOne({ operatorId: OPERATOR_ID, code: cc.code })
    if (existing) {
      console.log(`  skip cabin class ${cc.code} — already exists`)
      continue
    }
    await CabinClass.create({
      _id: crypto.randomUUID(),
      operatorId: OPERATOR_ID,
      ...cc,
      isActive: true,
      createdAt: new Date().toISOString(),
    })
    console.log(`  + cabin class ${cc.code} (${cc.name})`)
  }

  // Seed LOPA configs (idempotent — skip existing)
  for (const lc of LOPA_CONFIGS) {
    const existing = await LopaConfig.findOne({
      operatorId: OPERATOR_ID,
      aircraftType: lc.aircraftType,
      configName: lc.configName,
    })
    if (existing) {
      console.log(`  skip LOPA config "${lc.configName}" — already exists`)
      continue
    }
    await LopaConfig.create({
      _id: crypto.randomUUID(),
      operatorId: OPERATOR_ID,
      ...lc,
      isActive: true,
      createdAt: new Date().toISOString(),
    })
    console.log(`  + LOPA config "${lc.configName}" (${lc.totalSeats} seats)`)
  }

  console.log('\nDone — LOPA seed complete')
  process.exit(0)
}

seedLopa().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
