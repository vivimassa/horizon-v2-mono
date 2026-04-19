/**
 * Seed 100 A320 Captains (CP) into SkyHub crew_members + crew_qualifications.
 *
 * Mirrors the canonical V1 seed (horizon-v2-mono/seed-crew.mjs):
 *   - ~25% Vietnamese (SURNAME MIDDLE GIVEN) + ~75% international
 *   - International pool spans Russian, American, Hispanic, Arabic, Thai,
 *     German, Eastern European, Scandinavian, French, Japanese, Portuguese
 *   - 30% of international captains also get a middle name
 *   - Employee IDs 1001–1100 (CP band)
 *   - employment_date randomised between 2015 and 2024
 *   - base picked randomly from whatever airports have isCrewBase=true
 *   - aircraft_type 'A320', ac_family_qualified = true
 *
 * Idempotent: clears employeeId 1001–1100 for the operator before inserting.
 */
import 'dotenv/config'
import crypto from 'node:crypto'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { Operator } from './models/Operator.js'
import { Airport } from './models/Airport.js'
import { CrewPosition } from './models/CrewPosition.js'
import { CrewMember } from './models/CrewMember.js'
import { CrewQualification } from './models/CrewQualification.js'
import { CrewExpiryDate } from './models/CrewExpiryDate.js'
import { syncCrewExpiries } from './services/sync-crew-expiries.js'

const TOTAL = 100
const ID_START = 1001

// ─── Vietnamese name pools (mirrored from seed-crew.mjs) ─────────────────────
const VN_SURNAMES = [
  'NGUYEN',
  'TRAN',
  'LE',
  'PHAM',
  'HOANG',
  'HUYNH',
  'PHAN',
  'VU',
  'VO',
  'DANG',
  'BUI',
  'DO',
  'HO',
  'NGO',
  'DUONG',
  'LY',
  'DINH',
  'TA',
  'LUONG',
  'MAI',
  'TRINH',
  'LAM',
  'DAO',
  'TRUONG',
  'DONG',
  'THAI',
  'TANG',
  'CAO',
]
const VN_MIDDLE_MALE = [
  'VAN',
  'MINH',
  'QUOC',
  'DUC',
  'THANH',
  'XUAN',
  'HONG',
  'NGOC',
  'HUU',
  'TIEN',
  'THE',
  'DINH',
  'CONG',
  'TRUNG',
  'BAO',
  'QUANG',
  'GIA',
  'HOANG',
]
const VN_GIVEN_MALE = [
  'TUAN',
  'HUNG',
  'DUNG',
  'HAI',
  'HIEU',
  'NAM',
  'LONG',
  'KHANH',
  'DAT',
  'PHUC',
  'QUAN',
  'TAI',
  'THANG',
  'HOAN',
  'VINH',
  'BINH',
  'SON',
  'KHOA',
  'THINH',
  'TRONG',
  'AN',
  'CUONG',
  'DUY',
  'NHAT',
  'SANG',
  'TRI',
  'BAO',
  'PHONG',
  'QUANG',
  'LINH',
  'MANH',
  'HUY',
  'TRUNG',
  'MINH',
  'TUNG',
]

