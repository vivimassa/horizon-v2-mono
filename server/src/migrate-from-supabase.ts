/**
 * Horizon V1 → V2 Data Migration
 * Exports reference data from Supabase (Postgres) and imports into MongoDB Atlas.
 *
 * Usage: npx tsx src/migrate-from-supabase.ts
 */

import 'dotenv/config'
import mongoose from 'mongoose'
import { createClient } from '@supabase/supabase-js'

// Models
import { Airport } from './models/Airport.js'
import { AircraftType } from './models/AircraftType.js'
import { Country } from './models/Country.js'
import { DelayCode } from './models/DelayCode.js'
import { FlightServiceType } from './models/FlightServiceType.js'
import { CrewPosition } from './models/CrewPosition.js'
import { ExpiryCode, ExpiryCodeCategory } from './models/ExpiryCode.js'
import { Operator } from './models/Operator.js'

// ─── Supabase client ────────────────────────────────────────
const SUPABASE_URL = 'https://qfaanyjjikvaubjnvqgb.supabase.co'
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmYWFueWpqaWt2YXViam52cWdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDk4OTQ5NSwiZXhwIjoyMDg2NTY1NDk1fQ.aSYvRhG95BFgLBbSrmvIiebF97bxekPiP74Qzvvy0Rc'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Helpers ────────────────────────────────────────────────
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

/** Convert a snake_case-keyed object to camelCase keys */
function camelKeys<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    out[snakeToCamel(k)] = v
  }
  return out
}

