/**
 * Sky Hub — API Client
 * Platform-agnostic. Base URL is injected by the consuming app at startup
 * (web: apps/web/src/lib/env.ts; mobile: apps/mobile/utils/api-url.ts).
 *
 * The default below reads build-time env vars as a safety net — if a module
 * happens to import `api` before the startup bootstrap runs, requests still
 * go to the right host in production instead of silently hitting localhost.
 */

function resolveDefaultBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env) {
    const url = process.env.NEXT_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL
    if (url) return url.replace(/\/$/, '')
  }
  return 'http://localhost:3002'
}

let _baseUrl = resolveDefaultBaseUrl()

/** Call once at app startup to set the API base URL */
export function setApiBaseUrl(url: string) {
  _baseUrl = url.replace(/\/$/, '') // strip trailing slash
}

/** Get the current API base URL (for direct fetch calls like file uploads) */
export function getApiBaseUrl(): string {
  return _baseUrl
}

// ─── Auth interceptor ─────────────────────────────────────
// Consumers (mobile / web apps) register callbacks once at startup so the
// client package itself stays free of platform concerns like MMKV or
// localStorage.

interface AuthCallbacks {
  getAccessToken: () => string | null
  /** Return the current refresh token (for auto-refresh on 401). */
  getRefreshToken?: () => string | null
  /** Persist a newly-issued token pair after an auto-refresh. */
  onTokenRefresh?: (access: string, refresh: string) => void
  /** Called when auth is definitively lost (refresh fails or 401 on a public-style route). */
  onAuthFailure: () => void
}

let _authCallbacks: AuthCallbacks | null = null

/** Called once at app startup to wire token storage + 401 handling. */
export function setAuthCallbacks(callbacks: AuthCallbacks) {
  _authCallbacks = callbacks
}

// Single-flight refresh: if 10 requests all 401 at once, we only want ONE
// /auth/refresh call in flight. All 10 await the same promise, then retry
// with the new access token.
let _refreshInFlight: Promise<{ accessToken: string; refreshToken: string }> | null = null