// ─── International name pools (cockpit) ──────────────────────────────────────
const INTL_FIRST_MALE = [
  'ALEXANDER',
  'DMITRII',
  'SERGEI',
  'VADIM',
  'OLEG',
  'MIKHAIL',
  'ANDREI',
  'BARRY',
  'JAMES',
  'MICHAEL',
  'DAVID',
  'ROBERT',
  'RICHARD',
  'THOMAS',
  'CARLOS',
  'JUAN',
  'JOSE',
  'PEDRO',
  'MARCO',
  'FABIO',
  'PAOLO',
  'HARIS',
  'AHMED',
  'OMAR',
  'RICKY',
  'DANIEL',
  'STEFAN',
  'VIKTOR',
  'WORAWUT',
  'CHAIWAT',
  'SOMCHAI',
  'KEVIN',
  'PATRICK',
  'BRIAN',
  'SEAN',
  'BENJAMIN',
  'NICOLAS',
  'LUCAS',
  'MAXIM',
  'IGOR',
  'YURI',
  'ARTEM',
  'ANTONIO',
  'FERNANDO',
  'GABRIEL',
  'RAFAEL',
  'LEONARDO',
  'MATEO',
  'CHRIS',
  'JONATHAN',
  'TIMOTHY',
  'ANDREW',
  'WILLIAM',
  'PETER',
  'MARK',
  'IVAN',
  'ROMAN',
  'ALEKSEI',
  'NIKITA',
  'KIRILL',
  'DENIS',
  'EVGENY',
]
const INTL_LAST = [
  'ANIKIN',
  'SEREZHKIN',
  'CHEREPANOV',
  'GRIVTSOV',
  'PETROV',
  'VOLKOV',
  'SHEEHAN',
  'COOPER',
  'MURPHY',
  'BROWN',
  'WILSON',
  'TAYLOR',
  'CLARK',
  'SEGOVIA',
  'RODRIGUEZ',
  'MARTINEZ',
  'GARCIA',
  'LOPEZ',
  'HERNANDEZ',
  'FURQAN',
  'KHAN',
  'AHMED',
  'RASHID',
  'HASSAN',
  'ALI',
  'PLOYWONG',
  'SRISUK',
  'TANAKA',
  'NAKAMURA',
  'WATANABE',
  'WEBER',
  'MULLER',
  'SCHMIDT',
  'FISCHER',
  'BECKER',
  'MEYER',
  'HOFFMAN',
  'ABLOTIA',
  'MINCHEV',
  'IONESCU',
  'POPOV',
  'SOKOLOV',
  'MOROZOV',
  'NOVAK',
  'HORVAT',
  'SILVA',
  'SANTOS',
  'FERREIRA',
  'COSTA',
  'JENSEN',
  'NIELSEN',
  'HANSEN',
  'LARSEN',
  'BERG',
  'LUND',
  'DUBOIS',
  'MARTIN',
  'BERNARD',
  'MOREAU',
  'LAURENT',
  'LEROY',
]

// ─── Helpers ────────────────────────────────────────────────────────────────
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

