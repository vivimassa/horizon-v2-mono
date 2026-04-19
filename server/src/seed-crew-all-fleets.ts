/**
 * Seed industry-standard crew complement across all fleets.
 *
 * Formula:  crew = ceil( min_per_flight × aircraft_count × sets_per_aircraft )
 *
 * Sets-per-aircraft (industry norms):
 *   - A320 family: 5.3 sets (narrowbody, short-haul intensive utilisation)
 *   - A350       : 6.5 sets (wide-body long-haul, often augmented crew)
 *   - A380       : 8   sets (superjumbo ULH with double augmented crew)
 *
 * A320 + A321 are handled as ONE family: each of those crew has a single
 * qualification row (aircraftType='A320', acFamilyQualified=true) which
 * covers both variants. A350 and A380 are standalone types.
 *
 * Per-flight minimum complement:
 *   A320/A321 : CP=1 FO=1 PU=1 CA=4
 *   A350      : CP=2 FO=2 PU=2 CA=8
 *   A380      : CP=2 FO=2 PU=4 CA=14
 *
 * Fleet sizes in this DB: A320 10 + A321 40 = 50, A350 30, A380 20.
 *
 * Naming mirrors V1 (horizon-v2-mono/seed-crew.mjs + seed-crew-320.ts):
 *   - Cockpit: ~25% Vietnamese SURNAME MIDDLE GIVEN, ~75% international
 *   - Cabin  : 90% Vietnamese, first_name=family, last_name=GIVEN with
 *              "GIVEN N" suffix when the given-name collides (ANH, ANH 2,
 *              ANH 3…). 10% international.
 *
 * Idempotent: purges employeeId ranges 1001–1300, 2001–2300, 3001–3380,
 * 4001–5440 for the operator before inserting.
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

// ─── Fleet math ─────────────────────────────────────────────────────────────
interface FleetSpec {
  aircraftType: string // ICAO code used on the qualification row
  acFamilyQualified: boolean
  aircraftCount: number
  setsPerAircraft: number // industry crewing ratio — ceil applied on totals
  // Per-aircraft min complement (per single flight)
  min: { CP: number; FO: number; PU: number; CA: number }
}
const FLEETS: FleetSpec[] = [
  {
    aircraftType: 'A320',
    acFamilyQualified: true, // covers A321 automatically
    aircraftCount: 50, // 10 A320 + 40 A321
    setsPerAircraft: 5.3,
    min: { CP: 1, FO: 1, PU: 1, CA: 4 },
  },
  {
    aircraftType: 'A350',
    acFamilyQualified: false,
    aircraftCount: 30,
    setsPerAircraft: 6.5, // mid of industry 6–7 for long-haul wide-body
    min: { CP: 2, FO: 2, PU: 2, CA: 8 },
  },
  {
    aircraftType: 'A380',
    acFamilyQualified: false,
    aircraftCount: 20,
    setsPerAircraft: 8,
    min: { CP: 2, FO: 2, PU: 4, CA: 14 },
  },
]

function targetFor(fleet: FleetSpec, position: 'CP' | 'FO' | 'PU' | 'CA'): number {
  return Math.ceil(fleet.min[position] * fleet.aircraftCount * fleet.setsPerAircraft)
}

// ─── Name pools (mirror seed-crew.mjs + seed-crew-320.ts) ────────────────────
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
const VN_MIDDLE_FEMALE = [
  'THI',
  'NGOC',
  'HONG',
  'PHUONG',
  'THANH',
  'THUY',
  'XUAN',
  'KHANH',
  'MINH',
  'TRAM',
  'DIEU',
  'BICH',
  'TUYET',
  'ANH',
  'MAI',
  'HUONG',
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
const VN_GIVEN_FEMALE = [
  'LINH',
  'TRANG',
  'HUONG',
  'LAN',
  'THAO',
  'NHU',
  'HANH',
  'ANH',
  'QUYNH',
  'NGOC',
  'TRAM',
  'PHUONG',
  'DUNG',
  'HA',
  'MAI',
  'HIEN',
  'UYEN',
  'NGAN',
  'TRINH',
  'VAN',
  'HANG',
  'THUY',
  'YEN',
  'CHI',
  'DIEP',
  'KHANH',
  'NHI',
  'OANH',
  'SUONG',
  'TUYET',
  'HOAN',
  'GIANG',
  'DUYEN',
  'MY',
  'TIEN',
]
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
const INTL_FIRST_FEMALE = [
  'ELENA',
  'ANNA',
  'NATALIA',
  'OLGA',
  'IRINA',
  'EKATERINA',
  'MARIA',
  'SARAH',
  'EMILY',
  'LAURA',
  'REBECCA',
  'JENNIFER',
  'LINDA',
  'JESSICA',
  'ISABELLA',
  'SOFIA',
  'LUCIA',
  'VALENTINA',
  'CAMILA',
  'FATIMA',
  'LAYLA',
  'SIRIPORN',
  'MALEE',
  'CHANTIDA',
  'JASMINE',
  'YASMIN',
  'AMAL',
  'NADIA',
  'HELEN',
  'JULIA',
  'MARGARET',
  'OLIVIA',
  'AMELIA',
  'CHARLOTTE',
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

// ─── RNG helpers ────────────────────────────────────────────────────────────
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

function randomDate(yearFrom: number, yearTo: number): string {
  const y = yearFrom + Math.floor(Math.random() * (yearTo - yearFrom + 1))
  const m = 1 + Math.floor(Math.random() * 12)
  const d = 1 + Math.floor(Math.random() * 28)
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Random YYYY-MM-DD between `fromIso` (inclusive) and `toIso` (inclusive). */
function randomDateBetween(fromIso: string, toIso: string): string {
  const a = Date.parse(fromIso)
  const b = Date.parse(toIso)
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  const t = lo + Math.floor(Math.random() * (hi - lo + 1))
  return new Date(t).toISOString().slice(0, 10)
}

