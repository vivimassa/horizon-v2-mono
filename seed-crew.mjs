import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import pg from 'pg'
const { Pool } = pg

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const OPERATOR_ID = '20169cc0-c914-4662-a300-1dbbe20d1416'

// ─── Bases ───────────────────────────────────────────────────────────────────
const BASES = {
  SGN: '743f203a-7e52-49ad-96ac-386a3c6c75d3',
  HAN: 'a520e233-90f2-4d00-890e-1bce78310a75',
  CXR: '15c2a054-a8e5-43da-84f4-45af42daa1f1',
  DAD: '21d896aa-b650-45c8-a731-5654967a963e',
}
const BASE_IDS = Object.values(BASES)
const BASE_CODES = Object.keys(BASES)

// ─── Vietnamese name pools ───────────────────────────────────────────────────
const VN_SURNAMES = [
  'NGUYEN', 'TRAN', 'LE', 'PHAM', 'HOANG', 'HUYNH', 'PHAN', 'VU', 'VO',
  'DANG', 'BUI', 'DO', 'HO', 'NGO', 'DUONG', 'LY', 'DINH', 'TA', 'LUONG',
  'MAI', 'TRINH', 'LAM', 'DAO', 'TRUONG', 'DONG', 'THAI', 'TANG', 'CAO',
]
const VN_MIDDLE_MALE = [
  'VAN', 'MINH', 'QUOC', 'DUC', 'THANH', 'XUAN', 'HONG', 'NGOC', 'HUU',
  'TIEN', 'THE', 'DINH', 'CONG', 'TRUNG', 'BAO', 'QUANG', 'GIA', 'HOANG',
]
const VN_MIDDLE_FEMALE = [
  'THI', 'NGOC', 'HONG', 'PHUONG', 'THANH', 'THUY', 'XUAN', 'KHANH',
  'MINH', 'TRAM', 'DIEU', 'BICH', 'TUYET', 'ANH', 'MAI', 'HUONG',
]
const VN_GIVEN_MALE = [
  'TUAN', 'HUNG', 'DUNG', 'HAI', 'HIEU', 'NAM', 'LONG', 'KHANH', 'DAT',
  'PHUC', 'QUAN', 'TAI', 'THANG', 'HOAN', 'VINH', 'BINH', 'SON', 'KHOA',
  'THINH', 'TRONG', 'AN', 'CUONG', 'DUY', 'NHAT', 'SANG', 'TRI', 'BAO',
  'PHONG', 'QUANG', 'LINH', 'MANH', 'HUY', 'TRUNG', 'MINH', 'TUNG',
]
const VN_GIVEN_FEMALE = [
  'LINH', 'TRANG', 'HUONG', 'LAN', 'THAO', 'NHU', 'HANH', 'ANH', 'QUYNH',
  'NGOC', 'TRAM', 'PHUONG', 'DUNG', 'HA', 'MAI', 'HIEN', 'UYEN', 'NGAN',
  'TRINH', 'VAN', 'HANG', 'THUY', 'YEN', 'CHI', 'DIEP', 'KHANH', 'NHI',
  'OANH', 'SUONG', 'TUYET', 'HOAN', 'GIANG', 'DUYEN', 'MY', 'TIEN',
]