async function fetchAll(table: string, select = '*', order?: string): Promise<any[]> {
  // Paginate — Supabase defaults to 1000 rows
  const all: any[] = []
  let offset = 0
  const PAGE = 1000
  while (true) {
    let query = supabase.from(table).select(select)
    if (order) query = query.order(order, { ascending: true })
    const { data, error } = await query.range(offset, offset + PAGE - 1)
    if (error) throw new Error(`Supabase fetch ${table}: ${error.message}`)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
}

function log(emoji: string, msg: string) {
  console.log(`  ${emoji} ${msg}`)
}

// ─── Migration functions ────────────────────────────────────

async function migrateOperators() {
  const rows = await fetchAll('operators', '*', 'code')
  if (rows.length === 0) {
    log('⚠', 'No operators found')
    return 0
  }

  const docs = rows.map((r: any) => ({
    _id: r.id,
    code: r.code,
    name: r.name,
    icaoCode: r.icao_code ?? null,
    iataCode: r.iata_code ?? null,
    callsign: r.callsign ?? null,
    country: r.country ?? null,
    timezone: r.timezone ?? 'UTC',
    fdtlRuleset: r.fdtl_ruleset ?? null,
    enabledModules: r.enabled_modules ?? [],
    accentColor: r.accent_color ?? '#1e40af',
    logoUrl: r.logo_url ?? null,
    isActive: r.is_active ?? true,
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? null,
  }))

  await Operator.deleteMany({})
  await Operator.insertMany(docs)
  return docs.length
}

async function migrateCountries() {
  const rows = await fetchAll('countries', '*', 'name')
  if (rows.length === 0) {
    log('⚠', 'No countries found')
    return 0
  }

  const docs = rows.map((r: any) => ({
    _id: r.id,
    isoCode2: r.iso_code_2,
    isoCode3: r.iso_code_3,
    name: r.name,
    officialName: r.official_name ?? null,
    region: r.region ?? null,
    subRegion: r.sub_region ?? null,
    icaoPrefix: r.icao_prefix ?? null,
    currencyCode: r.currency_code ?? null,
    currencyName: r.currency_name ?? null,
    currencySymbol: r.currency_symbol ?? null,
    phoneCode: r.phone_code ?? null,
    flagEmoji: r.flag_emoji ?? null,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    isActive: r.is_active ?? true,
    createdAt: r.created_at,
  }))

  await Country.deleteMany({})
  await Country.insertMany(docs)
  return docs.length
}

async function migrateAirports() {
  // Join countries and timezone_zones in one query
  const rows = await fetchAll(
    'airports',
    '*, countries(name, iso_code_2, flag_emoji), timezone_zones(iana_timezone)',
    'icao_code',
  )
  if (rows.length === 0) {
    log('⚠', 'No airports found')
    return 0
  }

  const docs = rows.map((r: any) => {
    const country = r.countries || {}
    const tz = r.timezone_zones || {}
    return {
      _id: r.id,
      icaoCode: r.icao_code,
      iataCode: r.iata_code ?? null,
      name: r.name,
      city: r.city ?? null,
      country: r.country ?? null,
      countryId: r.country_id ?? null,
      timezone: r.timezone,
      utcOffsetHours: r.utc_offset_hours ?? null,
      latitude: r.latitude ?? null,
      longitude: r.longitude ?? null,
      elevationFt: r.elevation_ft ?? null,
      isActive: r.is_active ?? true,
      isHomeBase: r.is_home_base ?? false,
      isCrewBase: r.is_crew_base ?? false,
      crewReportingTimeMinutes: r.crew_reporting_time_minutes ?? null,
      crewDebriefTimeMinutes: r.crew_debrief_time_minutes ?? null,
      numberOfRunways: r.number_of_runways ?? null,
      longestRunwayFt: r.longest_runway_ft ?? null,
      hasFuelAvailable: r.has_fuel_available ?? false,
      hasCrewFacilities: r.has_crew_facilities ?? false,
      fireCategory: r.fire_category ?? null,
      hasCurfew: r.has_curfew ?? false,
      curfewStart: r.curfew_start ?? null,
      curfewEnd: r.curfew_end ?? null,
      isSlotControlled: r.is_slot_controlled ?? false,
      weatherMonitored: r.weather_monitored ?? false,
      weatherStation: r.weather_station ?? null,
      numberOfGates: r.number_of_gates ?? null,
      // Denormalized joined data
      countryName: country.name ?? null,
      countryIso2: country.iso_code_2 ?? null,
      countryFlag: country.flag_emoji ?? null,
      ianaTimezone: tz.iana_timezone ?? null,
      createdAt: r.created_at,
    }
  })

  await Airport.deleteMany({})
  await Airport.insertMany(docs)
  return docs.length
}

async function migrateAircraftTypes() {
  const rows = await fetchAll('aircraft_types', '*', 'icao_type')
  if (rows.length === 0) {
    log('⚠', 'No aircraft types found')
    return 0
  }

  const docs = rows.map((r: any) => ({
    _id: r.id,
    operatorId: r.operator_id,
    icaoType: r.icao_type,
    iataType: r.iata_type ?? null,
    iataTypeCode: r.iata_type_code ?? null,
    name: r.name,
    family: r.family ?? null,
    category: r.category ?? 'narrow_body',
    manufacturer: r.manufacturer ?? null,
    paxCapacity: r.pax_capacity ?? null,
    cockpitCrewRequired: r.cockpit_crew_required ?? 2,
    cabinCrewRequired: r.cabin_crew_required ?? null,
    tat: {
      defaultMinutes: r.default_tat_minutes ?? null,
      domDom: r.tat_dom_dom_minutes ?? null,
      domInt: r.tat_dom_int_minutes ?? null,
      intDom: r.tat_int_dom_minutes ?? null,
      intInt: r.tat_int_int_minutes ?? null,
      minDd: r.tat_min_dd_minutes ?? null,
      minDi: r.tat_min_di_minutes ?? null,
      minId: r.tat_min_id_minutes ?? null,
      minIi: r.tat_min_ii_minutes ?? null,
    },
    performance: {
      mtowKg: r.mtow_kg ?? null,
      mlwKg: r.mlw_kg ?? null,
      mzfwKg: r.mzfw_kg ?? null,
      oewKg: r.oew_kg ?? null,
      maxFuelCapacityKg: r.max_fuel_capacity_kg ?? null,
      maxRangeNm: r.max_range_nm ?? null,
      cruisingSpeedKts: r.cruising_speed_kts ?? null,
      ceilingFl: r.ceiling_fl ?? null,
    },
    etopsCapable: r.etops_capable ?? false,
    etopsRatingMinutes: r.etops_rating_minutes ?? null,
    noiseCategory: r.noise_category ?? null,
    emissionsCategory: r.emissions_category ?? null,
    color: r.color ?? null,
    isActive: r.is_active ?? true,
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? null,
  }))

  await AircraftType.deleteMany({})
  await AircraftType.insertMany(docs)
  return docs.length
}

async function migrateDelayCodes() {
  const rows = await fetchAll('delay_codes', '*', 'code')
  if (rows.length === 0) {
    log('⚠', 'No delay codes found')
    return 0
  }

  const docs = rows.map((r: any) => ({
    _id: r.id,
    operatorId: r.operator_id,
    code: r.code,
    category: r.category,
    name: r.name,
    description: r.description ?? null,
    isActive: r.is_active ?? true,
    isIataStandard: r.is_iata_standard ?? false,
    createdAt: r.created_at,
  }))

  await DelayCode.deleteMany({})
  await DelayCode.insertMany(docs)
  return docs.length
}

async function migrateFlightServiceTypes() {
  const rows = await fetchAll('flight_service_types', '*', 'code')
  if (rows.length === 0) {
    log('⚠', 'No flight service types found')
    return 0
  }

  const docs = rows.map((r: any) => ({
    _id: r.id,
    operatorId: r.operator_id,
    code: r.code,
    name: r.name,
    description: r.description ?? null,
    color: r.color ?? null,
    isActive: r.is_active ?? true,
    createdAt: r.created_at,
  }))

  await FlightServiceType.deleteMany({})
  await FlightServiceType.insertMany(docs)
  return docs.length
}

async function migrateCrewPositions() {
  const rows = await fetchAll('crew_positions', '*', 'rank_order')
  if (rows.length === 0) {
    log('⚠', 'No crew positions found')
    return 0
  }

  const docs = rows.map((r: any) => ({
    _id: r.id,
    operatorId: r.operator_id,
    code: r.code,
    name: r.name,
    category: r.category,
    rankOrder: r.rank_order,
    isPic: r.is_pic ?? false,
    canDownrank: r.can_downrank ?? false,
    color: r.color ?? null,
    description: r.description ?? null,
    isActive: r.is_active ?? true,
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? null,
  }))

  await CrewPosition.deleteMany({})
  await CrewPosition.insertMany(docs)
  return docs.length
}

async function migrateExpiryCodeCategories() {
  const rows = await fetchAll('expiry_code_categories', '*', 'sort_order')
  if (rows.length === 0) {
    log('⚠', 'No expiry code categories found')
    return 0
  }

  const docs = rows.map((r: any) => ({
    _id: r.id,
    operatorId: r.operator_id,
    key: r.key,
    label: r.label,
    description: r.description ?? null,
    color: r.color,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  }))

  await ExpiryCodeCategory.deleteMany({})
  await ExpiryCodeCategory.insertMany(docs)
  return docs.length
}

async function migrateExpiryCodes() {
  const rows = await fetchAll('expiry_codes', '*', 'sort_order')
  if (rows.length === 0) {
    log('⚠', 'No expiry codes found')
    return 0
  }

  const docs = rows.map((r: any) => ({
    _id: r.id,
    operatorId: r.operator_id,
    categoryId: r.category_id,
    code: r.code,
    name: r.name,
    description: r.description ?? null,
    crewCategory: r.crew_category ?? 'both',
    applicablePositions: r.applicable_positions ?? [],
    formula: r.formula,
    formulaParams: r.formula_params ?? {},
    acTypeScope: r.ac_type_scope ?? 'none',
    linkedTrainingCode: r.linked_training_code ?? null,
    warningDays: r.warning_days ?? null,
    severity: r.severity ?? [],
    notes: r.notes ?? null,
    isActive: r.is_active ?? true,
    sortOrder: r.sort_order ?? 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? null,
  }))

  await ExpiryCode.deleteMany({})
  await ExpiryCode.insertMany(docs)
  return docs.length
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║   Horizon V1 → V2  Data Migration               ║')
  console.log('║   Supabase (Postgres) → MongoDB Atlas            ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  // Connect to MongoDB
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI not set in .env')
  await mongoose.connect(uri)
  log('✓', `MongoDB connected: ${mongoose.connection.name}`)

  // Test Supabase connection
  const { data: testData, error: testErr } = await supabase.from('operators').select('id').limit(1)
  if (testErr) throw new Error(`Supabase connection failed: ${testErr.message}`)
  log('✓', 'Supabase connected')

  console.log('\n── Migrating reference data ──────────────────────\n')

  const results: [string, number][] = []

  // Order matters: countries before airports (for denormalization)
  const migrations: [string, () => Promise<number>][] = [
    ['Operators', migrateOperators],
    ['Countries', migrateCountries],
    ['Airports', migrateAirports],
    ['Aircraft Types', migrateAircraftTypes],
    ['Delay Codes', migrateDelayCodes],
    ['Flight Service Types', migrateFlightServiceTypes],
    ['Crew Positions', migrateCrewPositions],
    ['Expiry Code Categories', migrateExpiryCodeCategories],
    ['Expiry Codes', migrateExpiryCodes],
  ]

  for (const [name, fn] of migrations) {
    try {
      const count = await fn()
      results.push([name, count])
      log('✓', `${name}: ${count} documents`)
    } catch (err: any) {
      log('✗', `${name}: FAILED — ${err.message}`)
      results.push([name, -1])
    }
  }

  console.log('\n── Summary ──────────────────────────────────────\n')
  const total = results.reduce((sum, [, n]) => sum + (n > 0 ? n : 0), 0)
  const failed = results.filter(([, n]) => n < 0).length
  console.log(`  Total documents migrated: ${total}`)
  if (failed > 0) console.log(`  Failed collections: ${failed}`)
  console.log('')

  await mongoose.disconnect()
  log('✓', 'Done. MongoDB disconnected.\n')
}

main().catch((err) => {
  console.error('\n✗ Migration failed:', err)
  process.exit(1)
})