function randomDate(yearFrom: number, yearTo: number): string {
  const y = yearFrom + Math.floor(Math.random() * (yearTo - yearFrom + 1))
  const m = 1 + Math.floor(Math.random() * 12)
  const d = 1 + Math.floor(Math.random() * 28)
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

interface Name {
  firstName: string
  middleName: string | null
  lastName: string
}

/** Vietnamese cockpit name: given → first_name, middle → middle_name, surname → last_name. */
function vnCockpitName(): Name {
  return {
    firstName: pick(VN_GIVEN_MALE),
    middleName: pick(VN_MIDDLE_MALE),
    lastName: pick(VN_SURNAMES),
  }
}

/** International cockpit name; 30% of the time with a middle name. */
function intlCockpitName(): Name {
  const firstName = pick(INTL_FIRST_MALE)
  const lastName = pick(INTL_LAST)
  const middleName = Math.random() < 0.3 ? pick(INTL_FIRST_MALE) : null
  return { firstName, middleName, lastName }
}

async function main() {
  console.log('Connecting to Mongo…')
  await connectDB(env.MONGODB_URI)

  const operatorId = process.env.SEED_OPERATOR_ID ?? (await Operator.findOne({ isActive: { $ne: false } }).lean())?._id
  if (!operatorId) {
    console.error('No operator found. Set SEED_OPERATOR_ID or create an Operator first.')
    process.exit(1)
  }
  console.log(`Operator: ${operatorId}`)

  const captain = await CrewPosition.findOne({ operatorId, code: 'CP' }).lean()
  if (!captain) {
    console.error('Crew position CP not found for this operator. Seed 5.4.2 Crew Positions first.')
    process.exit(1)
  }

  const crewBases = await Airport.find({ isCrewBase: true }, { _id: 1, iataCode: 1, icaoCode: 1 }).lean()
  let baseAirports = crewBases
  if (baseAirports.length === 0) {
    baseAirports = await Airport.find(
      { iataCode: { $in: ['SGN', 'HAN', 'CXR', 'DAD'] } },
      { _id: 1, iataCode: 1, icaoCode: 1 },
    ).lean()
  }
  if (baseAirports.length === 0) {
    console.warn('No bases available — crew will be created with base=null.')
  } else {
    console.log(`Bases available: ${baseAirports.map((b) => b.iataCode ?? b.icaoCode).join(', ')}`)
  }

  // Purge the 1001–1100 band for idempotency.
  const ids = Array.from({ length: TOTAL }, (_, i) => String(ID_START + i))
  const prior = await CrewMember.find({ operatorId, employeeId: { $in: ids } }, { _id: 1 }).lean()
  const priorIds = prior.map((d) => d._id as string)
  if (priorIds.length > 0) {
    console.log(`Purging ${priorIds.length} previously seeded captains…`)
    await Promise.all([
      CrewQualification.deleteMany({ crewId: { $in: priorIds } }),
      CrewExpiryDate.deleteMany({ crewId: { $in: priorIds } }),
      CrewMember.deleteMany({ _id: { $in: priorIds } }),
    ])
  }

  const now = new Date().toISOString()
  let vnCount = 0
  const crewDocs = ids.map((employeeId, i) => {
    const isVn = Math.random() < 0.25
    const name = isVn ? vnCockpitName() : intlCockpitName()
    if (isVn) vnCount++
    const baseDoc = baseAirports.length > 0 ? pick(baseAirports) : null
    return {
      _id: crypto.randomUUID(),
      operatorId,
      employeeId,
      firstName: name.firstName,
      middleName: name.middleName,
      lastName: name.lastName,
      shortCode: null,
      gender: 'male' as const,
      dateOfBirth: null,
      nationality: null,
      base: baseDoc?._id ?? null,
      position: captain._id as string,
      status: 'active' as const,
      employmentDate: randomDate(2015, 2024),
      exitDate: null,
      exitReason: null,
      contractType: null,
      seniority: i + 1,
      seniorityGroup: 0,
      languages: ['EN'],
      apisAlias: null,
      countryOfResidence: null,
      residencePermitNo: null,
      emailPrimary: null,
      emailSecondary: null,
      addressLine1: null,
      addressLine2: null,
      addressCity: null,
      addressState: null,
      addressZip: null,
      addressCountry: null,
      emergencyName: null,
      emergencyRelationship: null,
      emergencyPhone: null,
      noAccommodationAirports: [],
      transportRequired: false,
      hotelAtHomeBase: false,
      travelTimeMinutes: null,
      payrollNumber: null,
      minGuarantee: null,
      flyWithSeniorUntil: null,
      doNotScheduleAltPosition: null,
      standbyExempted: false,
      crewUnderTraining: false,
      noDomesticFlights: false,
      noInternationalFlights: false,
      maxLayoverStops: null,
      photoUrl: null,
      createdAt: now,
      updatedAt: now,
    }
  })

  console.log(`Inserting ${crewDocs.length} crew members (${vnCount} Vietnamese, ${TOTAL - vnCount} international)…`)
  await CrewMember.insertMany(crewDocs)

  console.log(`Inserting ${crewDocs.length} A320 captain qualifications…`)
  const qualDocs = crewDocs.map((c) => ({
    _id: crypto.randomUUID(),
    operatorId,
    crewId: c._id,
    base: c.base,
    aircraftType: 'A320',
    position: captain._id as string,
    startDate: '2020-01-01',
    endDate: null,
    isPrimary: true,
    acFamilyQualified: true,
    trainingQuals: [],
    createdAt: now,
    updatedAt: now,
  }))
  await CrewQualification.insertMany(qualDocs)

  console.log('Syncing expiry rows from 5.4.3 Crew Expiry Codes…')
  let synced = 0
  for (const c of crewDocs) {
    await syncCrewExpiries(c._id, operatorId as string)
    synced++
    if (synced % 25 === 0) console.log(`  synced ${synced}/${crewDocs.length}`)
  }

  console.log('\n─────────────────────────────────────────────')
  console.log(`  Seeded ${crewDocs.length} A320 Captains`)
  console.log(`  Vietnamese: ${vnCount}   International: ${TOTAL - vnCount}`)
  console.log(`  IDs: ${ids[0]}–${ids[ids.length - 1]}`)
  if (baseAirports.length > 0) {
    const counts: Record<string, number> = {}
    for (const c of crewDocs) {
      const k = baseAirports.find((b) => b._id === c.base)?.iataCode ?? '—'
      counts[k] = (counts[k] ?? 0) + 1
    }
    console.log(
      `  Bases: ${Object.entries(counts)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')}`,
    )
  }
  console.log('─────────────────────────────────────────────')
  process.exit(0)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