// ─── Name generators ────────────────────────────────────────────────────────
interface NameTriple {
  firstName: string
  middleName: string | null
  lastName: string
  gender: 'male' | 'female'
}

function vnCockpitName(): NameTriple {
  return {
    firstName: pick(VN_GIVEN_MALE),
    middleName: pick(VN_MIDDLE_MALE),
    lastName: pick(VN_SURNAMES),
    gender: 'male',
  }
}
function intlCockpitName(): NameTriple {
  const first = pick(INTL_FIRST_MALE)
  const last = pick(INTL_LAST)
  const mid = Math.random() < 0.3 ? pick(INTL_FIRST_MALE) : null
  return { firstName: first, middleName: mid, lastName: last, gender: 'male' }
}
function cockpitNames(count: number): NameTriple[] {
  return Array.from({ length: count }, () => (Math.random() < 0.25 ? vnCockpitName() : intlCockpitName()))
}

/**
 * Cabin name generator (mirrors seed-crew-320.ts):
 *   first_name = family name (NGUYEN, TRAN…)
 *   last_name  = given name, with "<given> N" numeric suffix when the same
 *                given appears multiple times in this pool
 *                (so users see ANH, ANH 2, ANH 3…)
 *   middle_name = Vietnamese middle particle or null
 */
function cabinNames(count: number, femaleRatio: number): NameTriple[] {
  // Pass 1: build raw pairs with gender
  const raw = Array.from({ length: count }, () => {
    const gender: 'male' | 'female' = Math.random() < femaleRatio ? 'female' : 'male'
    const isVn = Math.random() < 0.9
    if (isVn) {
      return {
        gender,
        family: pick(VN_SURNAMES),
        middle: pick(gender === 'female' ? VN_MIDDLE_FEMALE : VN_MIDDLE_MALE),
        given: pick(gender === 'female' ? VN_GIVEN_FEMALE : VN_GIVEN_MALE),
        intl: null as null | NameTriple,
      }
    }
    // 10% international — reuse intl male/female pools
    const first = gender === 'female' ? pick(INTL_FIRST_FEMALE) : pick(INTL_FIRST_MALE)
    return {
      gender,
      family: '',
      middle: '',
      given: '',
      intl: { firstName: first, middleName: null, lastName: pick(INTL_LAST), gender } as NameTriple,
    }
  })
  // Pass 2: count duplicates of given name (VN only)
  const givenCount: Record<string, number> = {}
  for (const r of raw) if (!r.intl) givenCount[r.given] = (givenCount[r.given] ?? 0) + 1
  const givenSeen: Record<string, number> = {}
  return raw.map((r) => {
    if (r.intl) return r.intl
    givenSeen[r.given] = (givenSeen[r.given] ?? 0) + 1
    const lastName = givenCount[r.given] > 1 ? `${r.given} ${givenSeen[r.given]}` : r.given
    return {
      firstName: r.family,
      middleName: r.middle,
      lastName,
      gender: r.gender,
    }
  })
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('Connecting to Mongo…')
  await connectDB(env.MONGODB_URI)

  const operatorId = process.env.SEED_OPERATOR_ID ?? (await Operator.findOne({ isActive: { $ne: false } }).lean())?._id
  if (!operatorId) {
    console.error('No operator found.')
    process.exit(1)
  }
  console.log(`Operator: ${operatorId}`)

  // Resolve the 4 crew positions
  const positions = await CrewPosition.find({ operatorId, code: { $in: ['CP', 'FO', 'PU', 'CA'] } }).lean()
  const posId: Record<string, string> = {}
  for (const p of positions) posId[p.code] = p._id as string
  for (const code of ['CP', 'FO', 'PU', 'CA']) {
    if (!posId[code]) {
      console.error(`Crew position ${code} missing — seed 5.4.2 Crew Positions first.`)
      process.exit(1)
    }
  }
  console.log(
    `Positions: ${Object.entries(posId)
      .map(([k]) => k)
      .join(', ')}`,
  )

  // Resolve crew bases
  const crewBases = await Airport.find({ isCrewBase: true }, { _id: 1, iataCode: 1, icaoCode: 1 }).lean()
  const bases =
    crewBases.length > 0
      ? crewBases
      : await Airport.find({ iataCode: { $in: ['SGN', 'HAN'] } }, { _id: 1, iataCode: 1, icaoCode: 1 }).lean()
  if (bases.length === 0) {
    console.warn('No bases available — crew will have base=null.')
  } else {
    console.log(`Bases: ${bases.map((b) => b.iataCode).join(', ')}`)
  }

  // Compute totals
  type Pos = 'CP' | 'FO' | 'PU' | 'CA'
  const grand: Record<Pos, number> = { CP: 0, FO: 0, PU: 0, CA: 0 }
  for (const fleet of FLEETS) for (const p of ['CP', 'FO', 'PU', 'CA'] as Pos[]) grand[p] += targetFor(fleet, p)

  console.log('\nPlanned seed:')
  for (const f of FLEETS) {
    const parts = (['CP', 'FO', 'PU', 'CA'] as Pos[]).map((p) => `${p}=${targetFor(f, p)}`).join(' ')
    console.log(`  ${f.aircraftType}${f.acFamilyQualified ? ' (family)' : ''}  ×${f.aircraftCount} a/c  →  ${parts}`)
  }
  console.log(
    `  TOTAL  →  CP=${grand.CP}  FO=${grand.FO}  PU=${grand.PU}  CA=${grand.CA}  (${grand.CP + grand.FO + grand.PU + grand.CA})`,
  )

  // Employee-ID bands — 5-digit IDs to avoid any overlap as counts grow.
  //   CP  10001+  FO  20001+  PU  30001+  CA  40001+
  const ID_BAND: Record<Pos, number> = { CP: 10001, FO: 20001, PU: 30001, CA: 40001 }

  // Purge previously seeded crew — old 4-digit (1001–9999) and new 5-digit
  // bands, owned by this operator.
  const existing = await CrewMember.find({ operatorId, employeeId: { $regex: /^\d{4,5}$/ } }, { _id: 1 }).lean()
  if (existing.length > 0) {
    const ids = existing.map((d) => d._id as string)
    console.log(`\nPurging ${ids.length} previously seeded crew…`)
    await Promise.all([
      CrewQualification.deleteMany({ crewId: { $in: ids } }),
      CrewExpiryDate.deleteMany({ crewId: { $in: ids } }),
      CrewMember.deleteMany({ _id: { $in: ids } }),
    ])
  }

  // Build crew rows
  const now = new Date().toISOString()
  const allCrew: Array<Record<string, unknown>> = []
  const allQuals: Array<Record<string, unknown>> = []

  const nextId: Record<Pos, number> = { ...ID_BAND }

  const today = new Date().toISOString().slice(0, 10)

  const makeCrew = (name: NameTriple, position: Pos, fleet: FleetSpec) => {
    const baseDoc = bases.length > 0 ? pick(bases) : null
    const id = crypto.randomUUID()
    const employeeId = String(nextId[position]++)
    const employmentDate = randomDate(2015, 2024)
    // Type-rating / qualification start: any time between the hire date and
    // today, so the grid's FROM column is realistic (and never predates the
    // employment date).
    const qualStartDate = randomDateBetween(employmentDate, today)
    allCrew.push({
      _id: id,
      operatorId,
      employeeId,
      firstName: name.firstName,
      middleName: name.middleName,
      lastName: name.lastName,
      shortCode: null,
      gender: name.gender,
      dateOfBirth: null,
      nationality: null,
      base: baseDoc?._id ?? null,
      position: posId[position],
      status: 'active',
      employmentDate,
      exitDate: null,
      exitReason: null,
      contractType: null,
      // Seniority is re-assigned after the full pool is built — based on
      // employmentDate order — so the number actually reflects tenure.
      seniority: 0,
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
    })
    allQuals.push({
      _id: crypto.randomUUID(),
      operatorId,
      crewId: id,
      base: baseDoc?._id ?? null,
      aircraftType: fleet.aircraftType,
      position: posId[position],
      startDate: qualStartDate,
      endDate: null,
      isPrimary: true,
      acFamilyQualified: fleet.acFamilyQualified,
      trainingQuals: [],
      createdAt: now,
      updatedAt: now,
    })
  }

  for (const fleet of FLEETS) {
    // Cockpit
    const cpNames = cockpitNames(targetFor(fleet, 'CP'))
    cpNames.forEach((n) => makeCrew(n, 'CP', fleet))
    const foNames = cockpitNames(targetFor(fleet, 'FO'))
    foNames.forEach((n) => makeCrew(n, 'FO', fleet))
    // Cabin: PU ~70% female, CA ~60% female (matches V1)
    const puNames = cabinNames(targetFor(fleet, 'PU'), 0.7)
    puNames.forEach((n) => makeCrew(n, 'PU', fleet))
    const caNames = cabinNames(targetFor(fleet, 'CA'), 0.6)
    caNames.forEach((n) => makeCrew(n, 'CA', fleet))
  }

  // Assign seniority by employmentDate within each position (earliest = #1).
  const byPos: Record<Pos, Array<Record<string, unknown>>> = { CP: [], FO: [], PU: [], CA: [] }
  const posIdToCode = Object.fromEntries(Object.entries(posId).map(([code, id]) => [id, code as Pos])) as Record<
    string,
    Pos
  >
  for (const c of allCrew) byPos[posIdToCode[c.position as string]].push(c)
  for (const p of Object.keys(byPos) as Pos[]) {
    byPos[p].sort((a, b) => (a.employmentDate as string).localeCompare(b.employmentDate as string))
    byPos[p].forEach((c, i) => {
      c.seniority = i + 1
    })
  }

  // Bulk insert (Mongo 50k limit — we're well under)
  console.log(`\nInserting ${allCrew.length} crew members…`)
  for (let i = 0; i < allCrew.length; i += 500) {
    await CrewMember.insertMany(allCrew.slice(i, i + 500))
  }
  console.log(`Inserting ${allQuals.length} qualifications…`)
  for (let i = 0; i < allQuals.length; i += 500) {
    await CrewQualification.insertMany(allQuals.slice(i, i + 500))
  }

  // Distribution summary
  const baseCount: Record<string, number> = {}
  for (const c of allCrew) {
    const k = bases.find((b) => b._id === (c.base as string))?.iataCode ?? '—'
    baseCount[k] = (baseCount[k] ?? 0) + 1
  }

  console.log('\n─────────────────────────────────────────────')
  console.log(`  Seeded ${allCrew.length} crew members and ${allQuals.length} qualifications`)
  console.log(`  CP=${grand.CP}  FO=${grand.FO}  PU=${grand.PU}  CA=${grand.CA}`)
  console.log(
    `  Bases: ${Object.entries(baseCount)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')}`,
  )
  console.log(
    `  Expiry rows not yet synced — trigger from the Crew Profile page (any qualification edit)` +
      `\n  or add a batch sync script if you need them populated for all 2.4k crew.`,
  )
  console.log('─────────────────────────────────────────────')
  process.exit(0)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
