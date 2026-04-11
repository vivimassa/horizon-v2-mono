import 'dotenv/config'
import mongoose from 'mongoose'
import { FlightInstance } from './models/FlightInstance.js'

const OPERATOR_ID = 'horizon'
const TODAY = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

// Helper: create UTC timestamp for today at given hour:minute
function todayUtc(h: number, m: number): number {
  const d = new Date(`${TODAY}T00:00:00Z`)
  d.setUTCHours(h, m, 0, 0)
  return d.getTime()
}

interface SeedFlight {
  flightNumber: string
  depIcao: string
  depIata: string
  arrIcao: string
  arrIata: string
  stdH: number
  stdM: number
  staH: number
  staM: number
  tail: string
  icaoType: string
  status: string
}

const flights: SeedFlight[] = [
  {
    flightNumber: 'HZ101',
    depIcao: 'VVTS',
    depIata: 'SGN',
    arrIcao: 'VVNB',
    arrIata: 'HAN',
    stdH: 6,
    stdM: 0,
    staH: 8,
    staM: 10,
    tail: 'VN-A321',
    icaoType: 'A321',
    status: 'departed',
  },
  {
    flightNumber: 'HZ102',
    depIcao: 'VVNB',
    depIata: 'HAN',
    arrIcao: 'VVTS',
    arrIata: 'SGN',
    stdH: 9,
    stdM: 30,
    staH: 11,
    staM: 40,
    tail: 'VN-A321',
    icaoType: 'A321',
    status: 'onTime',
  },
  {
    flightNumber: 'HZ203',
    depIcao: 'VVTS',
    depIata: 'SGN',
    arrIcao: 'VVDN',
    arrIata: 'DAD',
    stdH: 7,
    stdM: 15,
    staH: 8,
    staM: 35,
    tail: 'VN-A320',
    icaoType: 'A320',
    status: 'departed',
  },
  {
    flightNumber: 'HZ204',
    depIcao: 'VVDN',
    depIata: 'DAD',
    arrIcao: 'VVTS',
    arrIata: 'SGN',
    stdH: 10,
    stdM: 0,
    staH: 11,
    staM: 20,
    tail: 'VN-A320',
    icaoType: 'A320',
    status: 'delayed',
  },
  {
    flightNumber: 'HZ305',
    depIcao: 'VVNB',
    depIata: 'HAN',
    arrIcao: 'VVDN',
    arrIata: 'DAD',
    stdH: 8,
    stdM: 0,
    staH: 9,
    staM: 15,
    tail: 'VN-B738',
    icaoType: 'B738',
    status: 'onTime',
  },
  {
    flightNumber: 'HZ306',
    depIcao: 'VVDN',
    depIata: 'DAD',
    arrIcao: 'VVNB',
    arrIata: 'HAN',
    stdH: 11,
    stdM: 30,
    staH: 12,
    staM: 45,
    tail: 'VN-B738',
    icaoType: 'B738',
    status: 'scheduled',
  },
  {
    flightNumber: 'HZ407',
    depIcao: 'VVTS',
    depIata: 'SGN',
    arrIcao: 'VVPQ',
    arrIata: 'PQC',
    stdH: 12,
    stdM: 0,
    staH: 13,
    staM: 0,
    tail: 'VN-A319',
    icaoType: 'A319',
    status: 'scheduled',
  },
  {
    flightNumber: 'HZ408',
    depIcao: 'VVPQ',
    depIata: 'PQC',
    arrIcao: 'VVTS',
    arrIata: 'SGN',
    stdH: 14,
    stdM: 30,
    staH: 15,
    staM: 30,
    tail: 'VN-A319',
    icaoType: 'A319',
    status: 'scheduled',
  },
  {
    flightNumber: 'HZ509',
    depIcao: 'VVTS',
    depIata: 'SGN',
    arrIcao: 'VVCR',
    arrIata: 'CXR',
    stdH: 13,
    stdM: 45,
    staH: 14,
    staM: 45,
    tail: 'VN-A322',
    icaoType: 'A321',
    status: 'scheduled',
  },
  {
    flightNumber: 'HZ510',
    depIcao: 'VVCR',
    depIata: 'CXR',
    arrIcao: 'VVTS',
    arrIata: 'SGN',
    stdH: 16,
    stdM: 0,
    staH: 17,
    staM: 0,
    tail: 'VN-A322',
    icaoType: 'A321',
    status: 'cancelled',
  },
]

async function seed(): Promise<void> {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI not set')

  await mongoose.connect(uri)
  console.log('✓ Connected to MongoDB')

  // Clear existing seed data for today
  const deleted = await FlightInstance.deleteMany({
    operatorId: OPERATOR_ID,
    operatingDate: TODAY,
  })
  console.log(`  Cleared ${deleted.deletedCount} existing flights for ${TODAY}`)

  const docs = flights.map((f) => ({
    _id: `${OPERATOR_ID}-${f.flightNumber}-${TODAY}`,
    operatorId: OPERATOR_ID,
    flightNumber: f.flightNumber,
    operatingDate: TODAY,
    dep: { icao: f.depIcao, iata: f.depIata },
    arr: { icao: f.arrIcao, iata: f.arrIata },
    schedule: { stdUtc: todayUtc(f.stdH, f.stdM), staUtc: todayUtc(f.staH, f.staM) },
    actual: {
      atdUtc: f.status === 'departed' ? todayUtc(f.stdH, f.stdM + 5) : null,
      ataUtc: null,
    },
    tail: { registration: f.tail, icaoType: f.icaoType },
    crew: [],
    delays: f.status === 'delayed' ? [{ code: '81', minutes: 25, reason: 'ATC flow control' }] : [],
    status: f.status,
    syncMeta: { updatedAt: Date.now(), version: 1 },
  }))

  await FlightInstance.insertMany(docs)
  console.log(`✓ Seeded ${docs.length} flights for ${TODAY}`)

  await mongoose.disconnect()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