async function refreshAccessToken(): Promise<{ accessToken: string; refreshToken: string } | null> {
  const refreshToken = _authCallbacks?.getRefreshToken?.()
  if (!refreshToken) return null

  if (!_refreshInFlight) {
    _refreshInFlight = (async () => {
      // Raw fetch so we don't recurse through request() on the refresh call
      // itself (which would 401-loop if the refresh token is dead).
      const res = await fetch(`${_baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      if (!res.ok) throw new Error('refresh failed')
      return (await res.json()) as { accessToken: string; refreshToken: string }
    })().finally(() => {
      // Clear after resolution so the next 401 (much later) triggers a new refresh.
      _refreshInFlight = null
    })
  }

  try {
    const pair = await _refreshInFlight
    _authCallbacks?.onTokenRefresh?.(pair.accessToken, pair.refreshToken)
    return pair
  } catch {
    return null
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) }
  if (init?.body) headers['Content-Type'] = 'application/json'

  // Attach Authorization header if a token is available
  const token = _authCallbacks?.getAccessToken() ?? null
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let res = await fetch(`${_baseUrl}${path}`, { ...init, headers })

  // Auto-refresh on 401 (except for auth endpoints themselves — those are
  // managed directly by the auth provider and a 401 there means real failure).
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const pair = await refreshAccessToken()
    if (pair) {
      const retryHeaders = { ...headers, Authorization: `Bearer ${pair.accessToken}` }
      res = await fetch(`${_baseUrl}${path}`, { ...init, headers: retryHeaders })
    }
  }

  if (res.status === 401) {
    _authCallbacks?.onAuthFailure()
    const body = await res.text().catch(() => '')
    throw new Error(`API 401: ${body || 'Unauthorized'}`)
  }

  if (!res.ok) {
    const body = await res.text()
    // Attach parsed JSON payload (if any) to the Error so callers can
    // render structured errors (e.g. capacity_exceeded) without regex.
    const err = new Error(`API ${res.status}: ${body}`) as ApiError
    err.status = res.status
    try {
      err.payload = JSON.parse(body)
    } catch {
      err.payload = null
    }
    throw err
  }

  return res.json()
}

/** Error thrown by `request` on non-2xx. `payload` is the parsed JSON
 *  body when the server returned JSON; null otherwise. Consumers can
 *  branch on `payload.code` (e.g. 'capacity_exceeded') instead of
 *  regex-parsing the message. */
export interface ApiError extends Error {
  status?: number
  payload?: unknown
}

// ─── Flight types ─────────────────────────────────────────
export interface Flight {
  _id: string
  operatorId: string
  flightNumber: string
  operatingDate: string
  dep: { icao: string; iata: string }
  arr: { icao: string; iata: string }
  schedule: { stdUtc: number; staUtc: number }
  actual: {
    atdUtc: number | null
    offUtc: number | null
    onUtc: number | null
    ataUtc: number | null
  }
  estimated?: { etdUtc: number | null; etaUtc: number | null }
  tail: { registration: string | null; icaoType: string | null }
  pax?: {
    adultExpected: number | null
    adultActual: number | null
    childExpected: number | null
    childActual: number | null
    infantExpected: number | null
    infantActual: number | null
  }
  fuel?: {
    initial: number | null
    uplift: number | null
    burn: number | null
    flightPlan: number | null
  }
  lopa?: {
    cabins: { classCode: string; seats: number }[]
    totalSeats: number
  } | null
  crew: { employeeId: string; role: string; name: string }[]
  delays: { code: string; minutes: number; reason: string }[]
  status: 'scheduled' | 'departed' | 'onTime' | 'delayed' | 'cancelled' | 'diverted'
  syncMeta: { updatedAt: number; version: number }
}

// ─── Reference types ──────────────────────────────────────
export interface RunwayData {
  _id: string
  identifier: string
  lengthM: number | null
  lengthFt: number | null
  widthM: number | null
  widthFt: number | null
  surface: string | null
  ilsCategory: string | null
  lighting: boolean
  status: string
  notes: string | null
}

export interface CurfewEntry {
  _id: string
  startTime: string // "HH:MM" local
  endTime: string // "HH:MM" local
  effectiveFrom: string | null // "YYYY-MM-DD" or null = always
  effectiveUntil: string | null // "YYYY-MM-DD" or null = ongoing
  remarks: string | null
}

export interface AirportRef {
  _id: string
  icaoCode: string
  iataCode: string | null
  name: string
  city: string | null
  country: string | null
  countryId: string | null
  timezone: string
  latitude: number | null
  longitude: number | null
  countryFlag: string | null
  countryName: string | null
  countryIso2: string | null
  isActive: boolean
  isHomeBase: boolean
  isCrewBase: boolean
  utcOffsetHours: number | null
  elevationFt: number | null
  crewReportingTimeMinutes: number | null
  crewDebriefTimeMinutes: number | null
  runways: RunwayData[]
  numberOfRunways: number | null
  longestRunwayFt: number | null
  hasFuelAvailable: boolean
  hasCrewFacilities: boolean
  fireCategory: number | null
  curfews: CurfewEntry[]
  isSlotControlled: boolean
  weatherMonitored: boolean
  weatherStation: string | null
  numberOfGates: number | null
  ianaTimezone: string | null
}

export interface AircraftTypeRef {
  _id: string
  operatorId: string
  icaoType: string
  iataType: string | null
  iataTypeCode: string | null
  name: string
  family: string | null
  category: string
  manufacturer: string | null
  paxCapacity: number | null
  cockpitCrewRequired: number
  cabinCrewRequired: number | null
  tat: {
    defaultMinutes: number | null
    domDom: number | null
    domInt: number | null
    intDom: number | null
    intInt: number | null
    minDd: number | null
    minDi: number | null
    minId: number | null
    minIi: number | null
  } | null
  performance: {
    mtowKg: number | null
    mlwKg: number | null
    mzfwKg: number | null
    oewKg: number | null
    maxFuelCapacityKg: number | null
    maxRangeNm: number | null
    cruisingSpeedKts: number | null
    ceilingFl: number | null
  } | null
  fuelBurnRateKgPerHour: number | null
  etopsCapable: boolean
  etopsRatingMinutes: number | null
  noiseCategory: string | null
  emissionsCategory: string | null
  cargo: {
    maxCargoWeightKg: number | null
    cargoPositions: number | null
    bulkHoldCapacityKg: number | null
    uldTypesAccepted: string[]
  } | null
  crewRest: {
    cockpitClass: string | null
    cockpitPositions: number | null
    cabinClass: string | null
    cabinPositions: number | null
  } | null
  weather: {
    minCeilingFt: number | null
    minRvrM: number | null
    minVisibilityM: number | null
    maxCrosswindKt: number | null
    maxWindKt: number | null
  } | null
  approach: {
    ilsCategoryRequired: string | null
    autolandCapable: boolean
  } | null
  notes: string | null
  color: string | null
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
}

export interface AircraftRegistrationRef {
  _id: string
  operatorId: string
  registration: string
  aircraftTypeId: string
  lopaConfigId: string | null
  serialNumber: string | null
  variant: string | null
  status: string
  homeBaseIcao: string | null
  currentLocationIcao: string | null
  currentLocationUpdatedAt: string | null
  dateOfManufacture: string | null
  dateOfDelivery: string | null
  leaseExpiryDate: string | null
  selcal: string | null
  performance: {
    mtowKg: number | null
    mlwKg: number | null
    mzfwKg: number | null
    oewKg: number | null
    maxFuelCapacityKg: number | null
    maxRangeNm: number | null
    cruisingSpeedKts: number | null
    ceilingFl: number | null
  } | null
  fuelBurnRateKgPerHour: number | null
  etopsCapable: boolean
  etopsRatingMinutes: number | null
  noiseCategory: string | null
  emissionsCategory: string | null
  imageUrl: string | null
  notes: string | null
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
}

// ─── Crew Hotel types ─────────────────────────────────────
export interface HotelContact {
  _id: string
  name: string | null
  telephone: string | null
  fax: string | null
}

export interface HotelEmail {
  _id: string
  address: string
  isDefault: boolean
}

export interface HotelDailyRateRule {
  _id: string
  stayType: string | null
  fromDays: number | null
  toDays: number | null
  operation: string | null
  durationHrs: number | null
  percentage: number | null
  rate: number | null
}

export interface HotelContract {
  _id: string
  priority: number
  startDateUtcMs: number | null
  endDateUtcMs: number | null
  weekdayMask: boolean[]
  checkInLocal: string | null
  checkOutLocal: string | null
  contractNo: string | null
  contractRate: number | null
  currency: string
  roomsPerNight: number
  releaseTime: string
  roomRate: number
  dailyRateRules: HotelDailyRateRule[]
}

export interface HotelShuttle {
  _id: string
  fromDateUtcMs: number | null
  toDateUtcMs: number | null
  fromTimeLocal: string | null
  toTimeLocal: string | null
  weekdayMask: boolean[]
}

export interface HotelCriteria {
  blockToBlockRestMinutes: number | null
  crewPositions: string[]
  aircraftTypes: string[]
  crewCategories: string[]
  charterers: string[]
}

export interface CrewHotelRef {
  _id: string
  operatorId: string
  airportIcao: string
  hotelName: string
  priority: number
  isActive: boolean
  effectiveFromUtcMs: number | null
  effectiveUntilUtcMs: number | null
  isTrainingHotel: boolean
  isAllInclusive: boolean
  addressLine1: string | null
  addressLine2: string | null
  addressLine3: string | null
  latitude: number | null
  longitude: number | null
  distanceFromAirportMinutes: number | null
  shuttleAlwaysAvailable: boolean
  standardCheckInLocal: string
  standardCheckOutLocal: string
  criteria: HotelCriteria
  contacts: HotelContact[]
  emails: HotelEmail[]
  contracts: HotelContract[]
  shuttles: HotelShuttle[]
  createdAt: string | null
  updatedAt: string | null
}

export interface CrewHotelBulkResult {
  totalRows: number
  created: number
  updated: number
  skipped: number
  errors: Array<{ row: number; field?: string; reason: string }>
  dryRun: boolean
}

export interface CountryRef {
  _id: string
  isoCode2: string
  isoCode3: string
  name: string
  officialName: string | null
  region: string | null
  subRegion: string | null
  icaoPrefix: string | null
  currencyCode: string | null
  currencyName: string | null
  currencySymbol: string | null
  phoneCode: string | null
  flagEmoji: string | null
  latitude: number | null
  longitude: number | null
  isActive: boolean
}

export interface ActivityCodeGroupRef {
  _id: string
  operatorId: string
  code: string
  name: string
  color: string
  sortOrder: number
  createdAt: string | null
  updatedAt: string | null
}

export interface ActivityCodeRef {
  _id: string
  operatorId: string
  groupId: string
  code: string
  name: string
  description: string | null
  shortLabel: string | null
  color: string | null
  isSystem: boolean
  isActive: boolean
  isArchived: boolean
  flags: string[]
  creditRatio: number | null
  creditFixedMin: number | null
  payRatio: number | null
  minRestBeforeMin: number | null
  minRestAfterMin: number | null
  defaultDurationMin: number | null
  requiresTime: boolean
  defaultStartTime: string | null
  defaultEndTime: string | null
  simPlatform: string | null
  simDurationMin: number | null
  applicablePositions: string[]
  createdAt: string | null
  updatedAt: string | null
}

export interface DutyPatternRef {
  _id: string
  operatorId: string
  code: string
  description: string | null
  sequence: number[]
  cycleDays: number
  offCode: string
  isActive: boolean
  sortOrder: number
  createdAt: string | null
  updatedAt: string | null
}

export interface ScheduledFlightRef {
  _id: string
  operatorId: string
  seasonCode: string
  airlineCode: string
  flightNumber: string
  suffix: string | null
  depStation: string
  arrStation: string
  depAirportId: string | null
  arrAirportId: string | null
  stdUtc: string
  staUtc: string
  stdLocal: string | null
  staLocal: string | null
  blockMinutes: number | null
  departureDayOffset: number
  arrivalDayOffset: number
  daysOfWeek: string
  aircraftTypeId: string | null
  aircraftTypeIcao: string | null
  aircraftReg: string | null
  serviceType: string
  status: 'draft' | 'active' | 'suspended' | 'cancelled'
  previousStatus: string | null
  effectiveFrom: string
  effectiveUntil: string
  cockpitCrewRequired: number | null
  cabinCrewRequired: number | null
  isEtops: boolean
  isOverwater: boolean
  isActive: boolean
  scenarioId: string | null
  rotationId: string | null
  rotationSequence: number | null
  rotationLabel: string | null
  source: string
  sortOrder: number
  formatting: Record<string, unknown>
  createdAt: string | null
  updatedAt: string | null
}

export interface ScenarioRef {
  _id: string
  operatorId: string
  seasonCode: string
  name: string
  description: string | null
  status: 'draft' | 'review' | 'published' | 'archived'
  parentScenarioId: string | null
  publishedAt: string | null
  publishedBy: string | null
  createdBy: string
  createdAt: string | null
  updatedAt: string | null
}

export interface ScenarioEnvelopeRef {
  scenarioId: string
  effectiveFromUtc: string
  effectiveUntilUtc: string
  flightCount: number
}

export interface MppLeadTimeGroupRef {
  _id: string
  operatorId: string
  label: string
  description: string | null
  color: string
  code: string
  crewType: 'cockpit' | 'cabin' | 'other'
  sortOrder: number
  createdAt: string | null
  updatedAt: string | null
}

export interface MppLeadTimeItemRef {
  _id: string
  operatorId: string
  groupId: string
  label: string
  valueMonths: number
  note: string | null
  consumedBy: string | null
  sortOrder: number
  createdAt: string | null
  updatedAt: string | null
}

export interface DelayCodeRef {
  _id: string
  operatorId: string
  code: string
  alphaCode: string | null
  ahm732Process: string | null
  ahm732Reason: string | null
  ahm732Stakeholder: string | null
  category: string
  name: string
  description: string | null
  color: string | null
  isIataStandard: boolean
  isActive: boolean
}

export interface CrewPositionReferences {
  expiryCodes: number
  crewComplements: number
}

export interface CrewPositionRef {
  _id: string
  operatorId: string
  code: string
  name: string
  category: 'cockpit' | 'cabin'
  rankOrder: number
  isPic: boolean
  canDownrank: boolean
  color: string | null
  description: string | null
  isActive: boolean
}

export interface ExpiryCodeCategoryRef {
  _id: string
  operatorId: string
  key: string
  label: string
  description: string | null
  color: string
  sortOrder: number
}

export interface ExpiryCodeRef {
  _id: string
  operatorId: string
  categoryId: string
  code: string
  name: string
  description: string | null
  crewCategory: 'both' | 'cockpit' | 'cabin'
  applicablePositions: string[]
  formula: string
  formulaParams: Record<string, unknown>
  acTypeScope: 'none' | 'family' | 'variant'
  linkedTrainingCode: string | null
  warningDays: number | null
  severity: string[]
  notes: string | null
  isActive: boolean
  sortOrder: number
}

export interface CrewGroupRef {
  _id: string
  operatorId: string
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
}

// ─── FDTL Types ──────────────────────────────────────────

export interface FdtlFrameworkRef {
  code: string
  name: string
  region: string
  legalBasis: string
  color: string
}

export interface FdtlSchemeRef {
  _id: string
  operatorId: string
  frameworkCode: string
  cabinFrameworkCode: string | null
  cabinCrewSeparateRules: boolean
  reportTimeMinutes: number
  postFlightMinutes: number
  debriefMinutes: number
  standbyResponseMinutes: number
  augmentedComplementKey: string
  doubleCrewComplementKey: string
  frmsEnabled: boolean
  frmsApprovalReference: string | null
  woclStart: string
  woclEnd: string
  createdAt: string | null
  updatedAt: string | null
}

export interface FdtlRuleRef {
  _id: string
  operatorId: string
  frameworkCode: string
  crewType: 'all' | 'cockpit' | 'cabin'
  category: string
  subcategory: string
  ruleCode: string
  tabKey: string | null
  label: string
  description: string | null
  legalReference: string | null
  value: string
  valueType: 'duration' | 'integer' | 'decimal' | 'boolean' | 'text'
  unit: string | null
  directionality: 'MAX_LIMIT' | 'MIN_LIMIT' | 'BOOLEAN' | 'ENUM' | 'FORMULA' | null
  source: 'government' | 'company'
  templateValue: string | null
  isTemplateDefault: boolean
  verificationStatus: 'verified' | 'unverified' | 'disputed'
  sortOrder: number
  isActive: boolean
  /** Data-driven evaluator key. When null, client validator infers from ruleCode. */
  computationType:
    | 'rolling_cumulative'
    | 'min_rest_between_events'
    | 'min_rest_after_augmented'
    | 'min_rest_in_window'
    | 'per_duty_limit'
    | 'consecutive_count'
    | 'custom'
    | null
  params: Record<string, unknown> | null
}

export interface FdtlTableCellRef {
  rowKey: string
  colKey: string
  valueMinutes: number | null
  displayValue: string | null
  source: 'government' | 'company'
  templateValueMinutes: number | null
  isTemplateDefault: boolean
  notes: string | null
}

export interface FdtlTableRef {
  _id: string
  operatorId: string
  frameworkCode: string
  tableCode: string
  tabKey: string
  label: string
  legalReference: string | null
  tableType: string
  rowAxisLabel: string | null
  colAxisLabel: string | null
  rowKeys: string[]
  rowLabels: string[]
  colKeys: string[]
  colLabels: string[]
  cells: FdtlTableCellRef[]
  crewType: 'all' | 'cockpit' | 'cabin'
  isActive: boolean
}

export interface FdtlTabGroup {
  key: string
  label: string
  iconName: string
  tabs: { key: string; label: string }[]
}

export interface CrewComplementRef {
  _id: string
  operatorId: string
  aircraftTypeIcao: string
  templateKey: string
  counts: Record<string, number>
  notes: string | null
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
}

export interface BlockHourData {
  _id: string
  aircraftTypeIcao: string | null
  seasonType: string
  dir1BlockMinutes: number
  dir2BlockMinutes: number
  dir1FlightMinutes: number | null
  dir2FlightMinutes: number | null
  dir1FuelKg: number | null
  dir2FuelKg: number | null
  notes: string | null
}

export interface CityPairRef {
  _id: string
  operatorId: string
  station1Icao: string
  station1Iata: string | null
  station1Name: string | null
  station1City: string | null
  station1CountryIso2: string | null
  station1Lat: number | null
  station1Lon: number | null
  station2Icao: string
  station2Iata: string | null
  station2Name: string | null
  station2City: string | null
  station2CountryIso2: string | null
  station2Lat: number | null
  station2Lon: number | null
  distanceNm: number | null
  distanceKm: number | null
  routeType: string
  standardBlockMinutes: number | null
  isEtops: boolean
  etopsDiversionTimeMinutes: number | null
  isOverwater: boolean
  blockHours: BlockHourData[]
  revenue: RevenueEntryData[]
  isActive: boolean
  notes: string | null
}

export interface RevenueEntryData {
  _id: string
  classCode: string
  dir1YieldPerPax: number
  dir2YieldPerPax: number
  loadFactor: number
  currency: string
  notes: string | null
}

export interface FlightServiceTypeRef {
  _id: string
  operatorId: string
  code: string
  name: string
  description: string | null
  color: string | null
  isActive: boolean
}

export interface ReportDebriefTimes {
  reportMinutes: number | null
  debriefMinutes: number | null
}

export interface CarrierCodeRef {
  _id: string
  operatorId: string
  iataCode: string
  icaoCode: string | null
  name: string
  category: 'Air' | 'Ground' | 'Other'
  vendorNumber: string | null
  contactName: string | null
  contactPosition: string | null
  phone: string | null
  email: string | null
  sita: string | null
  website: string | null
  defaultCurrency: string | null
  capacity: number | null
  cockpitTimes: ReportDebriefTimes | null
  cabinTimes: ReportDebriefTimes | null
  isActive: boolean
}

export interface CabinClassRef {
  _id: string
  operatorId: string
  code: string
  name: string
  color: string | null
  sortOrder: number
  seatLayout: string | null
  seatPitchIn: number | null
  seatWidthIn: number | null
  seatType: 'standard' | 'premium' | 'lie-flat' | 'suite' | null
  hasIfe: boolean
  hasPower: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface CabinEntry {
  classCode: string
  seats: number
}

export interface LopaConfigRef {
  _id: string
  operatorId: string
  aircraftType: string
  configName: string
  cabins: CabinEntry[]
  totalSeats: number
  isDefault: boolean
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface OperatorRef {
  _id: string
  code: string
  name: string
  icaoCode: string | null
  iataCode: string | null
  callsign: string | null
  country: string | null
  countryIso2: string | null
  regulatoryAuthority: string | null
  timezone: string
  fdtlRuleset: string | null
  mainBaseIcao: string | null
  currencyCode: string | null
  currencySymbol: string | null
  dateFormat: 'DD-MMM-YY' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD.MM.YYYY'
  delayCodeAdherence: 'ahm730' | 'ahm732'
  enabledModules: string[]
  accentColor: string
  logoUrl: string | null
  isActive: boolean
}

export interface AirportLookupResult {
  source: string
  icaoCode: string | null
  iataCode: string | null
  name: string | null
  city: string | null
  country: string | null
  timezone: string | null
  utcOffsetHours: number | null
  latitude: number | null
  longitude: number | null
  elevationFt: number | null
  numberOfRunways: number | null
  longestRunwayFt: number | null
  runways: Omit<RunwayData, '_id'>[]
}

export interface ReferenceStats {
  operators: number
  airports: number
  aircraftTypes: number
  countries: number
  delayCodes: number
  flightServiceTypes: number
  crewPositions: number
  expiryCodeCategories: number
  expiryCodes: number
  total: number
}

// ─── API methods ──────────────────────────────────────────

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: {
    _id: string
    operatorId: string
    role: string
    profile: {
      firstName: string
      lastName: string
      email: string
      avatarUrl: string
    }
    [key: string]: unknown
  }
}

export interface RefreshResponse {
  accessToken: string
  refreshToken: string
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  refreshToken: (refreshToken: string) =>
    request<RefreshResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  setPassword: (userId: string, password: string) =>
    request<{ success: boolean }>('/auth/set-password', {
      method: 'POST',
      body: JSON.stringify({ userId, password }),
    }),

  forgotPassword: (email: string) =>
    request<{ success: boolean }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<{ success: boolean }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

  getMe: () => request<UserData>('/users/me'),

  listUsers: (q: { operatorId: string; role?: string; active?: boolean }) => {
    const params = new URLSearchParams({ operatorId: q.operatorId })
    if (q.role) params.set('role', q.role)
    if (q.active === false) params.set('active', 'false')
    return request<UserListItem[]>(`/users?${params.toString()}`)
  },

  // Flights
  getFlights: (operatorId = '', from?: string, to?: string) => {
    let path = `/flights?operatorId=${operatorId}`
    if (from) path += `&from=${from}`
    if (to) path += `&to=${to}`
    return request<Flight[]>(path)
  },

  getFlight: (id: string) => request<Flight>(`/flights/${id}`),

  // Reference data
  getAirports: (params?: { search?: string; crewBase?: boolean; country?: string }) => {
    let path = '/airports?active=true'
    if (params?.search) path += `&search=${encodeURIComponent(params.search)}`
    if (params?.crewBase) path += '&crewBase=true'
    if (params?.country) path += `&country=${encodeURIComponent(params.country)}`
    return request<AirportRef[]>(path)
  },

  getAirport: (id: string) => request<AirportRef>(`/airports/${id}`),

  createAirport: (data: Partial<AirportRef>) =>
    request<AirportRef>('/airports', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAirport: (id: string, data: Partial<AirportRef>) =>
    request<AirportRef>(`/airports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteAirport: (id: string) =>
    request<{ success: boolean }>(`/airports/${id}`, {
      method: 'DELETE',
    }),

  lookupAirport: (icao: string) => request<AirportLookupResult>(`/airports/lookup?icao=${encodeURIComponent(icao)}`),

  addRunway: (airportId: string, data: Omit<RunwayData, '_id'>) =>
    request<AirportRef>(`/airports/${airportId}/runways`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRunway: (airportId: string, runwayId: string, data: Partial<Omit<RunwayData, '_id'>>) =>
    request<AirportRef>(`/airports/${airportId}/runways/${runwayId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteRunway: (airportId: string, runwayId: string) =>
    request<AirportRef>(`/airports/${airportId}/runways/${runwayId}`, {
      method: 'DELETE',
    }),

  // ─── Crew Hotels ────────────────────────────────────────
  getCrewHotels: (params?: { airportIcao?: string; active?: boolean; search?: string }) => {
    const qs = new URLSearchParams()
    if (params?.airportIcao) qs.set('airportIcao', params.airportIcao)
    if (params?.active) qs.set('active', 'true')
    if (params?.search) qs.set('search', params.search)
    const query = qs.toString()
    return request<CrewHotelRef[]>(`/crew-hotels${query ? `?${query}` : ''}`)
  },

  getCrewHotel: (id: string) => request<CrewHotelRef>(`/crew-hotels/${id}`),

  createCrewHotel: (data: Partial<CrewHotelRef>) =>
    request<CrewHotelRef>('/crew-hotels', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCrewHotel: (id: string, data: Partial<CrewHotelRef>) =>
    request<CrewHotelRef>(`/crew-hotels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteCrewHotel: (id: string) =>
    request<{ success: boolean }>(`/crew-hotels/${id}`, {
      method: 'DELETE',
    }),

  addHotelContract: (hotelId: string, data: Partial<HotelContract>) =>
    request<CrewHotelRef>(`/crew-hotels/${hotelId}/contracts`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateHotelContract: (hotelId: string, contractId: string, data: Partial<HotelContract>) =>
    request<CrewHotelRef>(`/crew-hotels/${hotelId}/contracts/${contractId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteHotelContract: (hotelId: string, contractId: string) =>
    request<CrewHotelRef>(`/crew-hotels/${hotelId}/contracts/${contractId}`, {
      method: 'DELETE',
    }),

  addHotelShuttle: (hotelId: string, data: Partial<HotelShuttle>) =>
    request<CrewHotelRef>(`/crew-hotels/${hotelId}/shuttles`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateHotelShuttle: (hotelId: string, shuttleId: string, data: Partial<HotelShuttle>) =>
    request<CrewHotelRef>(`/crew-hotels/${hotelId}/shuttles/${shuttleId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteHotelShuttle: (hotelId: string, shuttleId: string) =>
    request<CrewHotelRef>(`/crew-hotels/${hotelId}/shuttles/${shuttleId}`, {
      method: 'DELETE',
    }),

  uploadCrewHotelBulk: async (type: 'details' | 'effective-dates', file: File | Blob, dryRun = false) => {
    const path = dryRun ? '/crew-hotels/bulk/validate' : `/crew-hotels/bulk/${type}`
    const form = new FormData()
    form.append('file', file, 'upload.csv')
    if (dryRun) form.append('type', type)
    const token = _authCallbacks?.getAccessToken() ?? null
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${_baseUrl}${path}`, { method: 'POST', headers, body: form })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`API ${res.status}: ${body}`)
    }
    return res.json() as Promise<CrewHotelBulkResult>
  },

  crewHotelTemplateUrl: (type: 'details' | 'effective-dates') => `${_baseUrl}/crew-hotels/templates/${type}`,

  getAircraftTypes: (operatorId = '') => request<AircraftTypeRef[]>(`/aircraft-types?operatorId=${operatorId}`),

  getAircraftType: (id: string) => request<AircraftTypeRef>(`/aircraft-types/${id}`),

  createAircraftType: (data: Partial<AircraftTypeRef>) =>
    request<AircraftTypeRef>('/aircraft-types', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAircraftType: (id: string, data: Partial<AircraftTypeRef>) =>
    request<AircraftTypeRef>(`/aircraft-types/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteAircraftType: (id: string) =>
    request<{ success: boolean }>(`/aircraft-types/${id}`, {
      method: 'DELETE',
    }),

  // ─── Aircraft Registrations ─────────────────────────────
  getAircraftRegistrations: (operatorId = '') =>
    request<AircraftRegistrationRef[]>(`/aircraft-registrations?operatorId=${operatorId}`),

  getAircraftRegistration: (id: string) => request<AircraftRegistrationRef>(`/aircraft-registrations/${id}`),

  createAircraftRegistration: (data: Partial<AircraftRegistrationRef>) =>
    request<AircraftRegistrationRef>('/aircraft-registrations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAircraftRegistration: (id: string, data: Partial<AircraftRegistrationRef>) =>
    request<AircraftRegistrationRef>(`/aircraft-registrations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteAircraftRegistration: (id: string) =>
    request<{ success: boolean }>(`/aircraft-registrations/${id}`, {
      method: 'DELETE',
    }),

  uploadAircraftImage: async (id: string, file: File): Promise<{ success: boolean; imageUrl: string }> => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${_baseUrl}/aircraft-registrations/${id}/image`, {
      method: 'POST',
      body: form,
    })
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
    return res.json()
  },

  getCountries: (params?: { region?: string; search?: string }) => {
    let path = '/countries'
    const qs: string[] = []
    if (params?.region) qs.push(`region=${encodeURIComponent(params.region)}`)
    if (params?.search) qs.push(`search=${encodeURIComponent(params.search)}`)
    if (qs.length) path += `?${qs.join('&')}`
    return request<CountryRef[]>(path)
  },

  getCountry: (id: string) => request<CountryRef>(`/countries/${id}`),

  createCountry: (data: Partial<CountryRef>) =>
    request<CountryRef>('/countries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCountry: (id: string, data: Partial<CountryRef>) =>
    request<CountryRef>(`/countries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteCountry: (id: string) =>
    request<{ success: boolean }>(`/countries/${id}`, {
      method: 'DELETE',
    }),

  // ─── City Pairs ─────────────────────────────────────────
  getCityPairs: (operatorId?: string) => {
    const qs = operatorId ? `?operatorId=${operatorId}` : ''
    return request<CityPairRef[]>(`/city-pairs${qs}`)
  },

  getCityPair: (id: string) => request<CityPairRef>(`/city-pairs/${id}`),

  createCityPair: (data: {
    station1Icao: string
    station2Icao: string
    standardBlockMinutes?: number
    notes?: string
  }) =>
    request<CityPairRef>('/city-pairs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCityPair: (id: string, data: Partial<CityPairRef>) =>
    request<CityPairRef>(`/city-pairs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteCityPair: (id: string) =>
    request<{ success: boolean }>(`/city-pairs/${id}`, {
      method: 'DELETE',
    }),

  addBlockHour: (cityPairId: string, data: Omit<BlockHourData, '_id'>) =>
    request<CityPairRef>(`/city-pairs/${cityPairId}/block-hours`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateBlockHour: (cityPairId: string, bhId: string, data: Partial<Omit<BlockHourData, '_id'>>) =>
    request<CityPairRef>(`/city-pairs/${cityPairId}/block-hours/${bhId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteBlockHour: (cityPairId: string, bhId: string) =>
    request<CityPairRef>(`/city-pairs/${cityPairId}/block-hours/${bhId}`, {
      method: 'DELETE',
    }),

  // ─── Revenue ──────────────────────────────────────────────

  addRevenue: (cityPairId: string, data: Omit<RevenueEntryData, '_id'>) =>
    request<CityPairRef>(`/city-pairs/${cityPairId}/revenue`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRevenue: (cityPairId: string, revId: string, data: Partial<Omit<RevenueEntryData, '_id'>>) =>
    request<CityPairRef>(`/city-pairs/${cityPairId}/revenue/${revId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteRevenue: (cityPairId: string, revId: string) =>
    request<CityPairRef>(`/city-pairs/${cityPairId}/revenue/${revId}`, {
      method: 'DELETE',
    }),

  seedRevenue: (operatorId: string, removeB787 = false) =>
    request<{ seeded: number; total: number }>('/city-pairs/seed-revenue', {
      method: 'POST',
      body: JSON.stringify({ operatorId, removeB787 }),
    }),

  // ─── Activity Code Groups ────────────────────────────────
  getActivityCodeGroups: (operatorId = '') =>
    request<ActivityCodeGroupRef[]>(`/activity-code-groups?operatorId=${operatorId}`),

  createActivityCodeGroup: (data: Partial<ActivityCodeGroupRef>) =>
    request<ActivityCodeGroupRef>('/activity-code-groups', { method: 'POST', body: JSON.stringify(data) }),

  updateActivityCodeGroup: (id: string, data: Partial<ActivityCodeGroupRef>) =>
    request<ActivityCodeGroupRef>(`/activity-code-groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteActivityCodeGroup: (id: string) =>
    request<{ success: boolean }>(`/activity-code-groups/${id}`, { method: 'DELETE' }),

  // ─── Activity Codes ────────────────────────────────────
  getActivityCodes: (operatorId = '') => request<ActivityCodeRef[]>(`/activity-codes?operatorId=${operatorId}`),

  createActivityCode: (data: Partial<ActivityCodeRef>) =>
    request<ActivityCodeRef>('/activity-codes', { method: 'POST', body: JSON.stringify(data) }),

  updateActivityCode: (id: string, data: Partial<ActivityCodeRef>) =>
    request<ActivityCodeRef>(`/activity-codes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  updateActivityCodeFlags: (id: string, flags: string[]) =>
    request<ActivityCodeRef>(`/activity-codes/${id}/flags`, { method: 'PATCH', body: JSON.stringify({ flags }) }),

  updateActivityCodePositions: (id: string, positions: string[]) =>
    request<ActivityCodeRef>(`/activity-codes/${id}/positions`, {
      method: 'PATCH',
      body: JSON.stringify({ applicablePositions: positions }),
    }),

  deleteActivityCode: (id: string) => request<{ success: boolean }>(`/activity-codes/${id}`, { method: 'DELETE' }),

  seedActivityCodeDefaults: (operatorId = '') =>
    request<{ success: boolean; groupCount: number; codeCount: number }>('/activity-codes/seed-defaults', {
      method: 'POST',
      body: JSON.stringify({ operatorId }),
    }),

  getDelayCodes: (operatorId = '') => request<DelayCodeRef[]>(`/delay-codes?operatorId=${operatorId}`),

  createDelayCode: (data: Partial<DelayCodeRef>) =>
    request<DelayCodeRef>('/delay-codes', { method: 'POST', body: JSON.stringify(data) }),

  updateDelayCode: (id: string, data: Partial<DelayCodeRef>) =>
    request<DelayCodeRef>(`/delay-codes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteDelayCode: (id: string) => request<{ success: boolean }>(`/delay-codes/${id}`, { method: 'DELETE' }),

  getCrewPositions: (operatorId = '', includeInactive = false) => {
    let path = `/crew-positions?operatorId=${operatorId}`
    if (includeInactive) path += '&includeInactive=true'
    return request<CrewPositionRef[]>(path)
  },

  createCrewPosition: (data: Partial<CrewPositionRef>) =>
    request<CrewPositionRef>('/crew-positions', { method: 'POST', body: JSON.stringify(data) }),

  updateCrewPosition: (id: string, data: Partial<CrewPositionRef>) =>
    request<CrewPositionRef>(`/crew-positions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteCrewPosition: (id: string) => request<{ success: boolean }>(`/crew-positions/${id}`, { method: 'DELETE' }),

  getCrewPositionReferences: (id: string) => request<CrewPositionReferences>(`/crew-positions/${id}/references`),

  seedCrewPositions: (operatorId = '') =>
    request<{ success: boolean }>('/crew-positions/seed-defaults', {
      method: 'POST',
      body: JSON.stringify({ operatorId }),
    }),

  // ─── Crew Complements ──────────────────────────────────
  getCrewComplements: (operatorId = '', aircraftTypeIcao?: string) => {
    let path = `/crew-complements?operatorId=${operatorId}`
    if (aircraftTypeIcao) path += `&aircraftTypeIcao=${encodeURIComponent(aircraftTypeIcao)}`
    return request<CrewComplementRef[]>(path)
  },

  createCrewComplement: (data: Partial<CrewComplementRef>) =>
    request<CrewComplementRef>('/crew-complements', { method: 'POST', body: JSON.stringify(data) }),

  updateCrewComplement: (id: string, data: Partial<CrewComplementRef>) =>
    request<CrewComplementRef>(`/crew-complements/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteCrewComplement: (id: string) => request<{ success: boolean }>(`/crew-complements/${id}`, { method: 'DELETE' }),

  seedCrewComplementDefaults: (operatorId = '', aircraftTypeIcao?: string) =>
    request<{ success: boolean; count: number }>('/crew-complements/seed-defaults', {
      method: 'POST',
      body: JSON.stringify({ operatorId, aircraftTypeIcao }),
    }),

  deleteCrewComplementsByType: (operatorId: string, icaoType: string) =>
    request<{ success: boolean }>(
      `/crew-complements/by-type/${encodeURIComponent(icaoType)}?operatorId=${operatorId}`,
      {
        method: 'DELETE',
      },
    ),

  // ─── Crew Groups ─────────────────────────────────────────
  getCrewGroups: (operatorId = '', includeInactive = false) => {
    let path = `/crew-groups?operatorId=${operatorId}`
    if (includeInactive) path += '&includeInactive=true'
    return request<CrewGroupRef[]>(path)
  },

  createCrewGroup: (data: Partial<CrewGroupRef>) =>
    request<CrewGroupRef>('/crew-groups', { method: 'POST', body: JSON.stringify(data) }),

  updateCrewGroup: (id: string, data: Partial<CrewGroupRef>) =>
    request<CrewGroupRef>(`/crew-groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteCrewGroup: (id: string) => request<{ success: boolean }>(`/crew-groups/${id}`, { method: 'DELETE' }),

  seedCrewGroups: (operatorId = '') =>
    request<{ success: boolean; count: number }>('/crew-groups/seed-defaults', {
      method: 'POST',
      body: JSON.stringify({ operatorId }),
    }),

  // ─── Duty Patterns ──────────────────────────────────────
  getDutyPatterns: (operatorId = '') => request<DutyPatternRef[]>(`/duty-patterns?operatorId=${operatorId}`),

  createDutyPattern: (data: Partial<DutyPatternRef>) =>
    request<DutyPatternRef>('/duty-patterns', { method: 'POST', body: JSON.stringify(data) }),

  updateDutyPattern: (id: string, data: Partial<DutyPatternRef>) =>
    request<DutyPatternRef>(`/duty-patterns/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteDutyPattern: (id: string) => request<{ success: boolean }>(`/duty-patterns/${id}`, { method: 'DELETE' }),

  seedDutyPatterns: (operatorId = '') =>
    request<{ success: boolean; count: number }>('/duty-patterns/seed-defaults', {
      method: 'POST',
      body: JSON.stringify({ operatorId }),
    }),

  // ─── MPP Lead Times ─────────────────────────────────────
  getMppLeadTimeGroups: (operatorId = '') =>
    request<MppLeadTimeGroupRef[]>(`/mpp-lead-time-groups?operatorId=${operatorId}`),

  createMppLeadTimeGroup: (data: Partial<MppLeadTimeGroupRef>) =>
    request<MppLeadTimeGroupRef>('/mpp-lead-time-groups', { method: 'POST', body: JSON.stringify(data) }),

  updateMppLeadTimeGroup: (id: string, data: Partial<MppLeadTimeGroupRef>) =>
    request<MppLeadTimeGroupRef>(`/mpp-lead-time-groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteMppLeadTimeGroup: (id: string) =>
    request<{ success: boolean }>(`/mpp-lead-time-groups/${id}`, { method: 'DELETE' }),

  getMppLeadTimeItems: (operatorId = '', groupId?: string) => {
    let path = `/mpp-lead-time-items?operatorId=${operatorId}`
    if (groupId) path += `&groupId=${groupId}`
    return request<MppLeadTimeItemRef[]>(path)
  },

  createMppLeadTimeItem: (data: Partial<MppLeadTimeItemRef>) =>
    request<MppLeadTimeItemRef>('/mpp-lead-time-items', { method: 'POST', body: JSON.stringify(data) }),

  updateMppLeadTimeItem: (id: string, data: Partial<MppLeadTimeItemRef>) =>
    request<MppLeadTimeItemRef>(`/mpp-lead-time-items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteMppLeadTimeItem: (id: string) =>
    request<{ success: boolean }>(`/mpp-lead-time-items/${id}`, { method: 'DELETE' }),

  seedMppLeadTimeDefaults: (operatorId = '') =>
    request<{ success: boolean; groupCount: number; itemCount: number }>('/mpp-lead-times/seed-defaults', {
      method: 'POST',
      body: JSON.stringify({ operatorId }),
    }),

  // ─── Scheduled Flights ──────────────────────────────────
  getScheduledFlights: (
    params: {
      operatorId?: string
      seasonCode?: string
      scenarioId?: string
      status?: string
      sortBy?: string
      sortDir?: string
      dateFrom?: string
      dateTo?: string
    } = {},
  ) => {
    const p = new URLSearchParams()
    if (params.operatorId) p.set('operatorId', params.operatorId)
    if (params.seasonCode) p.set('seasonCode', params.seasonCode)
    if (params.scenarioId) p.set('scenarioId', params.scenarioId)
    if (params.status) p.set('status', params.status)
    if (params.sortBy) p.set('sortBy', params.sortBy)
    if (params.sortDir) p.set('sortDir', params.sortDir)
    if (params.dateFrom) p.set('dateFrom', params.dateFrom)
    if (params.dateTo) p.set('dateTo', params.dateTo)
    return request<ScheduledFlightRef[]>(`/scheduled-flights?${p.toString()}`)
  },

  getScheduledFlight: (id: string) => request<ScheduledFlightRef>(`/scheduled-flights/${id}`),

  createScheduledFlight: (data: Partial<ScheduledFlightRef>) =>
    request<ScheduledFlightRef>('/scheduled-flights', { method: 'POST', body: JSON.stringify(data) }),

  createScheduledFlightsBulk: (data: Partial<ScheduledFlightRef>[]) =>
    request<{ count: number }>('/scheduled-flights/bulk', { method: 'POST', body: JSON.stringify(data) }),

  updateScheduledFlight: (id: string, data: Partial<ScheduledFlightRef>) =>
    request<ScheduledFlightRef>(`/scheduled-flights/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  updateScheduledFlightsBulk: (updates: { id: string; changes: Partial<ScheduledFlightRef> }[]) =>
    request<{ modifiedCount: number }>('/scheduled-flights/bulk', { method: 'PATCH', body: JSON.stringify(updates) }),

  deleteScheduledFlight: (id: string) =>
    request<{ success: boolean }>(`/scheduled-flights/${id}`, { method: 'DELETE' }),

  deleteScheduledFlightsBulk: (ids: string[]) =>
    request<{ deletedCount: number }>('/scheduled-flights/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),

  // ─── Scenarios ──────────────────────────────────────────
  getScenarios: (params: { operatorId?: string; seasonCode?: string } = {}) => {
    const p = new URLSearchParams()
    if (params.operatorId) p.set('operatorId', params.operatorId)
    if (params.seasonCode) p.set('seasonCode', params.seasonCode)
    return request<ScenarioRef[]>(`/scenarios?${p.toString()}`)
  },

  /** Flight-date envelope per scenario — used for date-range cascade in Scenario Compare */
  getScenarioEnvelopes: (params: { operatorId?: string } = {}) => {
    const p = new URLSearchParams()
    if (params.operatorId) p.set('operatorId', params.operatorId)
    return request<ScenarioEnvelopeRef[]>(`/scenarios/envelopes?${p.toString()}`)
  },

  createScenario: (data: Partial<ScenarioRef>) =>
    request<ScenarioRef>('/scenarios', { method: 'POST', body: JSON.stringify(data) }),

  cloneScenario: (id: string, name: string, createdBy: string) =>
    request<{ id: string; flightCount: number }>(`/scenarios/${id}/clone`, {
      method: 'POST',
      body: JSON.stringify({ name, createdBy }),
    }),

  copyProductionIntoScenario: (id: string, statuses?: string[]) =>
    request<{ copied: number }>(`/scenarios/${id}/copy-production`, {
      method: 'POST',
      body: JSON.stringify({ statuses }),
    }),

  updateScenario: (id: string, data: Partial<ScenarioRef>) =>
    request<ScenarioRef>(`/scenarios/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  publishScenario: (id: string, publishedBy?: string) =>
    request<{ scenario: ScenarioRef; activatedFlights: number }>(`/scenarios/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify({ publishedBy }),
    }),

  /** Diff preview — dry run, no writes */
  getScenarioDiffPreview: (id: string) =>
    request<{ added: number; modified: number; deleted: number; unchanged: number; total: number }>(
      `/scenarios/${id}/diff-preview`,
    ),

  /** Publish & merge — applies diff to production */
  publishMergeScenario: (id: string, publishedBy?: string) =>
    request<{ added: number; modified: number; deleted: number; unchanged: number }>(`/scenarios/${id}/publish-merge`, {
      method: 'POST',
      body: JSON.stringify({ publishedBy }),
    }),

  deleteScenario: (id: string) => request<{ success: boolean }>(`/scenarios/${id}`, { method: 'DELETE' }),

  /** Bulk wipe all scenarios (and their scoped flights). Pass no params to wipe every operator. */
  deleteAllScenarios: (params: { operatorId?: string; seasonCode?: string } = {}) => {
    const p = new URLSearchParams()
    if (params.operatorId) p.set('operatorId', params.operatorId)
    if (params.seasonCode) p.set('seasonCode', params.seasonCode)
    const qs = p.toString()
    return request<{ scenariosDeleted: number; flightsDeleted: number }>(`/scenarios${qs ? `?${qs}` : ''}`, {
      method: 'DELETE',
    })
  },

  // ─── SSIM Import/Export ────────────────────────────────
  exportSsim: (params: {
    operatorId: string
    seasonCode: string
    scenarioId?: string
    /** 'xlsx' (default — Excel) or 'ssim' (IATA Chapter 7 fixed-width text) */
    format?: 'xlsx' | 'ssim'
    /** Only used when format='ssim'. 'local' uses operator timezone offset; 'utc' uses +0000. */
    timeMode?: 'local' | 'utc'
  }) => {
    const p = new URLSearchParams({ operatorId: params.operatorId, seasonCode: params.seasonCode })
    if (params.scenarioId) p.set('scenarioId', params.scenarioId)
    if (params.format) p.set('format', params.format)
    if (params.timeMode) p.set('timeMode', params.timeMode)
    return fetch(`${getApiBaseUrl()}/ssim/export?${p.toString()}`).then((r) => r.blob())
  },

  // ─── Schedule Messages ────────────────────────────────
  generateScheduleMessages: (params: {
    operatorId: string
    dateFrom?: string
    dateTo?: string
    targetScenarioId?: string
  }) =>
    request<{ messages: any[]; baseCount: number; targetCount: number }>('/schedule-messages/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  getScheduleMessages: (params: ScheduleMessageQuery) => {
    const p = new URLSearchParams({ operatorId: params.operatorId })
    if (params.direction) p.set('direction', params.direction)
    if (params.actionCodes) p.set('actionCodes', params.actionCodes.join(','))
    if (params.messageTypes) p.set('messageTypes', params.messageTypes.join(','))
    if (params.status) p.set('status', params.status)
    if (params.flightNumber) p.set('flightNumber', params.flightNumber)
    if (params.flightDateFrom) p.set('flightDateFrom', params.flightDateFrom)
    if (params.flightDateTo) p.set('flightDateTo', params.flightDateTo)
    if (params.search) p.set('search', params.search)
    if (params.limit != null) p.set('limit', String(params.limit))
    if (params.offset != null) p.set('offset', String(params.offset))
    return request<{ messages: ScheduleMessageRef[]; total: number }>(`/schedule-messages?${p.toString()}`)
  },

  getScheduleMessageStats: (operatorId: string) =>
    request<ScheduleMessageStats>(`/schedule-messages/stats?operatorId=${operatorId}`),

  getHeldScheduleMessages: (operatorId: string) =>
    request<{ messages: ScheduleMessageRef[] }>(`/schedule-messages/held?operatorId=${operatorId}`),

  createScheduleMessage: (data: {
    operatorId: string
    messageType: 'ASM' | 'SSM'
    actionCode: string
    direction: 'inbound' | 'outbound'
    status?: string
    flightNumber?: string | null
    flightDate?: string | null
    depStation?: string | null
    arrStation?: string | null
    seasonCode?: string | null
    summary?: string | null
    rawMessage?: string | null
    changes?: Record<string, unknown> | null
  }) => request<{ id: string }>('/schedule-messages', { method: 'POST', body: JSON.stringify(data) }),

  updateScheduleMessageStatus: (id: string, status: string, rejectReason?: string) =>
    request<{ ok: boolean }>(`/schedule-messages/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, rejectReason }),
    }),

  holdScheduleMessages: (data: {
    operatorId: string
    before: ScheduleMessageSnapshot[]
    after: ScheduleMessageSnapshot[]
    operatorIataCode: string
  }) =>
    request<{ held: number; neutralized: number }>('/schedule-messages/hold-batch', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  releaseScheduleMessages: (messageIds: string[]) =>
    request<{ released: number }>('/schedule-messages/release', {
      method: 'POST',
      body: JSON.stringify({ messageIds }),
    }),

  discardScheduleMessages: (messageIds: string[]) =>
    request<{ discarded: number }>('/schedule-messages/discard', {
      method: 'POST',
      body: JSON.stringify({ messageIds }),
    }),

  applyInboundMessage: (data: {
    messageId: string
    actionCode: string
    flightNumber: string
    flightDate: string
    changes: Record<string, { from?: string; to: string }>
  }) =>
    request<{ ok: boolean; instancesUpdated: number }>('/schedule-messages/apply-inbound', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Generate ASM/SSM from a scenario-vs-production diff AND persist as held.
  // Backs the "Generate & Hold" button in Movement Control 2.1.1.
  generateAndHoldScheduleMessages: (data: {
    operatorId: string
    dateFrom?: string
    dateTo?: string
    targetScenarioId?: string
    operatorIataCode: string
  }) =>
    request<{ held: number; neutralized: number }>('/schedule-messages/generate-and-hold', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getDeliveryLog: (params: {
    operatorId: string
    status?: string
    actionCode?: string
    consumerId?: string
    deliveryStatus?: AsmSsmDeliveryStatus
    flightDateFrom?: string
    flightDateTo?: string
    limit?: number
    offset?: number
  }) => {
    const p = new URLSearchParams({ operatorId: params.operatorId })
    if (params.status) p.set('status', params.status)
    if (params.actionCode) p.set('actionCode', params.actionCode)
    if (params.consumerId) p.set('consumerId', params.consumerId)
    if (params.deliveryStatus) p.set('deliveryStatus', params.deliveryStatus)
    if (params.flightDateFrom) p.set('flightDateFrom', params.flightDateFrom)
    if (params.flightDateTo) p.set('flightDateTo', params.flightDateTo)
    if (params.limit != null) p.set('limit', String(params.limit))
    if (params.offset != null) p.set('offset', String(params.offset))
    return request<{ entries: DeliveryLogEntry[]; total: number }>(`/schedule-messages/delivery-log?${p.toString()}`)
  },

  // ─── 7.1.5.1 ASM/SSM Consumers ─────────────────────────
  getAsmSsmConsumers: (operatorId: string, includeInactive = false) => {
    const p = new URLSearchParams({ operatorId })
    if (includeInactive) p.set('includeInactive', 'true')
    return request<{ consumers: AsmSsmConsumerRef[] }>(`/asm-ssm-consumers?${p.toString()}`)
  },

  createAsmSsmConsumer: (data: AsmSsmConsumerUpsert) =>
    request<{
      consumer: AsmSsmConsumerRef
      apiKey: string | null
      apiKeyMasked: string | null
    }>('/asm-ssm-consumers', { method: 'POST', body: JSON.stringify(data) }),

  updateAsmSsmConsumer: (id: string, patch: Partial<Omit<AsmSsmConsumerUpsert, 'operatorId'>>) =>
    request<{ consumer: AsmSsmConsumerRef }>(`/asm-ssm-consumers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteAsmSsmConsumer: (id: string) => request<{ ok: boolean }>(`/asm-ssm-consumers/${id}`, { method: 'DELETE' }),

  rotateAsmSsmConsumerKey: (id: string) =>
    request<{ apiKey: string; apiKeyMasked: string; rotatedAtUtc: string }>(`/asm-ssm-consumers/${id}/rotate-key`, {
      method: 'POST',
    }),

  // ─── Movement Messages (MVT/LDM) ─────────────────────────

  getMovementMessages: (params: MovementMessageQuery) => {
    const p = new URLSearchParams({ operatorId: params.operatorId })
    if (params.direction) p.set('direction', params.direction)
    if (params.actionCodes) p.set('actionCodes', params.actionCodes.join(','))
    if (params.messageTypes && params.messageTypes.length > 0) p.set('messageTypes', params.messageTypes.join(','))
    if (params.stations && params.stations.length > 0) p.set('stations', params.stations.join(','))
    if (params.status) p.set('status', params.status)
    if (params.flightNumber) p.set('flightNumber', params.flightNumber)
    if (params.flightInstanceId) p.set('flightInstanceId', params.flightInstanceId)
    if (params.flightDateFrom) p.set('flightDateFrom', params.flightDateFrom)
    if (params.flightDateTo) p.set('flightDateTo', params.flightDateTo)
    if (params.limit) p.set('limit', String(params.limit))
    if (params.offset) p.set('offset', String(params.offset))
    return request<{ messages: MovementMessageRef[]; total: number }>(`/movement-messages?${p.toString()}`)
  },

  getMovementMessage: (id: string) => request<{ message: MovementMessageRef }>(`/movement-messages/${id}`),

  getMovementMessageStats: (operatorId: string, params?: { flightDateFrom?: string; flightDateTo?: string }) => {
    const p = new URLSearchParams({ operatorId })
    if (params?.flightDateFrom) p.set('flightDateFrom', params.flightDateFrom)
    if (params?.flightDateTo) p.set('flightDateTo', params.flightDateTo)
    return request<MovementMessageStats>(`/movement-messages/stats?${p.toString()}`)
  },

  /** Real-time health of the four OCC dashboard feeds. */
  getFeedStatus: () => request<FeedStatus>('/feed-status'),

  getHeldMovementMessages: (operatorId: string) =>
    request<{ messages: MovementMessageRef[] }>(`/movement-messages/held?operatorId=${operatorId}`),

  /**
   * Compose an outbound MVT. Returns a discriminated union so the UI can
   * react to a 409 duplicate-held without treating it as an exception:
   *   { ok: true, message }       — new held message created
   *   { ok: false, conflict: … }  — a held message already exists; UI prompts
   *                                  the user to Replace / Keep both / Cancel.
   * All other non-2xx responses still throw via request().
   */
  createMovementMessage: async (input: CreateMovementMessageInput): Promise<CreateMovementMessageResult> => {
    const token = _authCallbacks?.getAccessToken() ?? null
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    let res = await fetch(`${_baseUrl}/movement-messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    })
    // Auto-refresh on 401, mirroring request()
    if (res.status === 401) {
      const pair = await refreshAccessToken()
      if (pair) {
        res = await fetch(`${_baseUrl}/movement-messages`, {
          method: 'POST',
          headers: { ...headers, Authorization: `Bearer ${pair.accessToken}` },
          body: JSON.stringify(input),
        })
      } else {
        _authCallbacks?.onAuthFailure()
        throw new Error('API 401: Unauthorized')
      }
    }

    if (res.status === 409) {
      const body = (await res.json()) as { error: string; existing?: DuplicateHeldExisting }
      if (body.error === 'duplicate_held' && body.existing) {
        return { ok: false, conflict: body.existing }
      }
      throw new Error(`API 409: ${JSON.stringify(body)}`)
    }

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`API ${res.status}: ${body}`)
    }

    const data = (await res.json()) as { message: MovementMessageRef }
    return { ok: true, message: data.message }
  },

  transmitMovementMessage: (id: string) =>
    request<{ message: MovementMessageRef }>(`/movement-messages/${id}/transmit`, {
      method: 'POST',
    }),

  releaseMovementMessages: (messageIds: string[]) =>
    request<{ released: number; sent: number; failed: number }>('/movement-messages/release', {
      method: 'POST',
      body: JSON.stringify({ messageIds }),
    }),

  discardMovementMessages: (messageIds: string[]) =>
    request<{ discarded: number }>('/movement-messages/discard', {
      method: 'POST',
      body: JSON.stringify({ messageIds }),
    }),

  parseInboundTelex: (rawMessage: string) =>
    request<ParseInboundResult>('/movement-messages/inbound/parse', {
      method: 'POST',
      body: JSON.stringify({ rawMessage }),
    }),

  applyInboundMvtMessage: (input: { rawMessage: string; flightInstanceId: string }) =>
    request<ApplyInboundResult>('/movement-messages/inbound/apply', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  // ─── FDTL ───────────────────────────────────────────────
  getFdtlFrameworks: () => request<FdtlFrameworkRef[]>('/fdtl/frameworks'),

  getFdtlTabGroups: () => request<FdtlTabGroup[]>('/fdtl/tab-groups'),

  getFdtlScheme: (operatorId = '') => request<FdtlSchemeRef>(`/fdtl/schemes/${operatorId}`),

  createFdtlScheme: (data: Partial<FdtlSchemeRef>) =>
    request<FdtlSchemeRef>('/fdtl/schemes', { method: 'POST', body: JSON.stringify(data) }),

  updateFdtlScheme: (id: string, data: Partial<FdtlSchemeRef>) =>
    request<FdtlSchemeRef>(`/fdtl/schemes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getFdtlRules: (operatorId = '', frameworkCode?: string, tabKey?: string) => {
    let path = `/fdtl/rules?operatorId=${operatorId}`
    if (frameworkCode) path += `&frameworkCode=${frameworkCode}`
    if (tabKey) path += `&tabKey=${tabKey}`
    return request<FdtlRuleRef[]>(path)
  },

  updateFdtlRule: (id: string, data: Partial<FdtlRuleRef>) =>
    request<FdtlRuleRef>(`/fdtl/rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  resetFdtlRule: (id: string) => request<FdtlRuleRef>(`/fdtl/rules/${id}/reset`, { method: 'POST' }),

  getFdtlTables: (operatorId = '', frameworkCode?: string, tabKey?: string) => {
    let path = `/fdtl/tables?operatorId=${operatorId}`
    if (frameworkCode) path += `&frameworkCode=${frameworkCode}`
    if (tabKey) path += `&tabKey=${tabKey}`
    return request<FdtlTableRef[]>(path)
  },

  updateFdtlTableCell: (tableId: string, rowKey: string, colKey: string, valueMinutes: number | null) =>
    request<FdtlTableRef>(`/fdtl/tables/${tableId}/cells`, {
      method: 'PATCH',
      body: JSON.stringify({ rowKey, colKey, valueMinutes }),
    }),

  resetFdtlTable: (tableId: string) => request<FdtlTableRef>(`/fdtl/tables/${tableId}/reset`, { method: 'POST' }),

  seedFdtl: (operatorId = '', frameworkCode: string) =>
    request<{ success: boolean; frameworkCode: string; rulesSeeded: number; tablesSeeded: number }>('/fdtl/seed', {
      method: 'POST',
      body: JSON.stringify({ operatorId, frameworkCode }),
    }),

  getExpiryCodeCategories: (operatorId = '') =>
    request<ExpiryCodeCategoryRef[]>(`/expiry-code-categories?operatorId=${operatorId}`),

  getExpiryCodes: (operatorId = '', includeInactive = false) => {
    let path = `/expiry-codes?operatorId=${operatorId}`
    if (includeInactive) path += '&includeInactive=true'
    return request<ExpiryCodeRef[]>(path)
  },

  createExpiryCode: (data: Partial<ExpiryCodeRef>) =>
    request<ExpiryCodeRef>('/expiry-codes', { method: 'POST', body: JSON.stringify(data) }),

  updateExpiryCode: (id: string, data: Partial<ExpiryCodeRef>) =>
    request<ExpiryCodeRef>(`/expiry-codes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteExpiryCode: (id: string) => request<{ success: boolean }>(`/expiry-codes/${id}`, { method: 'DELETE' }),

  getFlightServiceTypes: (operatorId = '') =>
    request<FlightServiceTypeRef[]>(`/flight-service-types?operatorId=${operatorId}`),

  createFlightServiceType: (data: Partial<FlightServiceTypeRef>) =>
    request<FlightServiceTypeRef>('/flight-service-types', { method: 'POST', body: JSON.stringify(data) }),

  updateFlightServiceType: (id: string, data: Partial<FlightServiceTypeRef>) =>
    request<FlightServiceTypeRef>(`/flight-service-types/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteFlightServiceType: (id: string) =>
    request<{ success: boolean }>(`/flight-service-types/${id}`, { method: 'DELETE' }),

  getCarrierCodes: (operatorId = '') => request<CarrierCodeRef[]>(`/carrier-codes?operatorId=${operatorId}`),

  createCarrierCode: (data: Partial<CarrierCodeRef>) =>
    request<CarrierCodeRef>('/carrier-codes', { method: 'POST', body: JSON.stringify(data) }),

  updateCarrierCode: (id: string, data: Partial<CarrierCodeRef>) =>
    request<CarrierCodeRef>(`/carrier-codes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteCarrierCode: (id: string) => request<{ success: boolean }>(`/carrier-codes/${id}`, { method: 'DELETE' }),

  getOperators: () => request<OperatorRef[]>('/operators'),

  getOperator: (id: string) => request<OperatorRef>(`/operators/${id}`),

  updateOperator: (id: string, data: Partial<OperatorRef>) =>
    request<OperatorRef>(`/operators/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getReferenceStats: () => request<ReferenceStats>('/reference/stats'),

  // ─── Cabin Classes ──────────────────────────────────────
  getCabinClasses: (operatorId = '') => request<CabinClassRef[]>(`/cabin-classes?operatorId=${operatorId}`),

  getCabinClass: (id: string) => request<CabinClassRef>(`/cabin-classes/${id}`),

  createCabinClass: (data: Partial<CabinClassRef>) =>
    request<CabinClassRef>('/cabin-classes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCabinClass: (id: string, data: Partial<CabinClassRef>) =>
    request<CabinClassRef>(`/cabin-classes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteCabinClass: (id: string) =>
    request<{ success: boolean }>(`/cabin-classes/${id}`, {
      method: 'DELETE',
    }),

  // ─── LOPA Configurations ────────────────────────────────
  getLopaConfigs: (operatorId = '', aircraftType?: string) => {
    let path = `/lopa-configs?operatorId=${operatorId}`
    if (aircraftType) path += `&aircraftType=${encodeURIComponent(aircraftType)}`
    return request<LopaConfigRef[]>(path)
  },

  getLopaConfig: (id: string) => request<LopaConfigRef>(`/lopa-configs/${id}`),

  createLopaConfig: (data: Partial<LopaConfigRef>) =>
    request<LopaConfigRef>('/lopa-configs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateLopaConfig: (id: string, data: Partial<LopaConfigRef>) =>
    request<LopaConfigRef>(`/lopa-configs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteLopaConfig: (id: string) =>
    request<{ success: boolean }>(`/lopa-configs/${id}`, {
      method: 'DELETE',
    }),

  // Health
  health: () => request<{ status: string }>('/health'),

  // ─── User / Settings ─────────────────────────────────────
  // NOTE: getMe is declared above in the Auth section (uses req.userId from JWT).

  updateProfile: (data: Partial<UserProfile>) =>
    request<{ success: boolean; profile: UserProfile }>(`/users/me/profile`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateSecurity: (data: Record<string, any>) =>
    request<{ success: boolean; security: UserSecurity }>(`/users/me/security`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updatePreferences: (data: Partial<UserPreferences>) =>
    request<{ success: boolean; preferences: UserPreferences }>(`/users/me/preferences`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateNotifications: (data: Record<string, any>) =>
    request<{ success: boolean; notifications: UserNotifications }>(`/users/me/notifications`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateDisplay: (data: Record<string, any>) =>
    request<{ success: boolean; display: UserDisplay }>(`/users/me/display`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  revokeSession: (index: number) =>
    request<{ success: boolean }>(`/users/me/sessions/${index}`, {
      method: 'DELETE',
    }),

  // ─── Slots ─────────────────────────────────────────────

  getSlotAirports: () => request<SlotCoordinatedAirport[]>('/slots/airports'),

  getSlotFleetStats: (operatorId: string, seasonCode: string) =>
    request<SlotFleetAirportStats[]>(`/slots/fleet-stats?operatorId=${operatorId}&seasonCode=${seasonCode}`),

  getSlotSeries: (operatorId: string, airportIata: string, seasonCode: string) =>
    request<SlotSeriesRef[]>(
      `/slots/series?operatorId=${operatorId}&airportIata=${airportIata}&seasonCode=${seasonCode}`,
    ),

  getSlotSeriesById: (id: string) => request<SlotSeriesRef>(`/slots/series/${id}`),

  getSlotDates: (seriesId: string) => request<SlotDateRef[]>(`/slots/dates?seriesId=${seriesId}`),

  getSlotMessages: (
    operatorId: string,
    filters?: { airportIata?: string; seasonCode?: string; direction?: string; messageType?: string },
  ) => {
    let path = `/slots/messages?operatorId=${operatorId}`
    if (filters?.airportIata) path += `&airportIata=${filters.airportIata}`
    if (filters?.seasonCode) path += `&seasonCode=${filters.seasonCode}`
    if (filters?.direction) path += `&direction=${filters.direction}`
    if (filters?.messageType) path += `&messageType=${filters.messageType}`
    return request<SlotMessageRef[]>(path)
  },

  getSlotActionLog: (seriesId: string) => request<SlotActionLogRef[]>(`/slots/action-log?seriesId=${seriesId}`),

  getSlotStats: (operatorId: string, airportIata: string, seasonCode: string) =>
    request<SlotPortfolioStats>(
      `/slots/stats?operatorId=${operatorId}&airportIata=${airportIata}&seasonCode=${seasonCode}`,
    ),

  getSlotUtilization: (operatorId: string, airportIata: string, seasonCode: string) =>
    request<SlotUtilizationSummary[]>(
      `/slots/utilization?operatorId=${operatorId}&airportIata=${airportIata}&seasonCode=${seasonCode}`,
    ),

  getSlotCalendar: (operatorId: string, airportIata: string, seasonCode: string) =>
    request<Record<string, SlotCalendarWeekRef[]>>(
      `/slots/calendar?operatorId=${operatorId}&airportIata=${airportIata}&seasonCode=${seasonCode}`,
    ),

  getScheduledFlightsForSlots: (operatorId: string, airportIata: string) =>
    request<ScheduledFlightForSlot[]>(`/slots/scheduled-flights?operatorId=${operatorId}&airportIata=${airportIata}`),

  createSlotSeries: (data: Record<string, unknown>) =>
    request<{ id: string; datesCreated: number }>('/slots/series', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateSlotSeries: (id: string, data: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/slots/series/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteSlotSeries: (id: string) =>
    request<{ ok: boolean }>(`/slots/series/${id}`, {
      method: 'DELETE',
    }),

  updateSlotDateStatus: (id: string, data: { operationStatus: string; jnusReason?: string | null }) =>
    request<{ ok: boolean }>(`/slots/dates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  bulkUpdateSlotDates: (data: {
    seriesId: string
    dateRangeStart: string
    dateRangeEnd: string
    operationStatus: string
    jnusReason?: string | null
  }) =>
    request<{ updated: number }>('/slots/dates/bulk', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  createSlotMessage: (data: Record<string, unknown>) =>
    request<{ id: string }>('/slots/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logSlotAction: (data: {
    seriesId: string
    actionCode: string
    actionSource: string
    messageId?: string | null
    details?: Record<string, unknown> | null
  }) =>
    request<{ id: string }>('/slots/action-log', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  importSlotsFromSchedule: (operatorId: string, airportIata: string, seasonCode: string) =>
    request<{ created: number; skipped: number }>('/slots/import-from-schedule', {
      method: 'POST',
      body: JSON.stringify({ operatorId, airportIata, seasonCode }),
    }),

  syncSlotDates: (operatorId: string, airportIata: string, seasonCode: string) =>
    request<{ synced: number; errors: number }>('/slots/sync-from-instances', {
      method: 'POST',
      body: JSON.stringify({ operatorId, airportIata, seasonCode }),
    }),

  // ─── Codeshare ──────────────────────────────────────────

  getCodeshareAgreements: (operatorId: string) =>
    request<CodeshareAgreementRef[]>(`/codeshare/agreements?operatorId=${operatorId}`),

  getCodeshareAgreement: (id: string) => request<CodeshareAgreementRef>(`/codeshare/agreements/${id}`),

  createCodeshareAgreement: (data: Record<string, unknown>) =>
    request<{ id: string }>('/codeshare/agreements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCodeshareAgreement: (id: string, data: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/codeshare/agreements/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  suspendCodeshareAgreement: (id: string) =>
    request<{ ok: boolean }>(`/codeshare/agreements/${id}/suspend`, {
      method: 'PATCH',
    }),

  getCodeshareMappings: (agreementId: string) =>
    request<CodeshareMappingRef[]>(`/codeshare/mappings?agreementId=${agreementId}`),

  getCodeshareStats: (agreementId: string) =>
    request<CodeshareAgreementStats>(`/codeshare/stats?agreementId=${agreementId}`),

  createCodeshareMapping: (data: Record<string, unknown>) =>
    request<{ id: string }>('/codeshare/mappings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  bulkCreateCodeshareMappings: (data: Record<string, unknown>) =>
    request<{ created: number }>('/codeshare/mappings/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCodeshareMapping: (id: string, data: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/codeshare/mappings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteCodeshareMapping: (id: string) =>
    request<{ ok: boolean }>(`/codeshare/mappings/${id}`, {
      method: 'DELETE',
    }),

  getCodeshareSeatAllocations: (params: { mappingId?: string; agreementId?: string }) => {
    const qs = params.mappingId ? `mappingId=${params.mappingId}` : `agreementId=${params.agreementId}`
    return request<CodeshareSeatAllocationRef[]>(`/codeshare/seat-allocations?${qs}`)
  },

  upsertCodeshareSeatAllocations: (
    mappingId: string,
    allocations: { cabinCode: string; allocatedSeats: number; releaseHours: number }[],
  ) =>
    request<{ ok: boolean }>('/codeshare/seat-allocations', {
      method: 'PUT',
      body: JSON.stringify({ mappingId, allocations }),
    }),

  getCodeshareCabinConfigs: (operatorId: string) =>
    request<Record<string, Record<string, number>>>(`/codeshare/cabin-configs?operatorId=${operatorId}`),

  getCodeshareOperatingFlights: (operatorId: string) =>
    request<CodeshareOperatingFlightRef[]>(`/codeshare/operating-flights?operatorId=${operatorId}`),

  getCodeshareUnmappedFlights: (agreementId: string, operatorId: string) =>
    request<CodeshareOperatingFlightRef[]>(
      `/codeshare/unmapped-flights?agreementId=${agreementId}&operatorId=${operatorId}`,
    ),

  getCodeshareMappingHealth: (agreementId: string, operatorId?: string) => {
    let path = `/codeshare/health?agreementId=${agreementId}`
    if (operatorId) path += `&operatorId=${operatorId}`
    return request<Record<string, string>>(path)
  },

  getCodeshareFlightCapacity: (operatorId: string) =>
    request<Record<string, number>>(`/codeshare/flight-capacity?operatorId=${operatorId}`),

  // ─── Charter ──────────────────────────────────────────

  getCharterContracts: (operatorId: string) =>
    request<CharterContractRef[]>(`/charter/contracts?operatorId=${operatorId}`),

  createCharterContract: (data: Record<string, unknown>) =>
    request<{ id: string }>('/charter/contracts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCharterContract: (id: string, data: Record<string, unknown>) =>
    request<CharterContractRef>(`/charter/contracts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateCharterContractStatus: (id: string, status: string) =>
    request<{ ok: boolean }>(`/charter/contracts/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  deleteCharterContract: (id: string) =>
    request<{ ok: boolean }>(`/charter/contracts/${id}`, {
      method: 'DELETE',
    }),

  getCharterFlights: (contractId: string) => request<CharterFlightRef[]>(`/charter/flights?contractId=${contractId}`),

  createCharterFlight: (data: Record<string, unknown>) =>
    request<{ id: string }>('/charter/flights', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteCharterFlight: (id: string) =>
    request<{ ok: boolean }>(`/charter/flights/${id}`, {
      method: 'DELETE',
    }),

  getCharterStats: (contractId: string) => request<CharterContractStats>(`/charter/stats?contractId=${contractId}`),

  getNextCharterFlightNumber: () => request<{ flightNumber: string }>('/charter/next-flight-number'),

  generateCharterPositioning: (contractId: string, operatorCode: string, homeBase: string) =>
    request<{ legs: CharterPositioningLeg[] }>('/charter/generate-positioning', {
      method: 'POST',
      body: JSON.stringify({ contractId, operatorCode, homeBase }),
    }),

  // ─── Maintenance Checks ─────────────────────────────────

  getMaintenanceCheckTypes: (operatorId = '') =>
    request<MaintenanceCheckTypeRef[]>(`/maintenance-check-types?operatorId=${operatorId}`),

  getMaintenanceCheckType: (id: string) => request<MaintenanceCheckTypeRef>(`/maintenance-check-types/${id}`),

  createMaintenanceCheckType: (data: Partial<MaintenanceCheckTypeRef>) =>
    request<MaintenanceCheckTypeRef>('/maintenance-check-types', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateMaintenanceCheckType: (id: string, data: Partial<MaintenanceCheckTypeRef>) =>
    request<MaintenanceCheckTypeRef>(`/maintenance-check-types/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteMaintenanceCheckType: (id: string) =>
    request<{ ok: boolean }>(`/maintenance-check-types/${id}`, {
      method: 'DELETE',
    }),

  getMaintenanceWindows: (operatorId = '') =>
    request<MaintenanceWindowRef[]>(`/maintenance-windows?operatorId=${operatorId}`),

  createMaintenanceWindow: (data: Partial<MaintenanceWindowRef>) =>
    request<MaintenanceWindowRef>('/maintenance-windows', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteMaintenanceWindow: (id: string) =>
    request<{ ok: boolean }>(`/maintenance-windows/${id}`, {
      method: 'DELETE',
    }),

  // ─── Maintenance Events (Planning) ─────────────────────

  getMaintenanceEvents: (params: {
    operatorId: string
    dateFrom: string
    dateTo: string
    aircraftTypeId?: string
    base?: string
    checkTypeId?: string
    status?: string
    sortBy?: string
  }) => {
    const sp = new URLSearchParams()
    sp.set('operatorId', params.operatorId)
    sp.set('dateFrom', params.dateFrom)
    sp.set('dateTo', params.dateTo)
    if (params.aircraftTypeId) sp.set('aircraftTypeId', params.aircraftTypeId)
    if (params.base) sp.set('base', params.base)
    if (params.checkTypeId) sp.set('checkTypeId', params.checkTypeId)
    if (params.status) sp.set('status', params.status)
    if (params.sortBy) sp.set('sortBy', params.sortBy)
    return request<{ rows: MxGanttAircraftRow[]; stats: MxSchedulingStats }>(`/maintenance-events?${sp.toString()}`)
  },

  getMaintenanceEvent: (id: string) => request<MxEventDetail>(`/maintenance-events/${id}`),

  getMaintenanceFilterOptions: (operatorId = '') =>
    request<MxFilterOptions>(`/maintenance-events/filter-options?operatorId=${operatorId}`),

  createMaintenanceEvent: (data: {
    operatorId: string
    aircraftId: string
    checkTypeId: string
    plannedStartUtc: string
    plannedEndUtc?: string | null
    station: string
    hangar?: string | null
    notes?: string | null
  }) =>
    request<MaintenanceEventRef>('/maintenance-events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateMaintenanceEvent: (id: string, data: Partial<MaintenanceEventRef>) =>
    request<MaintenanceEventRef>(`/maintenance-events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteMaintenanceEvent: (id: string) =>
    request<{ ok: boolean }>(`/maintenance-events/${id}`, {
      method: 'DELETE',
    }),

  acceptAllProposedEvents: (operatorId: string) =>
    request<{ count: number }>('/maintenance-events/accept-all', {
      method: 'POST',
      body: JSON.stringify({ operatorId }),
    }),

  rejectAllProposedEvents: (operatorId: string) =>
    request<{ count: number }>('/maintenance-events/reject-all', {
      method: 'POST',
      body: JSON.stringify({ operatorId }),
    }),

  runMaintenanceForecast: (data: { operatorId: string; dateFrom: string; dateTo: string }) =>
    request<{ totalAircraftAnalyzed: number; totalProposedEvents: number }>('/maintenance-events/forecast', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ─── Disruption Center ─────────────────────────────────────
  listDisruptions: (params: {
    operatorId: string
    from?: string
    to?: string
    status?: string
    category?: string
    severity?: string
    station?: string
    flightNumber?: string
    includeHidden?: boolean
  }) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') qs.append(k, String(v))
    }
    return request<DisruptionIssueRef[]>(`/disruptions?${qs.toString()}`)
  },

  getDisruption: (id: string) =>
    request<{ issue: DisruptionIssueRef; activity: DisruptionActivityRef[] }>(`/disruptions/${id}`),

  scanDisruptions: (data: {
    operatorId: string
    from: string
    to: string
    referenceTimeUtc?: string
    persist?: boolean
  }) =>
    request<{ signals: unknown[]; created?: number; updated?: number }>('/disruptions/scan', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  claimDisruption: (id: string) => request<{ ok: true }>(`/disruptions/${id}/claim`, { method: 'POST' }),

  assignDisruption: (id: string, userId: string) =>
    request<{ ok: true }>(`/disruptions/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  startDisruption: (id: string) => request<{ ok: true }>(`/disruptions/${id}/start`, { method: 'POST' }),

  resolveDisruption: (id: string, body: { resolutionType: string; resolutionNotes?: string }) =>
    request<{ ok: true }>(`/disruptions/${id}/resolve`, { method: 'POST', body: JSON.stringify(body) }),

  closeDisruption: (id: string) => request<{ ok: true }>(`/disruptions/${id}/close`, { method: 'POST' }),

  hideDisruption: (id: string) => request<{ ok: true }>(`/disruptions/${id}/hide`, { method: 'POST' }),

  commentDisruption: (id: string, text: string) =>
    request<{ ok: true }>(`/disruptions/${id}/comment`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  adviseDisruption: (issueId: string) =>
    request<DisruptionAdviceResponse>('/ml/advise-disruption', {
      method: 'POST',
      body: JSON.stringify({ issueId }),
    }),

  getOperatorDisruptionConfig: (operatorId: string) =>
    request<OperatorDisruptionConfig | null>(
      `/operator-disruption-config?operatorId=${encodeURIComponent(operatorId)}`,
    ).catch((err) => {
      // 404 is "no config yet" — resolve to null so callers fall back to defaults.
      if (err instanceof Error && /^API 404/.test(err.message)) return null
      throw err
    }),

  upsertOperatorDisruptionConfig: (body: OperatorDisruptionConfigUpsert) =>
    request<OperatorDisruptionConfig>('/operator-disruption-config', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  // ── 7.1.5.2 Communication Deck / Messaging config ──
  getOperatorMessagingConfig: (operatorId: string) =>
    request<OperatorMessagingConfig | null>(
      `/operator-messaging-config?operatorId=${encodeURIComponent(operatorId)}`,
    ).catch((err) => {
      if (err instanceof Error && /^API 404/.test(err.message)) return null
      throw err
    }),

  upsertOperatorMessagingConfig: (body: OperatorMessagingConfigUpsert) =>
    request<OperatorMessagingConfig>('/operator-messaging-config', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  getInboundMessageToken: () =>
    request<{ exists: boolean; masked: string | null; rotatedAt: string | null }>(
      '/operator-messaging-config/inbound-token',
    ),

  rotateInboundMessageToken: () =>
    request<{ token: string; masked: string; rotatedAt: string }>('/operator-messaging-config/inbound-token/rotate', {
      method: 'POST',
    }),

  getAutoTransmitStatus: () => request<AutoTransmitStatus>('/movement-messages/auto-transmit/status'),

  // ── 4.1.5.4 Pairing Configurations ──
  getOperatorPairingConfig: (operatorId: string) =>
    request<OperatorPairingConfig | null>(
      `/operator-pairing-config?operatorId=${encodeURIComponent(operatorId)}`,
    ).catch((err) => {
      if (err instanceof Error && /^API 404/.test(err.message)) return null
      throw err
    }),

  upsertOperatorPairingConfig: (body: OperatorPairingConfigUpsert) =>
    request<OperatorPairingConfig>('/operator-pairing-config', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  // ── 4.1.6.3 Scheduling Configurations ──
  getOperatorSchedulingConfig: (operatorId: string) =>
    request<OperatorSchedulingConfig | null>(
      `/operator-scheduling-config?operatorId=${encodeURIComponent(operatorId)}`,
    ).catch((err) => {
      if (err instanceof Error && /^API 404/.test(err.message)) return null
      throw err
    }),

  upsertOperatorSchedulingConfig: (body: OperatorSchedulingConfigUpsert) =>
    request<OperatorSchedulingConfig>('/operator-scheduling-config', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  // ── 4.1.8.3 HOTAC Configurations ──
  getOperatorHotacConfig: (operatorId: string) =>
    request<OperatorHotacConfig | null>(`/operator-hotac-config?operatorId=${encodeURIComponent(operatorId)}`).catch(
      (err) => {
        if (err instanceof Error && /^API 404/.test(err.message)) return null
        throw err
      },
    ),

  upsertOperatorHotacConfig: (body: OperatorHotacConfigUpsert) =>
    request<OperatorHotacConfig>('/operator-hotac-config', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  // ── 4.1.8.1 Crew Hotel Management — bookings ──
  getHotelBookings: (
    params: {
      from?: string
      to?: string
      station?: string[]
      status?: string[]
    } = {},
  ) => {
    const qs = new URLSearchParams()
    if (params.from) qs.set('from', params.from)
    if (params.to) qs.set('to', params.to)
    for (const s of params.station ?? []) qs.append('station', s)
    for (const s of params.status ?? []) qs.append('status', s)
    const url = qs.toString() ? `/hotel-bookings?${qs.toString()}` : '/hotel-bookings'
    return request<HotelBookingRef[]>(url)
  },

  upsertHotelBookingsBatch: (body: { rows: HotelBookingDerivedRow[]; runId?: string }) =>
    request<{ upserted: number; preservedManual: number; runId: string }>('/hotel-bookings/upsert-batch', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  createHotelBooking: (body: HotelBookingCreateInput) =>
    request<HotelBookingRef>('/hotel-bookings', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  patchHotelBooking: (id: string, body: HotelBookingPatchInput) =>
    request<HotelBookingRef>(`/hotel-bookings/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  checkInHotelBooking: (id: string, body: { at?: number; by?: 'crew' | 'hotac' | 'hotel' } = {}) =>
    request<HotelBookingRef>(`/hotel-bookings/${encodeURIComponent(id)}/check-in`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  checkOutHotelBooking: (id: string, body: { at?: number } = {}) =>
    request<HotelBookingRef>(`/hotel-bookings/${encodeURIComponent(id)}/check-out`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  noShowHotelBooking: (id: string) =>
    request<HotelBookingRef>(`/hotel-bookings/${encodeURIComponent(id)}/no-show`, {
      method: 'POST',
    }),

  deleteHotelBooking: (id: string) =>
    request<{ success: boolean }>(`/hotel-bookings/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // ── 4.1.8.1 Hotel Email — held / released / sent ──
  getHotelEmails: (
    params: {
      direction?: 'outbound' | 'inbound'
      status?: HotelEmailStatus
      hotelId?: string
      threadId?: string
      from?: string
      to?: string
    } = {},
  ) => {
    const qs = new URLSearchParams()
    if (params.direction) qs.set('direction', params.direction)
    if (params.status) qs.set('status', params.status)
    if (params.hotelId) qs.set('hotelId', params.hotelId)
    if (params.threadId) qs.set('threadId', params.threadId)
    if (params.from) qs.set('from', params.from)
    if (params.to) qs.set('to', params.to)
    const url = qs.toString() ? `/hotel-emails?${qs.toString()}` : '/hotel-emails'
    return request<HotelEmailRef[]>(url)
  },

  getHeldHotelEmails: () => request<HotelEmailRef[]>('/hotel-emails/held'),

  createHotelEmail: (body: HotelEmailCreateInput) =>
    request<HotelEmailRef>('/hotel-emails', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  patchHotelEmail: (id: string, body: HotelEmailPatchInput) =>
    request<HotelEmailRef>(`/hotel-emails/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  releaseHotelEmails: (ids: string[]) =>
    request<{ released: number; skipped: number }>('/hotel-emails/release', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  discardHotelEmails: (ids: string[]) =>
    request<{ discarded: number }>('/hotel-emails/discard', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  ingestInboundHotelEmail: (body: {
    hotelId?: string | null
    fromAddress: string
    subject?: string
    body?: string
    rawSource?: string
    threadId?: string | null
  }) =>
    request<HotelEmailRef>('/hotel-emails/inbound', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // ── 4.1.8.2 Crew Transport — vendor master data ──
  getCrewTransportVendors: (params: { airportIcao?: string; active?: boolean; search?: string } = {}) => {
    const qs = new URLSearchParams()
    if (params.airportIcao) qs.set('airportIcao', params.airportIcao)
    if (params.active === true) qs.set('active', 'true')
    if (params.search) qs.set('search', params.search)
    const url = qs.toString() ? `/crew-transport-vendors?${qs.toString()}` : '/crew-transport-vendors'
    return request<CrewTransportVendorRef[]>(url)
  },

  getCrewTransportVendor: (id: string) =>
    request<CrewTransportVendorRef>(`/crew-transport-vendors/${encodeURIComponent(id)}`),

  createCrewTransportVendor: (body: Partial<CrewTransportVendorRef>) =>
    request<CrewTransportVendorRef>('/crew-transport-vendors', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateCrewTransportVendor: (id: string, body: Partial<CrewTransportVendorRef>) =>
    request<CrewTransportVendorRef>(`/crew-transport-vendors/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteCrewTransportVendor: (id: string) =>
    request<{ success: boolean }>(`/crew-transport-vendors/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  addTransportVendorContract: (vendorId: string, data: Partial<TransportVendorContract>) =>
    request<CrewTransportVendorRef>(`/crew-transport-vendors/${encodeURIComponent(vendorId)}/contracts`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTransportVendorContract: (vendorId: string, contractId: string, data: Partial<TransportVendorContract>) =>
    request<CrewTransportVendorRef>(
      `/crew-transport-vendors/${encodeURIComponent(vendorId)}/contracts/${encodeURIComponent(contractId)}`,
      { method: 'PATCH', body: JSON.stringify(data) },
    ),

  deleteTransportVendorContract: (vendorId: string, contractId: string) =>
    request<CrewTransportVendorRef>(
      `/crew-transport-vendors/${encodeURIComponent(vendorId)}/contracts/${encodeURIComponent(contractId)}`,
      { method: 'DELETE' },
    ),

  addTransportVendorDriver: (vendorId: string, data: Partial<TransportVendorDriver>) =>
    request<CrewTransportVendorRef>(`/crew-transport-vendors/${encodeURIComponent(vendorId)}/drivers`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTransportVendorDriver: (vendorId: string, driverId: string, data: Partial<TransportVendorDriver>) =>
    request<CrewTransportVendorRef>(
      `/crew-transport-vendors/${encodeURIComponent(vendorId)}/drivers/${encodeURIComponent(driverId)}`,
      { method: 'PATCH', body: JSON.stringify(data) },
    ),

  deleteTransportVendorDriver: (vendorId: string, driverId: string) =>
    request<CrewTransportVendorRef>(
      `/crew-transport-vendors/${encodeURIComponent(vendorId)}/drivers/${encodeURIComponent(driverId)}`,
      { method: 'DELETE' },
    ),

  bulkDeleteAssignments: (params: { periodFrom: string; periodTo: string }) => {
    const qs = new URLSearchParams({ periodFrom: params.periodFrom, periodTo: params.periodTo })
    return request<{ success: true; deletedCount: number }>(`/crew-schedule/assignments/bulk?${qs.toString()}`, {
      method: 'DELETE',
    })
  },

  /**
   * Tiered Clear Crew Schedule — single endpoint replacing the pairings-only
   * bulk delete. Retention flags default to `true` (safe). Pass `false` to
   * include that bucket in the wipe.
   */
  bulkClearSchedule: (params: {
    periodFrom: string
    periodTo: string
    retainPreAssigned?: boolean
    retainDayOff?: boolean
    retainStandby?: boolean
  }) => {
    const qs = new URLSearchParams({
      periodFrom: params.periodFrom,
      periodTo: params.periodTo,
      retainPreAssigned: String(params.retainPreAssigned ?? true),
      retainDayOff: String(params.retainDayOff ?? true),
      retainStandby: String(params.retainStandby ?? true),
    })
    return request<{
      success: true
      deletedAssignments: number
      deletedActivities: number
      deletedLegalityIssues: number
      retention: { retainPreAssigned: boolean; retainDayOff: boolean; retainStandby: boolean }
    }>(`/crew-schedule/bulk-clear?${qs.toString()}`, { method: 'DELETE' })
  },

  // ── 4.1.6.1 Auto Roster ──
  startAutoRoster: (params: StartAutoRosterParams) =>
    request<{ runId: string }>('/auto-roster/run', { method: 'POST', body: JSON.stringify(params) }),

  cancelAutoRoster: (runId: string) =>
    request<{ success: true }>(`/auto-roster/${encodeURIComponent(runId)}`, { method: 'DELETE' }),

  getAutoRosterHistory: (operatorId: string) => {
    const qs = new URLSearchParams({ operatorId })
    return request<AutoRosterRun[]>(`/auto-roster/history?${qs.toString()}`)
  },

  getAutoRosterRun: (runId: string) => request<AutoRosterRun>(`/auto-roster/${encodeURIComponent(runId)}`),

  getAutoRosterActive: (operatorId: string) => {
    const qs = new URLSearchParams({ operatorId })
    return request<{ active: AutoRosterActiveRun | null }>(`/auto-roster/active?${qs.toString()}`)
  },

  getAutoRosterPeriodSummary: (operatorId: string, periodFrom: string, periodTo: string) => {
    const qs = new URLSearchParams({ operatorId, periodFrom, periodTo })
    return request<PeriodSummary>(`/auto-roster/period-summary?${qs.toString()}`)
  },

  getAutoRosterFilterOptions: (operatorId: string) =>
    request<AutoRosterFilterOptions>(`/auto-roster/filter-options?operatorId=${encodeURIComponent(operatorId)}`),

  getAutoRosterPeriodBreakdown: (
    operatorId: string,
    periodFrom: string,
    periodTo: string,
    filters?: {
      base?: string | string[]
      position?: string | string[]
      acType?: string | string[]
      crewGroup?: string | string[]
    },
  ) => {
    const qs = new URLSearchParams({ operatorId, periodFrom, periodTo })
    const appendList = (key: string, v: string | string[] | undefined) => {
      if (!v) return
      const arr = Array.isArray(v) ? v : [v]
      for (const x of arr) if (x) qs.append(key, x)
    }
    appendList('base', filters?.base)
    appendList('position', filters?.position)
    appendList('acType', filters?.acType)
    appendList('crewGroup', filters?.crewGroup)
    return request<PeriodBreakdown>(`/auto-roster/period-breakdown?${qs.toString()}`)
  },

  resolveFlight: (q: { operatorId: string; flightNumber: string; date: string; dep?: string; arr?: string }) => {
    const params = new URLSearchParams({ operatorId: q.operatorId, flightNumber: q.flightNumber, date: q.date })
    if (q.dep) params.set('dep', q.dep)
    if (q.arr) params.set('arr', q.arr)
    return request<{ scheduledFlightId: string; operatingDate: string }>(`/gantt/resolve-flight?${params.toString()}`)
  },

  listWeatherAlerts: (icaos?: string[]) => {
    const qs = icaos && icaos.length > 0 ? `?icaos=${encodeURIComponent(icaos.join(','))}` : ''
    return request<WeatherAlertsResponse>(`/weather/alerts${qs}`)
  },

  getStationWeather: (icao: string) =>
    request<WeatherStationObservation>(`/weather/station/${encodeURIComponent(icao)}`),

  // ── Non-Crew People (AIMS 5.2.5) ──
  listNonCrewPeople: (q?: { search?: string; availableOnly?: boolean }) => {
    const params = new URLSearchParams()
    if (q?.search) params.set('search', q.search)
    if (q?.availableOnly) params.set('availableOnly', 'true')
    const qs = params.toString()
    return request<NonCrewPersonRef[]>(`/non-crew-people${qs ? `?${qs}` : ''}`)
  },

  getNonCrewPerson: (id: string) => request<NonCrewPersonRef>(`/non-crew-people/${encodeURIComponent(id)}`),

  createNonCrewPerson: (data: NonCrewPersonCreate) =>
    request<NonCrewPersonRef>('/non-crew-people', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateNonCrewPerson: (id: string, data: Partial<NonCrewPersonCreate>) =>
    request<NonCrewPersonRef>(`/non-crew-people/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteNonCrewPerson: (id: string) =>
    request<{ success: boolean }>(`/non-crew-people/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // ─── Crew (4.1.1 Crew Profile) ─────────────────────────
  getCrew: (filters?: CrewListFilters) => {
    const qs = new URLSearchParams()
    if (filters?.base) qs.set('base', filters.base)
    if (filters?.position) qs.set('position', filters.position)
    if (filters?.status) qs.set('status', filters.status)
    if (filters?.aircraftType) qs.set('aircraftType', filters.aircraftType)
    if (filters?.search) qs.set('search', filters.search)
    if (filters?.groupId) qs.set('groupId', filters.groupId)
    const qstr = qs.toString()
    return request<CrewMemberListItemRef[]>(`/crew${qstr ? `?${qstr}` : ''}`)
  },
  getCrewById: (id: string) => request<FullCrewProfileRef>(`/crew/${encodeURIComponent(id)}`),
  createCrewMember: (data: CrewMemberCreate) =>
    request<CrewMemberRef>('/crew', { method: 'POST', body: JSON.stringify(data) }),
  updateCrewMember: (id: string, data: Partial<CrewMemberRef>) =>
    request<CrewMemberRef>(`/crew/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCrewMember: (id: string) =>
    request<{ success: boolean }>(`/crew/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  syncCrewExpiries: (id: string) =>
    request<{ success: boolean }>(`/crew/${encodeURIComponent(id)}/sync-expiries`, { method: 'POST' }),
  deleteCrewAvatar: (id: string) =>
    request<{ success: boolean }>(`/crew/${encodeURIComponent(id)}/avatar`, { method: 'DELETE' }),

  // Sub-entity CRUD — each takes (crewId, payload) / (crewId, rowId) pattern.
  addCrewPhone: (crewId: string, data: CrewPhoneInput) =>
    request<CrewPhoneRef>(`/crew/${encodeURIComponent(crewId)}/phones`, { method: 'POST', body: JSON.stringify(data) }),
  updateCrewPhone: (crewId: string, phoneId: string, data: Partial<CrewPhoneInput>) =>
    request<CrewPhoneRef>(`/crew/${encodeURIComponent(crewId)}/phones/${phoneId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteCrewPhone: (crewId: string, phoneId: string) =>
    request<{ success: boolean }>(`/crew/${encodeURIComponent(crewId)}/phones/${phoneId}`, { method: 'DELETE' }),

  addCrewPassport: (crewId: string, data: CrewPassportInput) =>
    request<CrewPassportRef>(`/crew/${encodeURIComponent(crewId)}/passports`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCrewPassport: (crewId: string, passportId: string, data: Partial<CrewPassportInput>) =>
    request<CrewPassportRef>(`/crew/${encodeURIComponent(crewId)}/passports/${passportId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteCrewPassport: (crewId: string, passportId: string) =>
    request<{ success: boolean }>(`/crew/${encodeURIComponent(crewId)}/passports/${passportId}`, { method: 'DELETE' }),

  addCrewLicense: (crewId: string, data: CrewLicenseInput) =>
    request<CrewLicenseRef>(`/crew/${encodeURIComponent(crewId)}/licenses`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCrewLicense: (crewId: string, licenseId: string, data: Partial<CrewLicenseInput>) =>
    request<CrewLicenseRef>(`/crew/${encodeURIComponent(crewId)}/licenses/${licenseId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteCrewLicense: (crewId: string, licenseId: string) =>
    request<{ success: boolean }>(`/crew/${encodeURIComponent(crewId)}/licenses/${licenseId}`, { method: 'DELETE' }),

  addCrewVisa: (crewId: string, data: CrewVisaInput) =>
    request<CrewVisaRef>(`/crew/${encodeURIComponent(crewId)}/visas`, { method: 'POST', body: JSON.stringify(data) }),
  updateCrewVisa: (crewId: string, visaId: string, data: Partial<CrewVisaInput>) =>
    request<CrewVisaRef>(`/crew/${encodeURIComponent(crewId)}/visas/${visaId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteCrewVisa: (crewId: string, visaId: string) =>
    request<{ success: boolean }>(`/crew/${encodeURIComponent(crewId)}/visas/${visaId}`, { method: 'DELETE' }),

  addCrewQualification: (crewId: string, data: CrewQualificationInput) =>
    request<CrewQualificationRef>(`/crew/${encodeURIComponent(crewId)}/qualifications`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCrewQualification: (crewId: string, qualId: string, data: Partial<CrewQualificationInput>) =>
    request<CrewQualificationRef>(`/crew/${encodeURIComponent(crewId)}/qualifications/${qualId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteCrewQualification: (crewId: string, qualId: string) =>
    request<{ success: boolean }>(`/crew/${encodeURIComponent(crewId)}/qualifications/${qualId}`, { method: 'DELETE' }),

  updateCrewExpiryDate: (crewId: string, expiryId: string, data: CrewExpiryDateUpdate) =>
    request<CrewExpiryDateRef>(`/crew/${encodeURIComponent(crewId)}/expiry-dates/${expiryId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  upsertCrewBlockHours: (crewId: string, data: CrewBlockHoursInput) =>
    request<CrewBlockHoursRef>(`/crew/${encodeURIComponent(crewId)}/block-hours`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteCrewBlockHours: (crewId: string, rowId: string) =>
    request<{ success: boolean }>(`/crew/${encodeURIComponent(crewId)}/block-hours/${rowId}`, { method: 'DELETE' }),

  addCrewOnOffPattern: (crewId: string, data: CrewOnOffPatternInput) =>
    request<CrewOnOffPatternRef>(`/crew/${encodeURIComponent(crewId)}/on-off-patterns`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteCrewOnOffPattern: (crewId: string, patternId: string) =>
    request<{ success: boolean }>(`/crew/${encodeURIComponent(crewId)}/on-off-patterns/${patternId}`, {
      method: 'DELETE',
    }),

  addCrewAirportRestriction: (crewId: string, data: CrewAirportRestrictionInput) =>
    request<CrewAirportRestrictionRef>(`/crew/${encodeURIComponent(crewId)}/airport-restrictions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteCrewAirportRestriction: (crewId: string, restrictionId: string) =>
    request<{ success: boolean }>(`/crew/${encodeURIComponent(crewId)}/airport-restrictions/${restrictionId}`, {
      method: 'DELETE',
    }),

  addCrewPairing: (crewId: string, data: CrewPairingInput) =>
    request<CrewPairingRef>(`/crew/${encodeURIComponent(crewId)}/pairings`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteCrewPairing: (crewId: string, pairingId: string) =>
    request<{ success: boolean }>(`/crew/${encodeURIComponent(crewId)}/pairings/${pairingId}`, { method: 'DELETE' }),

  addCrewRuleset: (crewId: string, data: CrewRulesetInput) =>
    request<CrewRulesetRef>(`/crew/${encodeURIComponent(crewId)}/rulesets`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteCrewRuleset: (crewId: string, rulesetId: string) =>
    request<{ success: boolean }>(`/crew/${encodeURIComponent(crewId)}/rulesets/${rulesetId}`, { method: 'DELETE' }),

  addCrewGroupAssignment: (crewId: string, data: CrewGroupAssignmentInput) =>
    request<CrewGroupAssignmentRef>(`/crew/${encodeURIComponent(crewId)}/group-assignments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteCrewGroupAssignment: (crewId: string, assignmentId: string) =>
    request<{ success: boolean }>(`/crew/${encodeURIComponent(crewId)}/group-assignments/${assignmentId}`, {
      method: 'DELETE',
    }),

  // ─── Crew Documents (4.1.2) ───────────────────────────
  // NB: the upload endpoint is multipart/form-data; consumers should POST
  // directly via `authedFetch` + FormData, using `getApiBaseUrl()`. The
  // JSON-only helpers below cover list/folders/delete.
  getCrewDocumentFolders: (crewId: string, parentId?: string | null) => {
    const qs = parentId ? `?parentId=${encodeURIComponent(parentId)}` : ''
    return request<CrewDocumentFolderWithCountsRef[]>(`/crew/${encodeURIComponent(crewId)}/document-folders${qs}`)
  },
  getCrewDocuments: (crewId: string, params?: { folderId?: string; expiryCodeId?: string }) => {
    const qs = new URLSearchParams()
    if (params?.folderId) qs.set('folderId', params.folderId)
    if (params?.expiryCodeId) qs.set('expiryCodeId', params.expiryCodeId)
    const qstr = qs.toString()
    return request<CrewDocumentRef[]>(`/crew/${encodeURIComponent(crewId)}/documents${qstr ? `?${qstr}` : ''}`)
  },
  deleteCrewDocument: (crewId: string, docId: string) =>
    request<{ success: boolean }>(`/crew/${encodeURIComponent(crewId)}/documents/${encodeURIComponent(docId)}`, {
      method: 'DELETE',
    }),
  createCrewSubfolder: (crewId: string, data: { parentId: string; name: string }) =>
    request<CrewDocumentFolderRef>(`/crew/${encodeURIComponent(crewId)}/document-folders`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getCrewDocumentStatus: (filters?: CrewDocumentStatusFilters) => {
    const qs = new URLSearchParams()
    if (filters?.base) qs.set('base', filters.base)
    if (filters?.position) qs.set('position', filters.position)
    if (filters?.status) qs.set('status', filters.status)
    if (filters?.groupId) qs.set('groupId', filters.groupId)
    if (filters?.documentStatus && filters.documentStatus.length > 0)
      qs.set('documentStatus', filters.documentStatus.join(','))
    if (filters?.expiryFrom) qs.set('expiryFrom', filters.expiryFrom)
    if (filters?.expiryTo) qs.set('expiryTo', filters.expiryTo)
    if (filters?.search) qs.set('search', filters.search)
    const qstr = qs.toString()
    return request<CrewDocumentStatusRef[]>(`/crew-document-status${qstr ? `?${qstr}` : ''}`)
  },

  // ─── Manpower Planning (4.1.4) ───────────────────────
  getManpowerPlans: () => request<ManpowerPlanRef[]>('/manpower/plans'),
  createManpowerPlan: (data: { name: string; color?: string; sourceId?: string; year?: number }) =>
    request<ManpowerPlanRef>('/manpower/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateManpowerPlan: (id: string, data: Partial<Omit<ManpowerPlanRef, '_id' | 'operatorId'>>) =>
    request<ManpowerPlanRef>(`/manpower/plans/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteManpowerPlan: (id: string) =>
    request<{ success: boolean }>(`/manpower/plans/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  getManpowerPlanSettings: (planId: string) =>
    request<{
      settings: ManpowerPlanSettingsRef | null
      positionSettings: ManpowerPositionSettingsRef[]
    }>(`/manpower/plans/${encodeURIComponent(planId)}/settings`),
  saveManpowerPlanSettings: (
    planId: string,
    data: Partial<Pick<ManpowerPlanSettingsRef, 'wetLeaseActive' | 'naOtherIsDrain'>>,
  ) =>
    request<ManpowerPlanSettingsRef>(`/manpower/plans/${encodeURIComponent(planId)}/settings`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  saveManpowerPositionSettings: (
    planId: string,
    positionId: string,
    data: Partial<Omit<ManpowerPositionSettingsRef, '_id' | 'planId' | 'operatorId' | 'positionId'>>,
  ) =>
    request<ManpowerPositionSettingsRef>(
      `/manpower/plans/${encodeURIComponent(planId)}/position-settings/${encodeURIComponent(positionId)}`,
      { method: 'PUT', body: JSON.stringify(data) },
    ),
  getManpowerFleetOverrides: (planId: string, year: number) =>
    request<ManpowerFleetOverrideRef[]>(`/manpower/plans/${encodeURIComponent(planId)}/fleet-overrides?year=${year}`),
  upsertManpowerFleetOverride: (
    planId: string,
    data: { aircraftTypeIcao: string; monthIndex: number; planYear: number; acCount: number },
  ) =>
    request<ManpowerFleetOverrideRef>(`/manpower/plans/${encodeURIComponent(planId)}/fleet-overrides`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteManpowerFleetOverride: (planId: string, overrideId: string) =>
    request<{ success: boolean }>(
      `/manpower/plans/${encodeURIComponent(planId)}/fleet-overrides/${encodeURIComponent(overrideId)}`,
      { method: 'DELETE' },
    ),
  getManpowerFleetUtilization: (planId: string) =>
    request<ManpowerFleetUtilizationRef[]>(`/manpower/plans/${encodeURIComponent(planId)}/fleet-utilization`),
  saveManpowerFleetUtilization: (planId: string, data: { aircraftTypeIcao: string; dailyUtilizationHours: number }) =>
    request<ManpowerFleetUtilizationRef>(`/manpower/plans/${encodeURIComponent(planId)}/fleet-utilization`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getManpowerEvents: (planId: string, year: number) =>
    request<ManpowerEventRef[]>(`/manpower/plans/${encodeURIComponent(planId)}/events?year=${year}`),
  createManpowerEvent: (
    planId: string,
    data: Omit<ManpowerEventRef, '_id' | 'planId' | 'operatorId' | 'createdAt' | 'updatedAt'>,
  ) =>
    request<ManpowerEventRef>(`/manpower/plans/${encodeURIComponent(planId)}/events`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateManpowerEvent: (
    planId: string,
    eventId: string,
    data: Partial<Omit<ManpowerEventRef, '_id' | 'planId' | 'operatorId' | 'createdAt' | 'updatedAt'>>,
  ) =>
    request<ManpowerEventRef>(`/manpower/plans/${encodeURIComponent(planId)}/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteManpowerEvent: (planId: string, eventId: string) =>
    request<{ success: boolean }>(
      `/manpower/plans/${encodeURIComponent(planId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE' },
    ),
  getManpowerScheduleBh: (planId: string, year: number) =>
    request<Record<string, number[]>>(`/manpower/plans/${encodeURIComponent(planId)}/schedule-bh?year=${year}`),
  getManpowerCrewHeadcount: (planId: string, year: number) =>
    request<Record<string, Record<string, number[]>>>(
      `/manpower/plans/${encodeURIComponent(planId)}/crew-headcount?year=${year}`,
    ),
  getManpowerMonthlyAcCount: (planId: string, year: number) =>
    request<Record<string, number[]>>(`/manpower/plans/${encodeURIComponent(planId)}/monthly-ac-count?year=${year}`),
  getManpowerStandardComplements: (planId: string) =>
    request<Record<string, Record<string, number>>>(
      `/manpower/plans/${encodeURIComponent(planId)}/standard-complements`,
    ),

  // ── 4.1.5 Crew Pairing ──
  getPairingContext: () => request<PairingContextRef>('/pairings/context'),

  getPairingFlightPool: (params: {
    dateFrom: string
    dateTo: string
    scenarioId?: string | null
    aircraftTypes?: string[]
    /**
     * When true, include cross-midnight flights whose operating date is the
     * day BEFORE dateFrom but whose STA lands inside the window. The Gantt
     * view (4.1.5.2) sets this so overnight bars render on the first day;
     * the Text view (4.1.5.1) keeps it off so new pairings never inherit a
     * prior-period startDate.
     */
    includeBleed?: boolean
  }) => {
    const qs = new URLSearchParams({ dateFrom: params.dateFrom, dateTo: params.dateTo })
    if (params.scenarioId) qs.set('scenarioId', params.scenarioId)
    if (params.aircraftTypes?.length) qs.set('aircraftTypes', params.aircraftTypes.join(','))
    if (params.includeBleed) qs.set('includeBleed', '1')
    return request<PairingFlightRef[]>(`/pairings/flight-pool?${qs.toString()}`)
  },

  getPairings: (
    params: { dateFrom?: string; dateTo?: string; scenarioId?: string | null; baseAirport?: string } = {},
  ) => {
    const qs = new URLSearchParams()
    if (params.dateFrom) qs.set('dateFrom', params.dateFrom)
    if (params.dateTo) qs.set('dateTo', params.dateTo)
    if (params.scenarioId) qs.set('scenarioId', params.scenarioId)
    if (params.baseAirport) qs.set('baseAirport', params.baseAirport)
    const query = qs.toString()
    return request<PairingRef[]>(`/pairings${query ? `?${query}` : ''}`)
  },

  getPairing: (id: string) => request<PairingRef>(`/pairings/${encodeURIComponent(id)}`),

  /**
   * Ad-hoc delta detection — compares the pairing's frozen leg times to
   * the current `flightInstances` docs and flags any STD/STA changes. To
   * be replaced by a proper flight-amendment audit log in a later phase.
   */
  getPairingScheduleChanges: (id: string) =>
    request<PairingScheduleChangesRef>(`/pairings/${encodeURIComponent(id)}/schedule-changes`),

  createPairing: (data: PairingCreateInput) =>
    request<PairingRef>('/pairings', { method: 'POST', body: JSON.stringify(data) }),

  updatePairing: (id: string, data: PairingUpdateInput) =>
    request<PairingRef>(`/pairings/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deletePairing: (id: string) =>
    request<{ success: boolean }>(`/pairings/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  /**
   * Bulk-create N pairings in a single request. The server creates them in
   * one MongoDB `insertMany` with a shared `createdAt`. Returns the created
   * docs in the same order as the input.
   */
  bulkCreatePairings: (items: PairingCreateInput[]) =>
    request<{ created: PairingRef[]; failed: number }>('/pairings/bulk', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  /** Bulk-delete by ids — one `deleteMany` under the hood. */
  bulkDeletePairings: (ids: string[]) =>
    request<{ deletedCount: number }>('/pairings/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  getFdtlRuleSet: () => request<SerializedRuleSetRef>('/fdtl/rule-set'),

  // ── 4.1.6 Crew Schedule ──
  getCrewSchedule: (params: {
    from: string
    to: string
    /** Airport _id(s) — comma-joined when multiple. */
    base?: string | string[]
    position?: string | string[]
    /** ICAO type code(s) — comma-joined when multiple. */
    acType?: string | string[]
    crewGroup?: string | string[]
  }) => {
    const qs = new URLSearchParams({ from: params.from, to: params.to })
    const join = (v: string | string[] | undefined): string | null => {
      if (!v) return null
      if (Array.isArray(v)) return v.length > 0 ? v.join(',') : null
      return v || null
    }
    const b = join(params.base)
    const p = join(params.position)
    const a = join(params.acType)
    const g = join(params.crewGroup)
    if (b) qs.set('base', b)
    if (p) qs.set('position', p)
    if (a) qs.set('acType', a)
    if (g) qs.set('crewGroup', g)
    return request<CrewScheduleResponse>(`/crew-schedule?${qs.toString()}`)
  },

  /** Poll the background roster-FDTL sweep status for a window. Used
   *  by the crew-schedule store when the first aggregator response
   *  flagged `rosterEvaluating: true` — the client waits on this
   *  endpoint rather than blocking the initial page load. */
  getCrewScheduleRosterIssues: (params: { from: string; to: string }) =>
    request<{ issues: CrewLegalityIssueRef[]; evaluating: boolean }>(
      `/crew-schedule/roster-issues?from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(params.to)}`,
    ),

  /** Crew currently assigned to a single pairing — display-ready rows
   *  joined server-side. Used by the shared Pairing Details dialog when
   *  opened from 4.1.5.1 / 4.1.5.2 (which don't hydrate the aggregator). */
  getAssignedCrewForPairing: (pairingId: string) =>
    request<{ rows: AssignedCrewRowRef[] }>(`/crew-schedule/pairings/${encodeURIComponent(pairingId)}/crew`),

  /** Legality override audit rows for assignments live in [from, to].
   *  Feeds the 4.1.6 Legality Check toolbar dialog. The future 4.3.1
   *  Schedule Legality Check report will combine this feed with a live
   *  FDTL re-evaluation. */
  getLegalityOverrides: (params: { from: string; to: string }) => {
    const qs = new URLSearchParams({ from: params.from, to: params.to })
    return request<{ rows: LegalityOverrideRowRef[] }>(`/crew-schedule/legality-overrides?${qs.toString()}`)
  },

  createCrewAssignment: (data: CrewAssignmentCreateInput) =>
    request<CrewAssignmentRef>('/crew-schedule/assignments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  patchCrewAssignment: (
    id: string,
    data: {
      status?: CrewAssignmentStatus
      notes?: string | null
      /** Reassigns to a different crew member (Move flow). Server
       *  revalidates seat eligibility and rejects double-book. */
      crewId?: string
    },
  ) =>
    request<CrewAssignmentRef>(`/crew-schedule/assignments/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteCrewAssignment: (id: string) =>
    request<{ success: boolean }>(`/crew-schedule/assignments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  /** Atomic swap of crew on two assignments (AIMS §4.2 Swap duties).
   *  Server revalidates eligibility both ways and rolls back on conflict. */
  swapCrewAssignments: (data: { assignmentAId: string; assignmentBId: string }) =>
    request<{ success: boolean; swappedAssignmentIds: [string, string] }>('/crew-schedule/assignments/swap', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Atomic swap of every assignment overlapping [fromIso, toIso]
   *  between two crew members. Server revalidates eligibility both
   *  ways and rejects on double-book. */
  swapCrewAssignmentsBlock: (data: { sourceCrewId: string; targetCrewId: string; fromIso: string; toIso: string }) =>
    request<{ success: boolean; swappedSourceCount: number; swappedTargetCount: number }>(
      '/crew-schedule/assignments/swap-block',
      { method: 'POST', body: JSON.stringify(data) },
    ),

  createCrewActivity: (data: CrewActivityCreateInput) =>
    request<CrewActivityRef>('/crew-schedule/activities', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Kick off a roster-level FDTL re-evaluation for [from, to]. The
   *  caller should then refetch /crew-schedule to pick up the refreshed
   *  `crewIssues`. */
  reevaluateCrewRoster: (data: { operatorId: string; from: string; to: string; scenarioId?: string | null }) =>
    request<{ total: number; warnings: number; violations: number }>('/crew-schedule/reevaluate-roster', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Bulk-assign one activity code to many (crewId, dateIso) pairs — AIMS
   *  "Assign series of duties". Best-effort on the server: returns created
   *  docs + failed count so the UI can refresh regardless of partials. */
  createCrewActivitiesBulk: (data: {
    activities: Array<{ crewId: string; activityCodeId: string; dateIso: string; notes?: string | null }>
  }) =>
    request<{ created: CrewActivityRef[]; failed: number }>('/crew-schedule/activities/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Edit an existing activity — times, notes, and/or its activity code. */
  patchCrewActivity: (
    id: string,
    data: {
      startUtcIso?: string
      endUtcIso?: string
      notes?: string | null
      activityCodeId?: string
    },
  ) =>
    request<CrewActivityRef>(`/crew-schedule/activities/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteCrewActivity: (id: string) =>
    request<{ success: boolean }>(`/crew-schedule/activities/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  /** Crew memos (AIMS Alt+M) — one collection, three scopes. */
  createCrewMemo: (data: CrewMemoCreateInput) =>
    request<CrewMemoRef>('/crew-schedule/memos', { method: 'POST', body: JSON.stringify(data) }),
  patchCrewMemo: (id: string, data: { text?: string; pinned?: boolean }) =>
    request<CrewMemoRef>(`/crew-schedule/memos/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteCrewMemo: (id: string) =>
    request<{ success: boolean }>(`/crew-schedule/memos/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  /** Publish the current schedule for a period — creates a snapshot the
   *  "Compare to Published" overlay diffs against (AIMS F10). */
  publishCrewSchedule: (data: { periodFromIso: string; periodToIso: string; note?: string | null }) =>
    request<CrewSchedulePublicationRef>('/crew-schedule/publications', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Get the most recent publication that covers a window. 404 when none. */
  getLatestCrewSchedulePublication: (from: string, to: string) =>
    request<CrewSchedulePublicationRef>(
      `/crew-schedule/publications/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),

  /** Create one or more temporary base assignments. Returns the created
   *  rows with server-generated ids. */
  createCrewTempBases: (entries: Array<{ crewId: string; fromIso: string; toIso: string; airportCode: string }>) =>
    request<{ created: TempBaseRef[] }>('/crew-schedule/temp-bases', {
      method: 'POST',
      body: JSON.stringify({ entries }),
    }),

  patchCrewTempBase: (id: string, data: { fromIso?: string; toIso?: string; airportCode?: string }) =>
    request<TempBaseRef>(`/crew-schedule/temp-bases/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteCrewTempBase: (id: string) =>
    request<{ success: boolean }>(`/crew-schedule/temp-bases/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
}

// ── 4.1.6 Crew Schedule types ──
export type CrewAssignmentStatus = 'planned' | 'confirmed' | 'rostered' | 'cancelled'

export interface CrewAssignmentRef {
  _id: string
  operatorId: string
  scenarioId: string | null
  pairingId: string
  crewId: string
  seatPositionId: string
  seatIndex: number
  status: CrewAssignmentStatus
  startUtcIso: string
  endUtcIso: string
  assignedByUserId: string | null
  assignedAtUtc: string
  /** Auto-roster run id that produced this row (null when manual). */
  sourceRunId?: string | null
  legalityResult: unknown
  lastLegalityCheckUtcIso: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface CrewAssignmentCreateInput {
  pairingId: string
  crewId: string
  seatPositionId: string
  seatIndex: number
  status?: CrewAssignmentStatus
  notes?: string | null
  /** Rule violations the planner acknowledged and overrode. Each entry
   *  persists as an `AssignmentViolationOverride` audit row on the
   *  server for the future 4.3.1 Schedule Legality Check report. */
  overrides?: Array<{
    violationKind: string
    messageSnapshot?: string | null
    detail?: unknown
    reason?: string | null
  }>
}

export interface UncrewedPairingRef {
  pairingId: string
  pairingCode?: string
  startDate: string
  missing: Array<{ seatPositionId: string; seatCode: string; count: number }>
}

export interface CrewActivityRef {
  _id: string
  operatorId: string
  scenarioId: string | null
  crewId: string
  activityCodeId: string
  startUtcIso: string
  endUtcIso: string
  dateIso: string | null
  notes: string | null
  assignedByUserId: string | null
  assignedAtUtc: string
  /** Auto-roster run id that produced this row (null when manual). */
  sourceRunId?: string | null
  createdAt: string
  updatedAt: string
}

export interface CrewActivityCreateInput {
  crewId: string
  activityCodeId: string
  dateIso?: string
  startUtcIso?: string
  endUtcIso?: string
  notes?: string | null
}

export type CrewMemoScope = 'pairing' | 'day' | 'crew'

export interface CrewMemoRef {
  _id: string
  operatorId: string
  scenarioId: string | null
  scope: CrewMemoScope
  targetId: string
  dateIso: string | null
  text: string
  pinned: boolean
  authorUserId: string | null
  createdAt: string
  updatedAt: string
}

export interface CrewMemoCreateInput {
  scope: CrewMemoScope
  targetId: string
  dateIso?: string | null
  text: string
  pinned?: boolean
}

export interface CrewSchedulePublicationAssignmentRef {
  assignmentId: string
  pairingId: string
  crewId: string
  seatPositionId: string
  seatIndex: number
  startUtcIso: string
  endUtcIso: string
  status: string
}

export interface CrewSchedulePublicationActivityRef {
  activityId: string
  crewId: string
  activityCodeId: string
  startUtcIso: string
  endUtcIso: string
  dateIso: string | null
}

export interface CrewSchedulePublicationRef {
  _id: string
  operatorId: string
  scenarioId: string | null
  periodFromIso: string
  periodToIso: string
  publishedAtUtc: string
  publishedByUserId: string | null
  note: string | null
  assignments: CrewSchedulePublicationAssignmentRef[]
  activities: CrewSchedulePublicationActivityRef[]
  createdAt: string
  updatedAt: string
}

export interface LegalityOverrideRowRef {
  overrideId: string
  violationKind: string
  messageSnapshot: string | null
  detail: unknown
  crewId: string
  crewName: string | null
  employeeId: string | null
  pairingId: string
  pairingCode: string | null
  overriddenByUserId: string | null
  overriddenAtUtc: string
}

export interface AssignedCrewRowRef {
  crewId: string
  firstName: string
  lastName: string
  employeeId: string
  positionCode: string
  positionColor: string | null
  baseLabel: string | null
  seniority: number | null
  status: string
}

export interface CrewScheduleResponse {
  pairings: PairingRef[]
  crew: CrewMemberListItemRef[]
  assignments: CrewAssignmentRef[]
  uncrewed: UncrewedPairingRef[]
  positions: CrewPositionRef[]
  activities: CrewActivityRef[]
  activityCodes: ActivityCodeRef[]
  activityGroups: ActivityCodeGroupRef[]
  memos: CrewMemoRef[]
  /** Operator's FDTL-driven visual padding for computed duty windows
   *  (falls back to schema defaults when no scheme exists). */
  fdtl: {
    briefMinutes: number
    debriefMinutes: number
    /** Minimum mandatory rest after duty, per CAAV-style rules. Both
     *  values are in minutes. The effective rest for a pairing is
     *  `max(minutes, precedingDutyMinutes)`. 0 = rule not seeded — UI
     *  renders no rest strip. */
    restRules: {
      homeBaseMinMinutes: number
      awayMinMinutes: number
    }
  }
  /** Full serialized FDTL rule set — enables the 4.1.6 FDTL-aware
   *  validator. Null when the operator hasn't configured any scheme. */
  ruleSet: unknown | null
  /** Pre-computed roster-level FDTL issues for the visible window.
   *  Upserted by the `reevaluate-roster` service; drives left-panel
   *  badges and the Legality Check dialog. */
  crewIssues: CrewLegalityIssueRef[]
  /** True when a background roster-FDTL sweep is running for this
   *  window. Clients should poll `getCrewScheduleRosterIssues` until it
   *  flips to false (or a reasonable timeout) to pick up findings. */
  rosterEvaluating?: boolean
  /** All aircraft types defined for the operator — ICAO → family map
   *  used by the client-side AC-type-not-qualified hard-block. */
  aircraftTypes: Array<{ icaoType: string; family: string | null; color: string | null }>
  /** Temporary base assignments overlapping [from, to]. Used to paint
   *  the Gantt band and to suppress `base_mismatch` violations. */
  tempBases: TempBaseRef[]
}

export interface TempBaseRef {
  _id: string
  crewId: string
  fromIso: string
  toIso: string
  airportCode: string
}

export interface CrewLegalityIssueRef {
  _id: string
  operatorId: string
  scenarioId: string | null
  crewId: string
  ruleCode: string
  status: 'warning' | 'violation'
  label: string
  actual: string
  limit: string
  actualNum: number | null
  limitNum: number | null
  /** Rolling-window bounds the violation fired for (e.g. 28D anchor). */
  windowFromIso: string | null
  windowToIso: string | null
  windowLabel: string | null
  legalReference: string | null
  shortReason: string
  assignmentIds: string[]
  activityIds: string[]
  periodFromIso: string
  periodToIso: string
  anchorUtc: string
  detectedAtUtc: string
}

// ── Non-Crew Person types ──

export interface NonCrewPersonRef {
  _id: string
  operatorId: string
  fullName: { first: string; middle: string | null; last: string }
  dateOfBirth: string
  gender: 'M' | 'F' | 'X'
  nationality: string
  passport: { number: string; countryOfIssue: string; expiryDate: string }
  contact: { email: string | null; phone: string | null }
  company: string | null
  department: string | null
  avatarUrl: string | null
  jumpseatPriority: 'low' | 'normal' | 'high'
  doNotList: boolean
  terminated: boolean
  createdAt?: string
  updatedAt?: string
}

export interface NonCrewPersonCreate {
  fullName: { first: string; middle?: string | null; last: string }
  dateOfBirth: string
  gender: 'M' | 'F' | 'X'
  nationality: string
  passport: { number: string; countryOfIssue: string; expiryDate: string }
  contact?: { email?: string | null; phone?: string | null }
  company?: string | null
  department?: string | null
  jumpseatPriority?: 'low' | 'normal' | 'high'
  doNotList?: boolean
  terminated?: boolean
}

// ─── Disruption Center types ────────────────────────────
export interface DisruptionIssueRef {
  _id: string
  operatorId: string
  flightNumber: string | null
  forDate: string | null
  depStation: string | null
  arrStation: string | null
  tail: string | null
  aircraftType: string | null
  category:
    | 'TAIL_SWAP'
    | 'DELAY'
    | 'CANCELLATION'
    | 'DIVERSION'
    | 'CONFIG_CHANGE'
    | 'MISSING_OOOI'
    | 'MAINTENANCE_RISK'
    | 'CURFEW_VIOLATION'
    | 'TAT_VIOLATION'
  source: 'IROPS_AUTO' | 'ML_PREDICTION' | 'MANUAL'
  severity: 'critical' | 'warning' | 'info'
  score: number | null
  reasons: string[]
  title: string
  description: string | null
  status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed'
  assignedTo: string | null
  assignedToName: string | null
  assignedAt: string | null
  resolvedAt: string | null
  resolutionType: string | null
  resolutionNotes: string | null
  closedAt: string | null
  linkedModuleCode: string | null
  linkedEntityId: string | null
  sourceAlertId: string | null
  hidden: boolean
  createdAt: string
  updatedAt: string
}

export interface DisruptionActivityRef {
  _id: string
  issueId: string
  userId: string | null
  userName: string | null
  actionType: 'created' | 'assigned' | 'started' | 'commented' | 'resolved' | 'closed' | 'hidden' | 'linked'
  actionDetail: string | null
  previousStatus: string | null
  newStatus: string | null
  createdAt: string
}

export interface DisruptionAdviceSuggestion {
  title: string
  detail: string
  moduleCode?: string
  confidence?: number
}

export type FeedStatusFilter = 'active' | 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'all'

export interface OperatorDisruptionResolutionType {
  key: string
  label: string
  hint: string
  enabled: boolean
}

export interface OperatorDisruptionConfigSla {
  critical?: number | null
  warning?: number | null
  info?: number | null
}

export interface OperatorDisruptionConfigUi {
  defaultFeedStatus?: FeedStatusFilter | null
  rollingPeriodStops?: number[]
  openBacklogThreshold?: number | null
}

export interface OperatorDisruptionConfigVocabulary {
  categoryLabels?: Record<string, string>
  statusLabels?: Record<string, string>
  resolutionTypes?: OperatorDisruptionResolutionType[]
}

export interface OperatorDisruptionConfig {
  _id: string
  operatorId: string
  sla?: OperatorDisruptionConfigSla
  ui?: OperatorDisruptionConfigUi
  vocabulary?: OperatorDisruptionConfigVocabulary
  refresh?: unknown
  notifications?: unknown
  coverage?: unknown
  overrides?: unknown
  createdAt: string
  updatedAt: string
}

export interface OperatorDisruptionConfigUpsert {
  operatorId: string
  sla?: OperatorDisruptionConfigSla
  ui?: OperatorDisruptionConfigUi
  vocabulary?: OperatorDisruptionConfigVocabulary
  refresh?: unknown
  notifications?: unknown
  coverage?: unknown
  overrides?: unknown
}

// ── 7.1.5.2 Messaging config (Communication Deck) ──

export type MessageActionCode = 'AD' | 'AA' | 'ED' | 'EA' | 'NI' | 'RR' | 'FR'

export interface AutoTransmitConfig {
  enabled: boolean
  intervalMin: number
  ageGateMin: number
  actionAllow: MessageActionCode[]
  respectFilter: boolean
  lastRunAtUtc?: number | null
  lastMatched?: number
  lastSent?: number
  lastFailed?: number
}

export interface ValidationConfig {
  rejectFutureTs: boolean
  futureTsToleranceMin: number
  rejectExcessiveDelay: boolean
  delayThresholdHours: number
  enforceSequence: boolean
  touchAndGoGuardSec: number
  blockTimeDiscrepancyPct: number
  matchByReg: boolean
}

export interface OverwritePolicy {
  acarsOverwriteManual: boolean
  acarsOverwriteMvt: boolean
  mvtOverwriteManual: boolean
}

export interface OperatorMessagingConfig {
  _id: string
  operatorId: string
  autoTransmit: AutoTransmitConfig
  validation: ValidationConfig
  overwrite: OverwritePolicy
  asmSsm?: AsmSsmConfig
  createdAt: string
  updatedAt: string
}

export interface OperatorMessagingConfigUpsert {
  operatorId: string
  autoTransmit?: Partial<Omit<AutoTransmitConfig, 'lastRunAtUtc' | 'lastMatched' | 'lastSent' | 'lastFailed'>>
  validation?: Partial<ValidationConfig>
  overwrite?: Partial<OverwritePolicy>
  asmSsm?: AsmSsmConfigUpsert
}

// ── 7.1.5.1 ASM/SSM Transmission ──

export type AsmSsmActionCode = 'NEW' | 'CNL' | 'TIM' | 'EQT' | 'RPL' | 'RRT' | 'CON' | 'RIN' | 'FLT' | 'SKD' | 'ADM'

export interface AsmSsmGenerationConfig {
  asmEnabled: boolean
  ssmEnabled: boolean
  triggerOnCommit: boolean
  triggerOnPlaygroundCommit: boolean
  messageTypeAllow: AsmSsmActionCode[]
  priority: 'high' | 'medium' | 'low'
}

export interface AsmSsmAutoReleaseConfig {
  enabled: boolean
  intervalMin: number
  ageGateMin: number
  actionAllow: AsmSsmActionCode[]
  lastRunAtUtc?: number | null
  lastMatched?: number
  lastReleased?: number
  lastFailed?: number
}

export interface AsmSsmConfig {
  generation: AsmSsmGenerationConfig
  autoRelease: AsmSsmAutoReleaseConfig
}

export interface AsmSsmConfigUpsert {
  generation?: Partial<AsmSsmGenerationConfig>
  autoRelease?: Partial<Omit<AsmSsmAutoReleaseConfig, 'lastRunAtUtc' | 'lastMatched' | 'lastReleased' | 'lastFailed'>>
}

// ── 4.1.5.4 Pairing Configurations ──
// Operator-wide soft-rule policy for pairing construction. Not FDTL —
// these are planning conventions surfaced as warnings in the Inspector.
export interface AircraftChangeGroundTimeConfig {
  /** Domestic → Domestic, minutes. */
  domToDomMin: number
  /** Domestic → International, minutes. */
  domToIntlMin: number
  /** International → Domestic, minutes. */
  intlToDomMin: number
  /** International → International, minutes. */
  intlToIntlMin: number
}

export interface OperatorPairingConfig {
  _id: string
  operatorId: string
  aircraftChangeGroundTime: AircraftChangeGroundTimeConfig
  createdAt: string
  updatedAt: string
}

export interface OperatorPairingConfigUpsert {
  operatorId: string
  aircraftChangeGroundTime?: Partial<AircraftChangeGroundTimeConfig>
}

// ── 4.1.6.3 Scheduling Configurations ──

/** Soft-rule toggle — planner decides whether the solver penalises violations
 *  of the associated limit, and how heavily (1 = nudge, 10 = strong). */
export interface SchedulingSoftRule {
  enabled: boolean
  weight: number
}

export interface SchedulingDaysOffConfig {
  /** Minimum days off per period per crew. Drives the day-off projection
   *  in Manpower Check and the solver's floor. Default 8 (≈ FDTL-aligned). */
  minPerPeriodDays: number
  maxPerPeriodDays: number
  /** Hard cap on consecutive OFF days the auto-roster may place in a row.
   *  Prevents "mini holiday" blocks. Default 3. */
  maxConsecutiveDaysOff: number
  maxConsecutiveDutyDays: number
  maxConsecutiveDutyDaysRule?: SchedulingSoftRule
  maxConsecutiveMorningDuties: number
  maxConsecutiveMorningDutiesRule?: SchedulingSoftRule
  maxConsecutiveAfternoonDuties: number
  maxConsecutiveAfternoonDutiesRule?: SchedulingSoftRule
}

export interface SchedulingStandbyConfig {
  usePercentage: boolean
  minPerDayFlat: number
  minPerDayPct: number
  homeStandbyRatioPct: number
  startTimeMode: 'auto' | 'fixed'
  autoLeadTimeMin: number
  fixedStartTimes: string[]
  minDurationMin: number
  maxDurationMin: number
  requireLegalRestAfter: boolean
  extraRestAfterMin: number
}

export interface SchedulingDestinationRule {
  _id: string
  scope: 'airport' | 'country'
  code: string
  maxLayoversPerPeriod: number | null
  minSeparationDays: number | null
  enabled: boolean
}

export interface SchedulingObjectivesConfig {
  genderBalanceOnLayovers: boolean
  genderBalanceWeight: number
  /** Solver objective keys in priority order (first = highest). User-reorderable
   *  in 4.1.6.1 Roster Analysis step. Canonical keys:
   *    'coverage' | 'blockHours' | 'legCount' | 'genderBalance' | 'destinationRules'
   *  Empty array = use compiled defaults. */
  priorityOrder: string[]
}

export interface OperatorSchedulingConfig {
  _id: string
  operatorId: string
  carrierMode: 'lcc' | 'legacy'
  daysOff: SchedulingDaysOffConfig
  standby: SchedulingStandbyConfig
  destinationRules: SchedulingDestinationRule[]
  objectives: SchedulingObjectivesConfig
  createdAt: string
  updatedAt: string
}

export interface OperatorSchedulingConfigUpsert {
  operatorId: string
  carrierMode?: 'lcc' | 'legacy'
  daysOff?: Partial<SchedulingDaysOffConfig>
  standby?: Partial<SchedulingStandbyConfig>
  destinationRules?: SchedulingDestinationRule[]
  objectives?: Partial<SchedulingObjectivesConfig>
}

// ── 4.1.8.3 HOTAC Configurations ──

export interface HotacLayoverRuleConfig {
  /** Minimum block-to-block layover hours that qualify for a hotel. */
  layoverMinHours: number
  /** When true, layovers at the crew's home base are skipped. */
  excludeHomeBase: boolean
  /** Additional gate: require the layover to span N hours across local midnight. 0 = disabled. */
  minSpanMidnightHours: number
}

export interface HotacRoomAllocationConfig {
  defaultOccupancy: 'single' | 'double'
  /** Position codes allowed to share a room (e.g. ['CCM']). */
  doubleOccupancyPositions: string[]
  /** Behaviour when crew count exceeds the active contract's per-night cap. */
  contractCapBehaviour: 'reject' | 'supplement'
}

export interface HotacDispatchConfig {
  autoDispatchEnabled: boolean
  /** Local "HH:MM" daily run time; null = manual only. */
  autoDispatchTime: string | null
  /** Send rooming list this many hours before crew arrival. */
  sendBeforeHours: number
  /** Flag a sent email overdue-confirmation if no reply within this many hours. */
  confirmationSlaHours: number
}

export interface HotacCheckInConfig {
  /** Auto-mark check-in if not done by ARR + N min after STA. 0 = disabled. */
  autoCheckInOnArrivalDelayMinutes: number
  /** Mark no-show if no check-in this many hours after STA. */
  noShowAfterHours: number
}

export interface HotacEmailConfig {
  fromAddress: string
  replyTo: string | null
  signature: string
  /** When true, new outbound emails start as 'held' (require explicit Release). */
  holdByDefault: boolean
}

export interface OperatorHotacConfig {
  _id: string
  operatorId: string
  layoverRule: HotacLayoverRuleConfig
  roomAllocation: HotacRoomAllocationConfig
  dispatch: HotacDispatchConfig
  checkIn: HotacCheckInConfig
  email: HotacEmailConfig
  createdAt: string
  updatedAt: string
}

export interface OperatorHotacConfigUpsert {
  operatorId: string
  layoverRule?: Partial<HotacLayoverRuleConfig>
  roomAllocation?: Partial<HotacRoomAllocationConfig>
  dispatch?: Partial<HotacDispatchConfig>
  checkIn?: Partial<HotacCheckInConfig>
  email?: Partial<HotacEmailConfig>
}

// ── 4.1.8.1 HotelBooking ──

export type HotelBookingStatus =
  | 'demand'
  | 'forecast'
  | 'pending'
  | 'sent'
  | 'confirmed'
  | 'in-house'
  | 'departed'
  | 'cancelled'
  | 'no-show'

export type HotelBookingDisruptionFlag =
  | 'inbound-cancelled'
  | 'outbound-cancelled'
  | 'inbound-delayed'
  | 'outbound-delayed'
  | 'extend-night'
  | 'overdue-confirmation'

export interface HotelBookingRef {
  _id: string
  operatorId: string
  pairingId: string
  pairingCode: string
  airportIcao: string
  layoverNightUtcMs: number
  arrFlight: string | null
  arrStaUtcIso: string | null
  depFlight: string | null
  depStdUtcIso: string | null
  layoverHours: number
  hotelId: string | null
  hotelName: string
  hotelPriority: number | null
  hotelDistance: number | null
  contractId: string | null
  rooms: number
  occupancy: 'single' | 'double'
  pax: number
  crewByPosition: Record<string, number>
  crewIds: string[]
  costMinor: number
  costCurrency: string
  status: HotelBookingStatus
  confirmationNumber: string | null
  shuttle: 'Y' | 'N' | 'walking' | null
  notes: string | null
  disruptionFlags: HotelBookingDisruptionFlag[]
  checkedInAtUtcMs: number | null
  checkedInBy: 'crew' | 'hotac' | 'hotel' | null
  checkedOutAtUtcMs: number | null
  createdAtUtcMs: number
  updatedAtUtcMs: number
  createdByUserId: string | null
  sourceRunId: string | null
}

/** Subset of fields the client sends to /hotel-bookings/upsert-batch.
 *  Manual-edit fields (status, confirmationNumber, etc.) are omitted —
 *  the server preserves whatever the planner already saved. */
export interface HotelBookingDerivedRow {
  pairingId: string
  pairingCode?: string
  airportIcao: string
  layoverNightUtcMs: number
  arrFlight?: string | null
  arrStaUtcIso?: string | null
  depFlight?: string | null
  depStdUtcIso?: string | null
  layoverHours?: number
  hotelId?: string | null
  hotelName?: string
  hotelPriority?: number | null
  hotelDistance?: number | null
  rooms?: number
  occupancy?: 'single' | 'double'
  pax?: number
  crewByPosition?: Record<string, number>
  crewIds?: string[]
  costMinor?: number
  costCurrency?: string
  shuttle?: 'Y' | 'N' | 'walking' | null
}

export interface HotelBookingCreateInput {
  pairingId: string
  pairingCode?: string
  airportIcao: string
  layoverNightUtcMs: number
  hotelId?: string | null
  hotelName?: string
  rooms?: number
  occupancy?: 'single' | 'double'
  notes?: string | null
}

export interface HotelBookingPatchInput {
  rooms?: number
  occupancy?: 'single' | 'double'
  status?: HotelBookingStatus
  confirmationNumber?: string | null
  hotelId?: string | null
  hotelName?: string
  contractId?: string | null
  notes?: string | null
  costMinor?: number
  costCurrency?: string
  shuttle?: 'Y' | 'N' | 'walking' | null
  disruptionFlags?: HotelBookingDisruptionFlag[]
}

// ── 4.1.8.1 HotelEmail ──

export type HotelEmailStatus = 'draft' | 'held' | 'pending' | 'sent' | 'partial' | 'failed' | 'discarded' | 'received'

export type HotelEmailDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'retrying'

export interface HotelEmailAttachmentRef {
  _id: string
  name: string
  url: string
  mimeType: string | null
  sizeBytes: number | null
}

export interface HotelEmailDeliveryRef {
  recipient: string
  status: HotelEmailDeliveryStatus
  attemptCount: number
  lastAttemptAtUtcMs: number | null
  deliveredAtUtcMs: number | null
  errorDetail: string | null
  externalRef: string | null
}

export interface HotelEmailRef {
  _id: string
  operatorId: string
  direction: 'outbound' | 'inbound'
  status: HotelEmailStatus
  hotelId: string | null
  hotelName: string
  bookingIds: string[]
  subject: string
  body: string
  attachments: HotelEmailAttachmentRef[]
  recipients: string[]
  rawSource: string | null
  threadId: string | null
  deliveries: HotelEmailDeliveryRef[]
  heldAtUtcMs: number | null
  heldByUserId: string | null
  releasedAtUtcMs: number | null
  releasedByUserId: string | null
  discardedAtUtcMs: number | null
  discardedByUserId: string | null
  createdAtUtcMs: number
  updatedAtUtcMs: number
  createdByUserId: string | null
}

export interface HotelEmailCreateInput {
  direction?: 'outbound'
  hotelId?: string | null
  hotelName?: string
  bookingIds?: string[]
  subject?: string
  body?: string
  recipients?: string[]
  attachments?: Array<{ name: string; url: string; mimeType?: string | null; sizeBytes?: number | null }>
  threadId?: string | null
  /** 'draft' or 'held'. Defaults to operator config's holdByDefault. */
  status?: 'draft' | 'held'
}

export interface HotelEmailPatchInput {
  subject?: string
  body?: string
  recipients?: string[]
  attachments?: Array<{ _id?: string; name: string; url: string; mimeType?: string | null; sizeBytes?: number | null }>
  bookingIds?: string[]
  hotelId?: string | null
  hotelName?: string
}

// ── 4.1.8.2 CrewTransportVendor ──

export interface TransportVendorContact {
  _id: string
  name: string | null
  telephone: string | null
  email: string | null
}

export interface TransportVendorEmail {
  _id: string
  address: string
  isDefault: boolean
}

export interface TransportVendorVehicleTier {
  _id: string
  tierName: string
  paxCapacity: number
  ratePerTrip: number
  ratePerHour: number
}

export interface TransportVendorContract {
  _id: string
  contractNo: string | null
  priority: number
  startDateUtcMs: number | null
  endDateUtcMs: number | null
  weekdayMask: boolean[]
  currency: string
  /** Operator must dispatch at least this many minutes ahead. */
  minLeadTimeMin: number
  /** Vendor confirmation SLA in minutes. */
  slaMin: number
  vehicleTiers: TransportVendorVehicleTier[]
}

export interface TransportVendorDriver {
  _id: string
  name: string
  phone: string | null
  vehiclePlate: string | null
  status: 'active' | 'inactive'
}

export interface CrewTransportVendorRef {
  _id: string
  operatorId: string
  vendorName: string
  baseAirportIcao: string
  priority: number
  isActive: boolean
  addressLine1: string | null
  addressLine2: string | null
  addressLine3: string | null
  latitude: number | null
  longitude: number | null
  serviceAreaIcaos: string[]
  contacts: TransportVendorContact[]
  emails: TransportVendorEmail[]
  contracts: TransportVendorContract[]
  drivers: TransportVendorDriver[]
  createdAt: string | null
  updatedAt: string | null
}

// ── 4.1.6.1 Auto Roster ──

export interface AutoRosterRunStats {
  pairingsTotal: number
  crewTotal: number
  assignedPairings: number
  unassignedPairings: number
  durationMs: number
  objectiveScore: number
  /** Total virtual-seat slots emitted by the orchestrator (sum of crewCounts per pairing). */
  virtualSeatsTotal?: number
  /** Number of OFF activities committed by the chained day-off pass (general mode). */
  daysOffInserted?: number
  /** Crew skipped because already at or above min quota. */
  daysOffSkippedCrew?: number
  /** Crew with errors during day-off pass. */
  daysOffErroredCrew?: number
  /** Number of SBY activities committed by the chained standby pass (general mode). */
  standbyInserted?: number
  /** Home vs airport standby split. */
  standbyHome?: number
  standbyAirport?: number
  /** Solver status string (OPTIMAL / FEASIBLE / INFEASIBLE / UNKNOWN). */
  solverStatus?: string
  /** Mode-specific stats — daysOff / standby runs carry their own shape. */
  mode?: string
  [key: string]: unknown
}

export interface AutoRosterRun {
  _id: string
  operatorId: string
  periodFrom: string
  periodTo: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: string | null
  completedAt: string | null
  stats: AutoRosterRunStats | null
  error: string | null
  createdAt: string
  updatedAt: string
}

export interface AutoRosterActiveRun {
  runId: string
  status: 'queued' | 'running'
  startedAt: string | null
  startedByUserId: string | null
  startedByUserName: string | null
  pct: number
  message: string | null
  periodFrom: string
  periodTo: string
  /** true when someone else owns the running run (lock banner state). */
  lockedForYou: boolean
}

export type AutoRosterMode = 'general' | 'daysOff' | 'standby' | 'longDuties' | 'training'

export interface StartAutoRosterParams {
  operatorId: string
  periodFrom: string
  periodTo: string
  timeLimitSec?: number
  /** Assignment mode. Defaults to 'general' (assign day-offs, flights, standby — no training). */
  mode?: AutoRosterMode
  /** Minimum pairing length in days when mode === 'longDuties'. */
  longDutiesMinDays?: number
  /** Activity code id to stamp for mode === 'daysOff'. When omitted, server
   *  picks first active code with is_day_off flag (SYSTEM default). */
  daysOffActivityCodeId?: string | null
  base?: string
  position?: string
  acType?: string | string[]
  crewGroup?: string | string[]
}

export interface PeriodSummaryCrew {
  total: number
  onLeave: number
  inTraining: number
  available: number
  /** Σ crew-available days (pool − leave − training − day-off) across the period. */
  crewDaysSupply?: number
}

export interface PeriodSummaryPairings {
  total: number
  committed: number
  draft: number
  alreadyAssigned: number
  unassigned: number
  totalBlockHours: number
  /** Σ crew-days required by all pairings active in the period (seats × days). */
  crewDaysDemand?: number
}

export interface PeriodSummary {
  crew: PeriodSummaryCrew
  pairings: PeriodSummaryPairings
}

export interface DayBreakdown {
  date: string
  dayOfWeek: string
  assigned: number
  onLeave: number
  onDayOff: number
  onStandby: number
  /** Home-based standby crew (split from onStandby). */
  onStandbyHome?: number
  /** Airport standby crew (split from onStandby). */
  onStandbyAirport?: number
  inTraining: number
  /** Crew on ground duty (activity flagged `is_ground_duty`). */
  onGroundDuty?: number
  pairingsDemand: number
  pairingsUnassigned: number
  /** Seats required by pairings active this day (respects position filter). */
  seatsDemand?: number
  /** Crew available this day (pool − leave − training − day-off). */
  availableCrew?: number
}

export interface PeriodBreakdown {
  crewTotal: number
  summary: PeriodSummary
  days: DayBreakdown[]
}

export interface AutoRosterFilterOptions {
  bases: string[]
  positions: string[]
  acTypes: string[]
  crewGroups: { id: string; name: string }[]
}

export type AsmSsmDeliveryMode = 'pull_api' | 'sftp' | 'smtp'
export type AsmSsmDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'retrying'

export interface AsmSsmConsumerRef {
  _id: string
  operatorId: string
  name: string
  contactEmail: string | null
  deliveryMode: AsmSsmDeliveryMode
  pullApi: {
    hasKey: boolean
    ipAllowlist: string[]
  }
  sftp: {
    host?: string | null
    port?: number
    user?: string | null
    authType?: 'password' | 'key'
    secretRef?: string | null
    targetPath?: string
    filenamePattern?: string
  }
  smtp: {
    to?: string | null
    cc?: string[]
    bcc?: string[]
    subjectTemplate?: string
    asAttachment?: boolean
    bounceCount?: number
  }
  active: boolean
  lastDeliveryAtUtc: string | null
  totalMessagesConsumed: number
  consecutiveFailures: number
  createdAtUtc: string
  updatedAtUtc: string
}

export interface AsmSsmConsumerUpsert {
  operatorId: string
  name: string
  contactEmail?: string | null
  deliveryMode: AsmSsmDeliveryMode
  pullApi?: { ipAllowlist?: string[] }
  sftp?: {
    host: string
    port?: number
    user: string
    authType?: 'password' | 'key'
    secretRef?: string
    targetPath?: string
    filenamePattern?: string
  }
  smtp?: {
    to: string
    cc?: string[]
    bcc?: string[]
    subjectTemplate?: string
    asAttachment?: boolean
  }
  active?: boolean
}

export interface AsmSsmDeliveryEntry {
  consumerId: string
  consumerName?: string | null
  deliveryMode: AsmSsmDeliveryMode
  status: AsmSsmDeliveryStatus
  attemptCount: number
  lastAttemptAtUtc?: string | null
  deliveredAtUtc?: string | null
  errorDetail?: string | null
  externalRef?: string | null
}

export interface DeliveryLogEntry {
  _id: string
  operatorId: string
  messageType: 'ASM' | 'SSM'
  actionCode: string
  direction: 'inbound' | 'outbound'
  status: string
  flightNumber: string | null
  flightDate: string | null
  depStation: string | null
  arrStation: string | null
  summary: string | null
  rawMessage: string | null
  deliveries: AsmSsmDeliveryEntry[]
  createdAtUtc: string | null
  updatedAtUtc: string | null
}

export interface AutoTransmitStatus {
  enabled: boolean
  intervalMin: number
  lastRunAtUtc: number | null
  nextRunAtUtc: number | null
  lastMatched: number
  lastSent: number
  lastFailed: number
}

export type WeatherAlertTier = 'none' | 'caution' | 'warn'
export type WeatherFlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR'

export interface WeatherStationObservation {
  icao: string
  observedAt: string
  raw: string
  flightCategory: WeatherFlightCategory
  alertTier: WeatherAlertTier
  windDirectionDeg: number | null
  windSpeedKts: number | null
  windGustKts: number | null
  visibilityMeters: number | null
  ceilingFeet: number | null
  temperatureC: number | null
  dewpointC: number | null
  weatherPhenomena: string[]
}

export interface WeatherAlertObservation {
  icao: string
  observedAt: string
  raw: string
  flightCategory: WeatherFlightCategory
  alertTier: WeatherAlertTier
  windSpeedKts: number | null
  windGustKts: number | null
  visibilityMeters: number | null
  ceilingFeet: number | null
  weatherPhenomena: string[]
}

export interface WeatherAlertsResponse {
  stationsMonitored: number
  stationsReporting: number
  counts: { warn: number; caution: number; none: number }
  ifrCount: number
  worst: {
    icao: string
    flightCategory: WeatherFlightCategory
    alertTier: WeatherAlertTier
    observedAt: string
  } | null
  observations: WeatherAlertObservation[]
}

export interface DisruptionAdviceResponse {
  source: 'ml' | 'canned'
  context: {
    flightNumber: string | null
    forDate: string | null
    depStation: string | null
    arrStation: string | null
    tail: string | null
    category: string
    severity: string
    score: number | null
    reasons: string[]
  }
  suggestions: DisruptionAdviceSuggestion[]
}

// ─── Maintenance types ──────────────────────────────────

export interface MaintenanceCheckTypeRef {
  _id: string
  operatorId: string
  code: string
  name: string
  description: string | null
  amosCode: string | null
  applicableAircraftTypeIds: string[]
  defaultHoursInterval: number | null
  defaultCyclesInterval: number | null
  defaultDaysInterval: number | null
  defaultDurationHours: number | null
  defaultStation: string | null
  requiresGrounding: boolean
  resetsCheckCodes: string[] | null
  color: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface MaintenanceWindowRef {
  _id: string
  operatorId: string
  base: string
  windowStartUtc: string
  windowEndUtc: string
  windowDurationHours: number
  isManualOverride: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

// ─── Maintenance Event types ───────────────────────────

export interface MaintenanceEventRef {
  _id: string
  operatorId: string
  aircraftId: string
  checkTypeId: string
  plannedStartUtc: string
  plannedEndUtc: string | null
  actualStartUtc: string | null
  actualEndUtc: string | null
  station: string
  hangar: string | null
  status: string
  phase: string
  source: string
  notes: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface MxEventRow {
  id: string
  aircraftId: string
  registration: string
  icaoType: string
  base: string
  checkTypeId: string
  checkCode: string
  checkName: string
  checkColor: string
  plannedStart: string
  plannedEnd: string | null
  actualStart: string | null
  actualEnd: string | null
  station: string
  hangar: string | null
  status: string
  phase: string
  source: string
  notes: string | null
}

export interface MxForecastMarker {
  checkCode: string
  checkName: string
  trigger: 'hours' | 'cycles' | 'calendar'
  dueDate: string
  remaining: number
  tier: 1 | 2
}

export interface MxGanttAircraftRow {
  aircraftId: string
  registration: string
  icaoType: string
  acTypeColor: string
  base: string
  events: MxEventRow[]
  forecasts: MxForecastMarker[]
}

export interface MxSchedulingStats {
  total: number
  proposed: number
  planned: number
  confirmed: number
  inProgress: number
}

export interface MxFilterOptions {
  aircraftTypes: { id: string; icaoType: string; name: string }[]
  bases: { icao: string }[]
  checkTypes: { id: string; code: string; name: string }[]
}

export interface MxEventDetail {
  event: MxEventRow
  forecast: {
    triggerAxis: string
    remainingHours: number | null
    remainingCycles: number | null
    remainingDays: number | null
    hoursUsed: number
    hoursLimit: number
    cyclesUsed: number
    cyclesLimit: number
    daysUsed: number
    daysLimit: number
    bufferDays: number
  }
}

// ─── Codeshare types ────────────────────────────────────

export interface CodeshareAgreementRef {
  _id: string
  operatorId: string
  partnerAirlineCode: string
  partnerAirlineName: string
  partnerNumericCode: string | null
  agreementType: 'free_sale' | 'block_space' | 'hard_block'
  effectiveFrom: string
  effectiveUntil: string | null
  status: 'active' | 'pending' | 'suspended' | 'terminated'
  brandColor: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface CodeshareMappingRef {
  _id: string
  agreementId: string
  operatingFlightNumber: string
  marketingFlightNumber: string
  departureIata: string
  arrivalIata: string
  daysOfOperation: string
  effectiveFrom: string
  effectiveUntil: string | null
  seatAllocation: number | null
  agreedAircraftType: string | null
  status: 'active' | 'pending' | 'cancelled'
  createdAt: string
}

export interface CodeshareSeatAllocationRef {
  _id: string
  mappingId: string
  cabinCode: string
  allocatedSeats: number
  releaseHours: number
  createdAt: string
}

export interface CodeshareAgreementStats {
  mappedFlights: number
  routeCount: number
  weeklySeats: number
}

export interface CodeshareOperatingFlightRef {
  _id: string
  flightNumber: string
  depStation: string
  arrStation: string
  daysOfWeek: string
  aircraftTypeIcao: string | null
  effectiveFrom: string
  effectiveUntil: string
}

// ─── User types ──────────────────────────────────────────

export interface UserProfile {
  firstName: string
  lastName: string
  email: string
  phone: string
  officePhone: string
  dateOfBirth: string
  gender: string
  department: string
  employeeId: string
  avatarUrl: string
  location: string
}

export interface UserSecurity {
  twoFactorEnabled: boolean
  biometricEnabled: boolean
  lastPasswordChange: string
  sessions: Array<{
    device: string
    browser: string
    location: string
    lastActive: string
    isCurrent: boolean
  }>
}

export interface UserPreferences {
  language: string
  timezone: string
  dateFormat: string
  timeFormat: string
  units: string
  numberFormat: string
}

export interface UserNotifications {
  pushEnabled: boolean
  emailEnabled: boolean
  inAppEnabled: boolean
  emailDigest: string
  quietHoursStart: string
  quietHoursEnd: string
  categories: {
    flightUpdates: boolean
    crewChanges: boolean
    systemAlerts: boolean
    maintenance: boolean
    reports: boolean
  }
}

export interface UserDisplay {
  textScale: string
  contrast: number
  brightness: number
  accentColor: string
  dynamicBackground: boolean
  backgroundPreset: string
  colorMode: string
}

export interface UserData {
  _id: string
  operatorId: string
  profile: UserProfile
  security: UserSecurity
  preferences: UserPreferences
  notifications: UserNotifications
  display: UserDisplay
  role: string
  isActive: boolean
  lastLoginUtc: string
  createdAt: string
  updatedAt: string
}

export interface UserListItem {
  _id: string
  operatorId: string
  role: string
  isActive: boolean
  firstName: string
  lastName: string
  email: string
  avatarUrl: string
  department: string
}

// ─── Slot types ──────────────────────────────────────────

export interface SlotCoordinatedAirport {
  iataCode: string
  name: string
  coordinationLevel: 1 | 2 | 3
  slotsPerHourDay: number | null
  slotsPerHourNight: number | null
  coordinatorName: string | null
  coordinatorEmail: string | null
}

export interface SlotSeriesRef {
  _id: string
  operatorId: string
  airportIata: string
  seasonCode: string
  arrivalFlightNumber: string | null
  departureFlightNumber: string | null
  arrivalOriginIata: string | null
  departureDestIata: string | null
  requestedArrivalTime: number | null
  requestedDepartureTime: number | null
  allocatedArrivalTime: number | null
  allocatedDepartureTime: number | null
  overnightIndicator: number
  periodStart: string
  periodEnd: string
  daysOfOperation: string
  frequencyRate: number
  seats: number | null
  aircraftTypeIcao: string | null
  arrivalServiceType: string | null
  departureServiceType: string | null
  status: string
  priorityCategory: string
  historicEligible: boolean
  lastActionCode: string | null
  lastCoordinatorCode: string | null
  flexibilityArrival: string | null
  flexibilityDeparture: string | null
  minTurnaroundMinutes: number | null
  coordinatorRef: string | null
  coordinatorReasonArrival: string | null
  coordinatorReasonDeparture: string | null
  waitlistPosition: number | null
  linkedScheduledFlightId: string | null
  notes: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface SlotDateRef {
  _id: string
  seriesId: string
  slotDate: string
  operationStatus: string
  jnusReason: string | null
  jnusEvidence: string | null
  actualArrivalTime: number | null
  actualDepartureTime: number | null
  createdAt: string | null
}

export interface SlotMessageRef {
  _id: string
  operatorId: string
  direction: string
  messageType: string
  airportIata: string
  seasonCode: string
  rawText: string
  parseStatus: string
  parseErrors: Array<{ line: number; message: string }> | null
  parsedSeriesCount: number
  source: string | null
  reference: string | null
  createdAt: string | null
}

export interface SlotActionLogRef {
  _id: string
  seriesId: string
  actionCode: string
  actionSource: string
  messageId: string | null
  details: Record<string, unknown> | null
  createdAt: string | null
}

export interface SlotPortfolioStats {
  totalSeries: number
  confirmed: number
  offered: number
  waitlisted: number
  refused: number
  atRisk80: number
}

export interface SlotUtilizationSummary {
  seriesId: string
  totalDates: number
  operated: number
  cancelled: number
  jnus: number
  noShow: number
  scheduled: number
  utilizationPct: number
  isAtRisk: boolean
  isClose: boolean
}

export interface SlotCalendarWeekRef {
  weekNumber: number
  operated: number
  cancelled: number
  jnus: number
  total: number
}

export interface ScheduledFlightForSlot {
  id: string
  airlineCode: string
  flightNumber: string
  depStation: string
  arrStation: string
  stdUtc: string
  staUtc: string
  daysOfOperation: string
  periodStart: string
  periodEnd: string
  aircraftTypeIcao: string | null
  status: string
  direction: 'arrival' | 'departure'
}

export interface SlotFleetAirportStats {
  airportIata: string
  totalSeries: number
  confirmed: number
  offered: number
  waitlisted: number
  refused: number
  draft: number
  submitted: number
  totalDates: number
  operated: number
  jnus: number
  cancelled: number
  utilizationPct: number
}

// ─── Charter types ──────────────────────────────────────

export interface CharterContractRef {
  _id: string
  operatorId: string
  contractNumber: string
  contractType: 'passenger' | 'cargo' | 'government' | 'acmi' | 'humanitarian' | 'hajj' | 'sports' | 'other'
  clientName: string
  clientContactName: string | null
  clientContactEmail: string | null
  clientContactPhone: string | null
  aircraftTypeIcao: string | null
  aircraftRegistration: string | null
  paxCapacity: number | null
  ratePerSector: number | null
  ratePerBlockHour: number | null
  currency: string
  fuelSurchargeIncluded: boolean
  catering: 'operator' | 'client' | 'none'
  cancelPenalty14d: number
  cancelPenalty7d: number
  cancelPenalty48h: number
  contractStart: string
  contractEnd: string | null
  status: 'draft' | 'proposed' | 'confirmed' | 'operating' | 'completed' | 'cancelled'
  seasonId: string | null
  notes: string | null
  internalNotes: string | null
  createdAt: string
  updatedAt: string
}

export interface CharterFlightRef {
  _id: string
  operatorId: string
  contractId: string
  flightNumber: string
  flightDate: string
  departureIata: string
  arrivalIata: string
  stdUtc: string
  staUtc: string
  blockMinutes: number
  arrivalDayOffset: number
  aircraftTypeIcao: string | null
  aircraftRegistration: string | null
  legType: 'revenue' | 'positioning' | 'technical'
  paxBooked: number
  cargoKg: number
  status: 'planned' | 'confirmed' | 'assigned' | 'operated' | 'cancelled'
  scheduledFlightId: string | null
  crewNotes: string | null
  slotRequested: boolean
  slotStatus: string | null
  createdAt: string
}

export interface CharterContractStats {
  totalFlights: number
  revenueFlights: number
  positioningFlights: number
  totalBlockMinutes: number
  estimatedRevenue: number
  paxTotal: number
}

export interface CharterPositioningLeg {
  from: string
  to: string
  date: string
  before?: string
}

// ─── Schedule Message Types ──────────────────────────────

export interface ScheduleMessageRef {
  _id: string
  operatorId: string
  messageType: 'ASM' | 'SSM'
  actionCode: string
  direction: 'inbound' | 'outbound'
  status: 'held' | 'pending' | 'sent' | 'applied' | 'rejected' | 'discarded' | 'neutralized'
  flightNumber: string | null
  flightDate: string | null
  depStation: string | null
  arrStation: string | null
  seasonCode: string | null
  summary: string | null
  rawMessage: string | null
  changes: Record<string, { from?: string; to: string }> | null
  rejectReason: string | null
  processedAtUtc: string | null
  createdAtUtc: string
  updatedAtUtc: string
}

export interface ScheduleMessageQuery {
  operatorId: string
  direction?: 'inbound' | 'outbound'
  actionCodes?: string[]
  messageTypes?: string[]
  status?: string
  flightNumber?: string
  flightDateFrom?: string
  flightDateTo?: string
  search?: string
  limit?: number
  offset?: number
}

export interface ScheduleMessageStats {
  total: number
  held: number
  pending: number
  sent: number
  applied: number
  rejected: number
  thisWeek: number
}

// ─── Movement Messages ─────────────────────────────────────

export interface Ahm732Triple {
  process: string
  reason: string
  stakeholder: string
}

export interface MovementMessageDelayRef {
  code: string | null
  alphaCode: string | null
  ahm732Process: string | null
  ahm732Reason: string | null
  ahm732Stakeholder: string | null
  duration: string | null
  minutes: number | null
  reasonText: string | null
  category: string | null
}

export interface MovementMessageRef {
  _id: string
  operatorId: string
  messageType: 'MVT' | 'LDM'
  actionCode: string
  direction: 'inbound' | 'outbound'
  status: 'held' | 'pending' | 'sent' | 'applied' | 'rejected' | 'discarded' | 'failed'
  flightNumber: string | null
  flightDate: string | null
  registration: string | null
  depStation: string | null
  arrStation: string | null
  summary: string | null
  rawMessage: string | null
  delayStandard: 'ahm730' | 'ahm732' | null
  delayCodes: MovementMessageDelayRef[]
  envelope: {
    priority: string | null
    addresses: string[]
    originator: string | null
    timestamp: string | null
  } | null
  recipients: string[]
  parsed: unknown
  appliedToFlight: {
    atdUtc: number | null
    offUtc: number | null
    onUtc: number | null
    ataUtc: number | null
    etdUtc: number | null
    etaUtc: number | null
    delaysAppended: number
  } | null
  scenarioId: string | null
  flightInstanceId: string | null
  externalMessageId: string | null
  errorReason: string | null
  createdBy: string | null
  createdByName: string | null
  releasedBy: string | null
  releasedByName: string | null
  releasedAtUtc: string | null
  discardedBy: string | null
  discardedByName: string | null
  discardedAtUtc: string | null
  supersedesMessageId: string | null
  supersededByMessageId: string | null
  createdAtUtc: string
  updatedAtUtc: string
  sentAtUtc: string | null
  appliedAtUtc: string | null
}

export interface MovementMessageQuery {
  operatorId: string
  direction?: 'inbound' | 'outbound'
  actionCodes?: string[]
  messageTypes?: string[]
  stations?: string[]
  status?: string
  flightNumber?: string
  flightInstanceId?: string
  flightDateFrom?: string
  flightDateTo?: string
  limit?: number
  offset?: number
}

export interface MovementMessageStats {
  total: number
  held: number
  pending: number
  sent: number
  applied: number
  rejected: number
  discarded: number
  failed: number
}

/** Per-feed OCC Dashboard health, returned by GET /feed-status. */
export type FeedState = 'online' | 'stale' | 'offline' | 'unconfigured'

export interface HeartbeatFeedStatus {
  state: FeedState
  lastHeartbeatAtUtc: string | null
  source: string | null
  expectedIntervalSec: number
}

export interface WxFeedStatus {
  state: 'online' | 'stale' | 'offline'
  lastPollAtUtc: string | null
  pollIntervalMin: number
}

export interface FeedStatus {
  acars: HeartbeatFeedStatus
  mvt: HeartbeatFeedStatus
  asmSsm: HeartbeatFeedStatus
  wx: WxFeedStatus
  computedAtUtc: string
}

export interface MvtEtaInput {
  time: string
  destination: string
}

export interface MvtDelayInput {
  code: string
  duration?: string
  ahm732?: Ahm732Triple
}

export interface CreateMovementMessageInput {
  flightInstanceId: string
  actionCode: 'AD' | 'AA' | 'ED' | 'EA' | 'NI' | 'RR' | 'FR'
  offBlocks?: string
  airborne?: string
  touchdown?: string
  onBlocks?: string
  estimatedDeparture?: string
  nextInfoTime?: string
  returnTime?: string
  etas?: MvtEtaInput[]
  delays?: MvtDelayInput[]
  passengers?: { total: number; noSeatHolders?: number; sectors?: number[] }
  supplementaryInfo?: string[]
  recipients?: string[]
  envelope?: {
    priority?: string
    addresses?: string[]
    originator?: string
    timestamp?: string
  }
  correction?: boolean
  /**
   * If set, supersede the specified held message: the target is marked
   * `discarded` with `supersededByMessageId` pointing at the new message.
   * Server 409s if the target isn't held or doesn't match.
   */
  replaceExistingId?: string
  /** Bypass the duplicate-held check entirely and create anyway. */
  allowDuplicate?: boolean
}

/**
 * Structured 409 returned when a held MVT already exists for the same
 * `(flightInstanceId, actionCode)`. The caller inspects `existing`
 * and decides: retry with `replaceExistingId`, retry with `allowDuplicate`,
 * or cancel the compose.
 */
export interface DuplicateHeldExisting {
  _id: string
  actionCode: string
  flightNumber: string | null
  flightDate: string | null
  summary: string | null
  createdAtUtc: string
  createdBy: string | null
  createdByName: string | null
}

export type CreateMovementMessageResult =
  | { ok: true; message: MovementMessageRef }
  | { ok: false; conflict: DuplicateHeldExisting }

export interface ParseInboundResult {
  type: 'MVT' | 'LDM' | 'UNKNOWN'
  parsed?: unknown
  error?: string
  candidateFlights: Array<{
    _id: string
    flightNumber: string
    operatingDate: string
    dep: { icao: string | null; iata: string | null }
    arr: { icao: string | null; iata: string | null }
  }>
}

export interface ApplyInboundResult {
  message: MovementMessageRef
  delta: {
    set: Record<string, number | null>
    pushDelays: Array<{ code: string; minutes: number; reason: string; category: string }>
    summary: string
    delaysAppended: number
  }
}

export interface ScheduleMessageSnapshot {
  id: string
  flightNumber: string
  instanceDate: string
  depStation: string
  arrStation: string
  stdUtc: string
  staUtc: string
  aircraftTypeIcao: string
  status: string
}

// ─── Crew Profile Types (4.1.1) ───────────────────────────

export interface CrewListFilters {
  base?: string
  position?: string
  status?: string
  aircraftType?: string
  search?: string
  groupId?: string
}

export interface CrewMemberRef {
  _id: string
  operatorId: string
  employeeId: string
  firstName: string
  middleName: string | null
  lastName: string
  shortCode: string | null
  gender: 'male' | 'female' | 'other' | null
  dateOfBirth: string | null
  nationality: string | null
  base: string | null
  position: string | null
  status: 'active' | 'inactive' | 'suspended' | 'terminated'
  employmentDate: string | null
  exitDate: string | null
  exitReason: string | null
  contractType: string | null
  seniority: number | null
  seniorityGroup: number
  languages: string[]
  apisAlias: string | null
  countryOfResidence: string | null
  residencePermitNo: string | null
  emailPrimary: string | null
  emailSecondary: string | null
  addressLine1: string | null
  addressLine2: string | null
  addressCity: string | null
  addressState: string | null
  addressZip: string | null
  addressCountry: string | null
  emergencyName: string | null
  emergencyRelationship: string | null
  emergencyPhone: string | null
  noAccommodationAirports: string[]
  transportRequired: boolean
  hotelAtHomeBase: boolean
  travelTimeMinutes: number | null
  payrollNumber: string | null
  minGuarantee: string | null
  flyWithSeniorUntil: string | null
  doNotScheduleAltPosition: string | null
  standbyExempted: boolean
  crewUnderTraining: boolean
  noDomesticFlights: boolean
  noInternationalFlights: boolean
  maxLayoverStops: number | null
  photoUrl: string | null
  /** Per-crew publish-visibility flag. When false, the crew member's
   *  rostered duties are hidden in the mobile app (planner hasn't
   *  committed yet). Toggled from 4.1.6 Crew Schedule → right-click
   *  crew name → "Toggle published schedule". */
  isScheduleVisible: boolean
  /** Free-text HR notes, read-only in Crew Schedule's extra-info dialog. */
  hrNotes: string | null
  createdAt: string
  updatedAt: string
}

export interface PairingScheduleChangeLegRef {
  flightId: string
  flightDate: string
  flightNumber: string
  depStation: string
  arrStation: string
  legOrder: number
  pairingStdUtcIso: string
  pairingStaUtcIso: string
  currentStdUtcMs: number | null
  currentStaUtcMs: number | null
  stdDeltaMin: number | null
  staDeltaMin: number | null
  hasChange: boolean
  lastChangedAtMs: number | null
  instanceMissing: boolean
}

export interface PairingScheduleChangesRef {
  pairingId: string
  pairingCode: string
  pairingCommittedAt: string
  changes: PairingScheduleChangeLegRef[]
}

export interface CrewMemberCreate {
  employeeId: string
  firstName: string
  lastName: string
  middleName?: string | null
  shortCode?: string | null
  gender?: 'male' | 'female' | 'other' | null
  dateOfBirth?: string | null
  nationality?: string | null
  base?: string | null
  position?: string | null
  status?: 'active' | 'inactive' | 'suspended' | 'terminated'
  employmentDate?: string | null
}

export interface CrewMemberListItemRef extends CrewMemberRef {
  acTypes: string[]
  expiryAlertCount: number
  baseLabel: string | null
  /** Flat qualification rows: each aircraft-type rating the crew holds
   *  plus the AC FAMILY toggle from their profile. Populated only by the
   *  crew-schedule aggregator (not the generic /crew list). Drives the
   *  client-side AC-type hard-block check at assignment time. */
  qualifications?: Array<{ aircraftType: string; acFamilyQualified: boolean }>
}

export interface CrewPhoneRef {
  _id: string
  operatorId: string
  crewId: string
  priority: number
  type: string
  number: string
  smsEnabled: boolean
}
export type CrewPhoneInput = Omit<CrewPhoneRef, '_id' | 'operatorId' | 'crewId'>

export interface CrewPassportRef {
  _id: string
  operatorId: string
  crewId: string
  number: string
  country: string
  nationality: string | null
  placeOfIssue: string | null
  issueDate: string | null
  expiry: string
  isActive: boolean
}
export type CrewPassportInput = Omit<CrewPassportRef, '_id' | 'operatorId' | 'crewId'>

export interface CrewLicenseRef {
  _id: string
  operatorId: string
  crewId: string
  number: string
  type: string
  country: string | null
  placeOfIssue: string | null
  issueDate: string | null
  temporary: boolean
}
export type CrewLicenseInput = Omit<CrewLicenseRef, '_id' | 'operatorId' | 'crewId'>

export interface CrewVisaRef {
  _id: string
  operatorId: string
  crewId: string
  country: string
  type: string | null
  number: string | null
  issueDate: string | null
  expiry: string
}
export type CrewVisaInput = Omit<CrewVisaRef, '_id' | 'operatorId' | 'crewId'>

export interface CrewQualificationRef {
  _id: string
  operatorId: string
  crewId: string
  base: string | null
  aircraftType: string
  position: string
  startDate: string
  endDate: string | null
  isPrimary: boolean
  acFamilyQualified: boolean
  trainingQuals: string[]
}
export type CrewQualificationInput = Omit<CrewQualificationRef, '_id' | 'operatorId' | 'crewId'>

export interface CrewExpiryDateRef {
  _id: string
  operatorId: string
  crewId: string
  expiryCodeId: string
  aircraftType: string
  lastDone: string | null
  baseMonth: string | null
  expiryDate: string | null
  nextPlanned: string | null
  notes: string | null
  isManualOverride: boolean
}
export interface CrewExpiryDateFullRef extends CrewExpiryDateRef {
  codeLabel: string
  codeName: string
  categoryKey: string
  categoryLabel: string
  categoryColor: string
  status: 'valid' | 'warning' | 'expired' | 'unknown'
}
export interface CrewExpiryDateUpdate {
  expiryDate?: string | null
  lastDone?: string | null
  baseMonth?: string | null
  nextPlanned?: string | null
  notes?: string | null
}

export interface CrewGroupAssignmentRef {
  _id: string
  operatorId: string
  crewId: string
  groupId: string
  startDate: string | null
  endDate: string | null
}
export interface CrewGroupAssignmentFullRef extends CrewGroupAssignmentRef {
  groupName: string
}
export type CrewGroupAssignmentInput = Omit<CrewGroupAssignmentRef, '_id' | 'operatorId' | 'crewId'>

export interface CrewBlockHoursRef {
  _id: string
  operatorId: string
  crewId: string
  aircraftType: string
  position: string
  blockHours: string | null
  trainingHours: string | null
  firstFlight: string | null
  lastFlight: string | null
}
export type CrewBlockHoursInput = Omit<CrewBlockHoursRef, '_id' | 'operatorId' | 'crewId'>

export interface CrewOnOffPatternRef {
  _id: string
  operatorId: string
  crewId: string
  patternType: string
  startDate: string
  endDate: string | null
  startingDay: number
}
export type CrewOnOffPatternInput = Omit<CrewOnOffPatternRef, '_id' | 'operatorId' | 'crewId'>

export interface CrewAirportRestrictionRef {
  _id: string
  operatorId: string
  crewId: string
  airport: string
  type: 'RESTRICTED' | 'PREFERRED'
  startDate: string | null
  endDate: string | null
}
export type CrewAirportRestrictionInput = Omit<CrewAirportRestrictionRef, '_id' | 'operatorId' | 'crewId'>

export interface CrewPairingRef {
  _id: string
  operatorId: string
  crewId: string
  type: 'Same' | 'Not same'
  what: 'Flights' | 'Offs'
  pairedCrewId: string
  startDate: string | null
  endDate: string | null
}
export interface CrewPairingFullRef extends CrewPairingRef {
  pairedCrewName: string
}
export type CrewPairingInput = Omit<CrewPairingRef, '_id' | 'operatorId' | 'crewId'>

export interface CrewRulesetRef {
  _id: string
  operatorId: string
  crewId: string
  name: string
  startDate: string
  endDate: string | null
}
export type CrewRulesetInput = Omit<CrewRulesetRef, '_id' | 'operatorId' | 'crewId'>

export interface FullCrewProfileRef {
  member: CrewMemberRef
  baseLabel: string | null
  phones: CrewPhoneRef[]
  passports: CrewPassportRef[]
  licenses: CrewLicenseRef[]
  visas: CrewVisaRef[]
  qualifications: CrewQualificationRef[]
  expiryDates: CrewExpiryDateFullRef[]
  groupAssignments: CrewGroupAssignmentFullRef[]
  rulesets: CrewRulesetRef[]
  onOffPatterns: CrewOnOffPatternRef[]
  airportRestrictions: CrewAirportRestrictionRef[]
  pairings: CrewPairingFullRef[]
  blockHours: CrewBlockHoursRef[]
}

// ─── Crew Documents Types (4.1.2) ─────────────────────────

export interface CrewDocumentFolderRef {
  _id: string
  operatorId: string
  parentId: string | null
  name: string
  slug: string
  isSystem: boolean
  sortOrder: number
  createdAt: string | null
  updatedAt: string | null
}

export interface CrewDocumentFolderWithCountsRef extends CrewDocumentFolderRef {
  documentCount: number
  subfolderCount: number
  /** True when this entry is a virtual sub-folder synthesised from an
   *  ExpiryCode (e.g. *CRM Training* under Training Documents). */
  isVirtual: boolean
  /** Only set on virtual sub-folders — matches `ExpiryCode._id`. */
  expiryCodeId?: string
  /** Only set on virtual sub-folders — the ExpiryCodeCategory key. */
  expiryCategoryKey?: string | null
}

export interface CrewDocumentRef {
  _id: string
  operatorId: string
  crewId: string
  folderId: string
  expiryCodeId: string | null
  documentType: 'photo' | 'passport' | 'license' | 'medical' | 'training' | 'other'
  fileName: string
  storagePath: string
  fileUrl: string // relative `/uploads/...` path; prefix with getApiBaseUrl() to render
  fileSize: number
  mimeType: string | null
  description: string | null
  uploadedAt: string
  uploadedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CrewDocumentUploadResult {
  document: CrewDocumentRef
  updatedExpiry: {
    _id: string
    operatorId: string
    crewId: string
    expiryCodeId: string
    aircraftType: string
    lastDone: string | null
    expiryDate: string | null
    baseMonth: string | null
    nextPlanned: string | null
    notes: string | null
    isManualOverride: boolean
  } | null
}

export type CrewDocumentStatusKey =
  | 'missing_photo'
  | 'missing_passport'
  | 'missing_medical'
  | 'missing_training'
  | 'complete'

export interface CrewDocumentStatusFilters {
  base?: string
  position?: string
  status?: string
  groupId?: string
  /** Multi-select — server applies OR-semantics across selected keys. */
  documentStatus?: CrewDocumentStatusKey[]
  /** ISO YYYY-MM-DD. Narrows the list to crew whose *soonest training
   *  expiry* falls in the given inclusive range. */
  expiryFrom?: string
  expiryTo?: string
  search?: string
}

export interface CrewDocumentStatusRef {
  _id: string
  employeeId: string
  firstName: string
  middleName: string | null
  lastName: string
  position: string | null // crew position CODE (e.g. 'CP')
  status: 'active' | 'inactive' | 'suspended' | 'terminated'
  photoUrl: string | null
  baseLabel: string | null
  hasPhoto: boolean
  hasPassport: boolean
  hasMedical: boolean
  hasTraining: boolean
  coverage: number // 0..100
  /** ISO YYYY-MM-DD of the soonest training-code expiry the crew is
   *  approaching or has missed. null when no training expiry rows exist. */
  soonestTrainingExpiry: string | null
  expiredTrainingCount: number
  warningTrainingCount: number
}

// ─── Manpower Planning Types (4.1.4) ──────────────────────

export interface ManpowerPlanRef {
  _id: string
  operatorId: string
  name: string
  color: string
  isBasePlan: boolean
  sortOrder: number
  year: number
  createdAt: string
  updatedAt: string
}

export interface ManpowerPlanSettingsRef {
  _id: string
  planId: string
  operatorId: string
  wetLeaseActive: boolean
  naOtherIsDrain: boolean
  updatedAt: string
}

export interface ManpowerPositionSettingsRef {
  _id: string
  planId: string
  positionId: string
  operatorId: string
  bhTarget: number
  naSick: number
  naAnnual: number
  naTraining: number
  naMaternity: number
  naAttrition: number
  naOther: number
  updatedAt: string
}

export interface ManpowerFleetOverrideRef {
  _id: string
  planId: string
  operatorId: string
  aircraftTypeIcao: string
  monthIndex: number
  planYear: number
  acCount: number
  createdAt: string
  updatedAt: string
}

export interface ManpowerFleetUtilizationRef {
  _id: string
  planId: string
  operatorId: string
  aircraftTypeIcao: string
  dailyUtilizationHours: number
  updatedAt: string
}

export type ManpowerEventType = 'AOC' | 'CUG' | 'CCQ' | 'ACMI' | 'DRY' | 'DOWNSIZE' | 'RESIGN' | 'DELIVERY'

export interface ManpowerEventRef {
  _id: string
  planId: string
  operatorId: string
  eventType: ManpowerEventType
  monthIndex: number
  planYear: number
  count: number
  fleetIcao: string | null
  positionName: string | null
  leadMonths: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

// ─── 4.1.5 Crew Pairing ────────────────────────────────────

export interface PairingFlightRef {
  /** Compound: `${scheduledFlightId}__${instanceDate}` */
  id: string
  scheduledFlightId: string
  instanceDate: string
  flightNumber: string
  departureAirport: string
  arrivalAirport: string
  std: string
  sta: string
  stdUtc: string
  staUtc: string
  blockMinutes: number
  aircraftType: string
  tailNumber: string | null
  rotationId: string | null
  rotationLabel: string | null
  serviceType: string | null
  daysOfWeek: string | null
  departureDayOffset: number
  arrivalDayOffset: number
  status: string
  /** Schedule-level effectivity — inherited from the underlying ScheduledFlight. */
  effectiveFrom: string
  effectiveUntil: string
  pairingId: string | null
}

export interface PairingLegRef {
  flightId: string
  flightDate: string
  legOrder: number
  isDeadhead: boolean
  dutyDay: number
  depStation: string
  arrStation: string
  flightNumber: string
  stdUtcIso: string
  staUtcIso: string
  blockMinutes: number
  aircraftTypeIcao: string | null
  /** Registration the leg was operated by at save time. */
  tailNumber?: string | null
}

export type PairingLegalityStatus = 'legal' | 'warning' | 'violation'
export type PairingWorkflowStatus = 'draft' | 'committed'

export interface PairingRef {
  _id: string
  operatorId: string
  scenarioId: string | null
  seasonCode: string | null
  pairingCode: string
  baseAirport: string
  baseId: string | null
  aircraftTypeIcao: string | null
  aircraftTypeId: string | null
  fdtlStatus: PairingLegalityStatus
  workflowStatus: PairingWorkflowStatus
  totalBlockMinutes: number
  totalDutyMinutes: number
  pairingDays: number
  startDate: string
  endDate: string
  reportTime: string | null
  releaseTime: string | null
  numberOfDuties: number
  numberOfSectors: number
  layoverAirports: string[]
  complementKey: string
  cockpitCount: number
  facilityClass: string | null
  crewCounts: Record<string, number> | null
  legs: PairingLegRef[]
  lastLegalityResult: unknown | null
  routeChain: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface PairingCreateInput {
  pairingCode: string
  baseAirport: string
  baseId?: string | null
  scenarioId?: string | null
  seasonCode?: string | null
  aircraftTypeIcao?: string | null
  aircraftTypeId?: string | null
  complementKey?: string
  cockpitCount?: number
  facilityClass?: string | null
  crewCounts?: Record<string, number> | null
  reportTime?: string | null
  releaseTime?: string | null
  workflowStatus?: PairingWorkflowStatus
  fdtlStatus?: PairingLegalityStatus
  lastLegalityResult?: unknown | null
  legs: PairingLegRef[]
}

export type PairingUpdateInput = Partial<Omit<PairingCreateInput, 'legs'>> & { legs?: PairingLegRef[] }

export interface PairingContextRef {
  bases: Array<{ _id: string; iata: string | null; icao: string; name: string }>
  aircraftTypes: Array<{ _id: string; icaoType: string; iataType: string | null }>
}

/** FDTL rule set assembled by `GET /fdtl/rule-set`. Shape matches
 *  `@skyhub/logic/src/fdtl/engine-types.ts:SerializedRuleSet` — kept local
 *  so `@skyhub/api` doesn't depend on `@skyhub/logic`. */
export interface SerializedRuleSetRef {
  operatorId: string
  frameworkCode: string
  frameworkName: string
  defaultReportMinutes: number
  defaultDebriefMinutes: number
  reportingTimes: Array<{ key: string; minutes: number }>
  fdpTable: {
    tableCode: string
    rowKeys: string[]
    rowLabels: string[]
    colKeys: string[]
    colLabels: string[]
    cells: Array<{ key: string; minutes: number }>
  } | null
  rules: Array<{
    code: string
    value: string
    valueType: string
    unit: string
    directionality: string | null
    label: string
    legalReference: string | null
  }>
  augmentedLimits: Array<{
    crewCount: number
    facilityClass: string
    facilityLabel: string
    maxFdpMinutes: number
    legalReference: string | null
  }>
  cabinRestTable: {
    rowKeys: string[]
    rowLabels: string[]
    colKeys: string[]
    colLabels: string[]
    cells: Array<{ key: string; minutes: number }>
  } | null
  cruiseTimeDeductions: {
    taxiOutMinutes: number
    taxiInMinutes: number
    climbMinutes: number
    descentMinutes: number
  }
}
