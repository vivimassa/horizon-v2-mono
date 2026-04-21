/**
 * Idempotent seed: fills in contact + identity fields on every CrewMember
 * for the resolved operator. Only fields missing (null/empty) are written,
 * so re-running is safe and will not overwrite real data.
 *
 * Fields populated on CrewMember:
 *   - emailPrimary
 *   - addressLine1, addressCity, addressState, addressCountry
 *   - emergencyName, emergencyRelationship, emergencyPhone
 *   - dateOfBirth
 *   - nationality
 *
 * Passport rows are handled by seed-crew-passports.ts.
 *
 * Run:  pnpm --filter server exec tsx src/seed-crew-contacts.ts
 */
import 'dotenv/config'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { Operator } from './models/Operator.js'
import { CrewMember } from './models/CrewMember.js'

type Addr = { line1: string; city: string; state: string; country: string }

// City templates per nationality — keyed by country code.
const ADDRESSES: Record<string, Addr[]> = {
  VN: [
    { line1: '12 Nguyen Hue', city: 'Ho Chi Minh City', state: 'HCMC', country: 'VN' },
    { line1: '88 Tran Hung Dao', city: 'Ho Chi Minh City', state: 'HCMC', country: 'VN' },
    { line1: '204 Le Loi', city: 'Ho Chi Minh City', state: 'HCMC', country: 'VN' },
    { line1: '45 Hang Bong', city: 'Hanoi', state: 'Hoan Kiem', country: 'VN' },
    { line1: '17 Tran Phu', city: 'Hanoi', state: 'Ba Dinh', country: 'VN' },
    { line1: '221 Bach Dang', city: 'Da Nang', state: 'Hai Chau', country: 'VN' },
    { line1: '76 Hung Vuong', city: 'Nha Trang', state: 'Khanh Hoa', country: 'VN' },
  ],
  RU: [
    { line1: 'ul. Tverskaya 12', city: 'Moscow', state: 'Moscow', country: 'RU' },
    { line1: 'Nevsky pr. 44', city: 'Saint Petersburg', state: 'Saint Petersburg', country: 'RU' },
  ],
  US: [
    { line1: '450 Mission St', city: 'San Francisco', state: 'CA', country: 'US' },
    { line1: '1201 Elm St', city: 'Dallas', state: 'TX', country: 'US' },
    { line1: '88 Park Ave', city: 'New York', state: 'NY', country: 'US' },
  ],
  GB: [
    { line1: '33 Baker Street', city: 'London', state: 'Greater London', country: 'GB' },
    { line1: '12 Deansgate', city: 'Manchester', state: 'Greater Manchester', country: 'GB' },
  ],
  TH: [
    { line1: '142 Sukhumvit Rd', city: 'Bangkok', state: 'Watthana', country: 'TH' },
    { line1: '55 Chang Klan Rd', city: 'Chiang Mai', state: 'Chiang Mai', country: 'TH' },
  ],
  ES: [{ line1: 'Gran Via 28', city: 'Madrid', state: 'Madrid', country: 'ES' }],
  IT: [{ line1: 'Via del Corso 101', city: 'Rome', state: 'Lazio', country: 'IT' }],
  BR: [{ line1: 'Av. Paulista 1500', city: 'Sao Paulo', state: 'SP', country: 'BR' }],
  DE: [{ line1: 'Unter den Linden 5', city: 'Berlin', state: 'Berlin', country: 'DE' }],
  FR: [{ line1: '14 Rue de Rivoli', city: 'Paris', state: 'Ile-de-France', country: 'FR' }],
}

// Mapping of common VN surnames for nationality inference.
const VN_SURNAMES = new Set([
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
])
const RU_LAST_HINTS = ['OV', 'EV', 'IN', 'SKY', 'KIN']
const BR_FIRST = new Set(['CARLOS', 'JUAN', 'JOSE', 'PEDRO', 'GABRIEL', 'RAFAEL', 'LEONARDO', 'MATEO'])
const IT_FIRST = new Set(['MARCO', 'FABIO', 'PAOLO', 'ANTONIO', 'FERNANDO'])
const TH_FIRST = new Set(['WORAWUT', 'CHAIWAT', 'SOMCHAI', 'SIRIPORN', 'MALEE', 'CHANTIDA'])
const US_FIRST = new Set([
  'JAMES',
  'MICHAEL',
  'DAVID',
  'ROBERT',
  'RICHARD',
  'THOMAS',
  'KEVIN',
  'PATRICK',
  'BRIAN',
  'SEAN',
  'BENJAMIN',
  'CHRIS',
  'JONATHAN',
  'TIMOTHY',
  'ANDREW',
  'WILLIAM',
  'PETER',
  'MARK',
  'JENNIFER',
  'SARAH',
  'EMILY',
  'LAURA',
  'REBECCA',
  'LINDA',
  'JESSICA',
  'HELEN',
  'JULIA',
  'MARGARET',
  'OLIVIA',
  'AMELIA',
  'CHARLOTTE',
])

function inferNationality(firstName: string, lastName: string): string {
  const fn = (firstName ?? '').toUpperCase()
  const ln = (lastName ?? '').toUpperCase().split(' ')[0]
  if (VN_SURNAMES.has(ln) || VN_SURNAMES.has(fn)) return 'VN'
  if (TH_FIRST.has(fn)) return 'TH'
  if (BR_FIRST.has(fn)) return 'BR'
  if (IT_FIRST.has(fn)) return 'IT'
  if (US_FIRST.has(fn)) return 'US'
  if (RU_LAST_HINTS.some((s) => ln.endsWith(s))) return 'RU'
  // Fallback spread across a few countries — deterministic by employeeId hash later.
  return 'US'
}