// ─── International name pools (cockpit) ──────────────────────────────────────
const INTL_FIRST_MALE = [
  'ALEXANDER', 'DMITRII', 'SERGEI', 'VADIM', 'OLEG', 'MIKHAIL', 'ANDREI',
  'BARRY', 'JAMES', 'MICHAEL', 'DAVID', 'ROBERT', 'RICHARD', 'THOMAS',
  'CARLOS', 'JUAN', 'JOSE', 'PEDRO', 'MARCO', 'FABIO', 'PAOLO',
  'HARIS', 'AHMED', 'OMAR', 'RICKY', 'DANIEL', 'STEFAN', 'VIKTOR',
  'WORAWUT', 'CHAIWAT', 'SOMCHAI', 'KEVIN', 'PATRICK', 'BRIAN', 'SEAN',
  'BENJAMIN', 'NICOLAS', 'LUCAS', 'MAXIM', 'IGOR', 'YURI', 'ARTEM',
  'ANTONIO', 'FERNANDO', 'GABRIEL', 'RAFAEL', 'LEONARDO', 'MATEO',
  'CHRIS', 'JONATHAN', 'TIMOTHY', 'ANDREW', 'WILLIAM', 'PETER', 'MARK',
  'IVAN', 'ROMAN', 'ALEKSEI', 'NIKITA', 'KIRILL', 'DENIS', 'EVGENY',
]
const INTL_LAST = [
  'ANIKIN', 'SEREZHKIN', 'CHEREPANOV', 'GRIVTSOV', 'PETROV', 'VOLKOV',
  'SHEEHAN', 'COOPER', 'MURPHY', 'BROWN', 'WILSON', 'TAYLOR', 'CLARK',
  'SEGOVIA', 'RODRIGUEZ', 'MARTINEZ', 'GARCIA', 'LOPEZ', 'HERNANDEZ',
  'FURQAN', 'KHAN', 'AHMED', 'RASHID', 'HASSAN', 'ALI',
  'PLOYWONG', 'SRISUK', 'TANAKA', 'NAKAMURA', 'WATANABE', 'WEBER',
  'MULLER', 'SCHMIDT', 'FISCHER', 'BECKER', 'MEYER', 'HOFFMAN',
  'ABLOTIA', 'MINCHEV', 'IONESCU', 'POPOV', 'SOKOLOV', 'MOROZOV',
  'NOVAK', 'HORVAT', 'SILVA', 'SANTOS', 'FERREIRA', 'COSTA',
  'JENSEN', 'NIELSEN', 'HANSEN', 'LARSEN', 'BERG', 'LUND',
  'DUBOIS', 'MARTIN', 'BERNARD', 'MOREAU', 'LAURENT', 'LEROY',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
const pick = arr => arr[Math.floor(Math.random() * arr.length)]
const pickBase = () => { const i = Math.floor(Math.random() * BASE_CODES.length); return { id: BASE_IDS[i], code: BASE_CODES[i] } }
const usedIds = new Set()
function nextEmployeeId(start) {
  let id = start
  while (usedIds.has(id)) id++
  usedIds.add(id)
  return id
}

function randomDate(yearFrom, yearTo) {
  const y = yearFrom + Math.floor(Math.random() * (yearTo - yearFrom + 1))
  const m = 1 + Math.floor(Math.random() * 12)
  const d = 1 + Math.floor(Math.random() * 28)
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// ─── Name generators ─────────────────────────────────────────────────────────

// Vietnamese cockpit: SURNAME MIDDLE GIVEN
function vnCockpitName(gender) {
  const surname = pick(VN_SURNAMES)
  const middle = pick(gender === 'male' ? VN_MIDDLE_MALE : VN_MIDDLE_FEMALE)
  const given = pick(gender === 'male' ? VN_GIVEN_MALE : VN_GIVEN_FEMALE)
  return { first_name: given, middle_name: `${surname} ${middle}`, last_name: given, full: `${surname} ${middle} ${given}` }
}

// International cockpit: FIRST LAST or FIRST MIDDLE LAST
function intlCockpitName() {
  const first = pick(INTL_FIRST_MALE)
  const last = pick(INTL_LAST)
  if (Math.random() < 0.3) {
    const mid = pick(INTL_FIRST_MALE)
    return { first_name: first, middle_name: mid, last_name: last }
  }
  return { first_name: first, middle_name: null, last_name: last }
}

// Vietnamese cabin: GIVEN [NUMBER] SURNAME MIDDLE
// For DB: first_name = GIVEN, last_name = SURNAME, short_code encodes the number
function vnCabinName(seniorityNum, gender) {
  const surname = pick(VN_SURNAMES)
  const middle = pick(gender === 'male' ? VN_MIDDLE_MALE : VN_MIDDLE_FEMALE)
  const given = pick(gender === 'male' ? VN_GIVEN_MALE : VN_GIVEN_FEMALE)
  return {
    first_name: given,
    middle_name: `${seniorityNum} ${surname} ${middle}`,
    last_name: surname,
  }
}

// ─── Generate crew ───────────────────────────────────────────────────────────

function generateCrew(position, count, startId) {
  const crew = []
  const isCockpit = position === 'CP' || position === 'FO'
  let empId = startId

  for (let i = 0; i < count; i++) {
    const base = pickBase()

    let first_name, middle_name, last_name, gender

    if (isCockpit) {
      // ~25% Vietnamese, 75% international for cockpit
      gender = 'male' // cockpit overwhelmingly male in this dataset
      if (Math.random() < 0.25) {
        const surname = pick(VN_SURNAMES)
        const middle = pick(VN_MIDDLE_MALE)
        const given = pick(VN_GIVEN_MALE)
        first_name = given
        middle_name = middle
        last_name = surname
      } else {
        const n = intlCockpitName()
        first_name = n.first_name
        middle_name = n.middle_name
        last_name = n.last_name
      }
    } else {
      // Cabin: ~90% Vietnamese, ~70% female for PU, ~60% female for CA
      const femaleChance = position === 'PU' ? 0.7 : 0.6
      gender = Math.random() < femaleChance ? 'female' : 'male'
      const senNum = i + 1

      if (Math.random() < 0.90) {
        const surname = pick(VN_SURNAMES)
        const middle = pick(gender === 'male' ? VN_MIDDLE_MALE : VN_MIDDLE_FEMALE)
        const given = pick(gender === 'male' ? VN_GIVEN_MALE : VN_GIVEN_FEMALE)
        first_name = given
        middle_name = `${senNum} ${surname} ${middle}`
        last_name = surname
      } else {
        // Non-Vietnamese cabin (no number)
        const n = intlCockpitName()
        first_name = n.first_name
        middle_name = n.middle_name
        last_name = n.last_name
        gender = Math.random() < 0.5 ? 'female' : 'male'
      }
    }

    const eid = nextEmployeeId(empId)
    empId = eid + 1

    crew.push({
      operator_id: OPERATOR_ID,
      employee_id: String(eid),
      first_name,
      middle_name,
      last_name,
      gender,
      base: base.id,
      position,
      status: 'active',
      seniority: i + 1,
      seniority_group: 0,
      employment_date: randomDate(2015, 2024),
      languages: ['EN'],
      transport_required: false,
      hotel_at_home_base: false,
      standby_exempted: false,
      crew_under_training: false,
      no_domestic_flights: false,
      no_international_flights: false,
      no_accommodation_airports: [],
    })
  }
  return crew
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const allCrew = [
      ...generateCrew('CP', 120, 1001),
      ...generateCrew('FO', 125, 2001),
      ...generateCrew('PU', 130, 3001),
      ...generateCrew('CA', 400, 4001),
    ]

    console.log(`Inserting ${allCrew.length} crew members...`)

    // Insert crew members
    const crewIds = []
    for (const c of allCrew) {
      const r = await client.query(`
        INSERT INTO crew_members (
          operator_id, employee_id, first_name, middle_name, last_name,
          gender, base, position, status, seniority, seniority_group,
          employment_date, languages, transport_required, hotel_at_home_base,
          standby_exempted, crew_under_training, no_domestic_flights,
          no_international_flights, no_accommodation_airports
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        RETURNING id
      `, [
        c.operator_id, c.employee_id, c.first_name, c.middle_name, c.last_name,
        c.gender, c.base, c.position, c.status, c.seniority, c.seniority_group,
        c.employment_date, c.languages, c.transport_required, c.hotel_at_home_base,
        c.standby_exempted, c.crew_under_training, c.no_domestic_flights,
        c.no_international_flights, c.no_accommodation_airports,
      ])
      crewIds.push({ id: r.rows[0].id, position: c.position, base_code: Object.entries(BASES).find(([, v]) => v === c.base)?.[0] })
    }

    console.log(`Inserting qualifications (320, AC Family enabled)...`)

    // Insert qualifications: all on 320, ac_family_qualified = true
    for (const c of crewIds) {
      await client.query(`
        INSERT INTO crew_qualifications (
          crew_id, base, aircraft_type, position, start_date,
          is_primary, ac_family_qualified
        ) VALUES ($1, $2, '320', $3, '2020-01-01', true, true)
      `, [c.id, c.base_code, c.position])
    }

    await client.query('COMMIT')

    console.log(`Done!`)
    console.log(`  CP: 120`)
    console.log(`  FO: 125`)
    console.log(`  PU: 130`)
    console.log(`  CA: 400`)
    console.log(`  Total: ${allCrew.length}`)
    console.log(`  All qualified on 320 with AC Family enabled`)
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('Error:', e.message)
  } finally {
    client.release()
    pool.end()
  }
}

main()