function hashInt(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return Math.abs(h | 0)
}

function pickAddr(nat: string, seed: number): Addr {
  const pool = ADDRESSES[nat] ?? ADDRESSES.US
  return pool[seed % pool.length]
}

// Deterministic phone per crew — format depends on country.
function phoneFor(nat: string, seed: number): string {
  const n = (seed % 9000000) + 1000000 // 7 digits
  switch (nat) {
    case 'VN':
      return `+84 9${String(seed % 100).padStart(2, '0')} ${String(n).slice(0, 3)} ${String(n).slice(3)}`
    case 'US':
      return `+1 (415) ${String(n).slice(0, 3)}-${String(n).slice(3)}`
    case 'GB':
      return `+44 20 ${String(n).slice(0, 4)} ${String(n).slice(4)}`
    case 'TH':
      return `+66 8${String(seed % 10)} ${String(n).slice(0, 3)} ${String(n).slice(3)}`
    case 'RU':
      return `+7 9${String(seed % 100).padStart(2, '0')} ${String(n).slice(0, 3)}-${String(n).slice(3, 5)}-${String(n).slice(5)}`
    default:
      return `+1 (415) ${String(n).slice(0, 3)}-${String(n).slice(3)}`
  }
}

const EMERGENCY_RELATIONSHIPS = ['Spouse', 'Parent', 'Sibling', 'Partner', 'Child']
const EMERGENCY_VN = ['Nguyen Thi Lan', 'Tran Van Hung', 'Pham Ngoc Mai', 'Le Thi Hoa', 'Vu Van Binh', 'Do Thi Huong']
const EMERGENCY_INTL = [
  'Sarah Johnson',
  'Michael Brown',
  'Elena Petrova',
  'Carlos Rivera',
  'Anna Schmidt',
  'John Smith',
]

function emergencyName(nat: string, seed: number): string {
  const pool = nat === 'VN' ? EMERGENCY_VN : EMERGENCY_INTL
  return pool[seed % pool.length]
}

function emailFor(firstName: string, lastName: string, employeeId: string): string {
  const norm = (s: string) =>
    (s ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '')
  const f = norm(firstName) || 'crew'
  const l = norm(lastName) || 'member'
  return `${f}.${l}.${employeeId}@skyhub.ops`
}

function dobFor(employmentDate: string | null | undefined, seed: number): string {
  // DOB = (employmentDate year − (25..40)) − random day offset.
  const hireYear = employmentDate ? Number(employmentDate.slice(0, 4)) : 2020
  const ageAtHire = 25 + (seed % 16) // 25–40
  const year = hireYear - ageAtHire
  const month = 1 + (seed % 12)
  const day = 1 + ((seed >> 3) % 28)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

async function main() {
  console.log('Connecting to Mongo…')
  await connectDB(env.MONGODB_URI)

  const operatorId = process.env.SEED_OPERATOR_ID ?? (await Operator.findOne({ isActive: { $ne: false } }).lean())?._id
  if (!operatorId) {
    console.error('No operator found.')
    process.exit(1)
  }
  console.log(`Operator: ${operatorId}`)

  const crew = await CrewMember.find(
    { operatorId },
    {
      _id: 1,
      employeeId: 1,
      firstName: 1,
      lastName: 1,
      employmentDate: 1,
      emailPrimary: 1,
      addressLine1: 1,
      addressCity: 1,
      addressState: 1,
      addressCountry: 1,
      emergencyName: 1,
      emergencyRelationship: 1,
      emergencyPhone: 1,
      dateOfBirth: 1,
      nationality: 1,
    },
  ).lean()

  console.log(`Found ${crew.length} crew — building update plan…`)

  const now = new Date().toISOString()
  const ops: Array<{ updateOne: { filter: { _id: string }; update: { $set: Record<string, unknown> } } }> = []
  let touched = 0

  for (const c of crew) {
    const seed = hashInt(String(c.employeeId ?? c._id))
    const nat = c.nationality ?? inferNationality(c.firstName ?? '', c.lastName ?? '')
    const addr = pickAddr(nat, seed)
    const set: Record<string, unknown> = {}

    if (!c.emailPrimary) set.emailPrimary = emailFor(c.firstName ?? '', c.lastName ?? '', String(c.employeeId ?? c._id))
    if (!c.addressLine1) set.addressLine1 = addr.line1
    if (!c.addressCity) set.addressCity = addr.city
    if (!c.addressState) set.addressState = addr.state
    if (!c.addressCountry) set.addressCountry = addr.country
    if (!c.emergencyName) set.emergencyName = emergencyName(nat, seed)
    if (!c.emergencyRelationship)
      set.emergencyRelationship = EMERGENCY_RELATIONSHIPS[seed % EMERGENCY_RELATIONSHIPS.length]
    if (!c.emergencyPhone) set.emergencyPhone = phoneFor(nat, seed)
    if (!c.dateOfBirth) set.dateOfBirth = dobFor(c.employmentDate, seed)
    if (!c.nationality) set.nationality = nat

    if (Object.keys(set).length === 0) continue
    set.updatedAt = now
    ops.push({ updateOne: { filter: { _id: c._id as string }, update: { $set: set } } })
    touched++
  }

  console.log(`${touched} of ${crew.length} crew will be updated. Writing in batches of 500…`)
  for (let i = 0; i < ops.length; i += 500) {
    const slice = ops.slice(i, i + 500)
    const res = await CrewMember.bulkWrite(slice, { ordered: false })
    console.log(`  batch ${i / 500 + 1}: modified=${res.modifiedCount}`)
  }

  console.log('─────────────────────────────────────────────')
  console.log(`  Contact seed complete: ${touched} crew updated`)
  console.log('─────────────────────────────────────────────')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
