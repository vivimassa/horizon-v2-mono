/**
 * Sky Hub — API Client
 * Platform-agnostic. Base URL is injected by the consuming app.
 */

let _baseUrl = 'http://localhost:3002'

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
    throw new Error(`API ${res.status}: ${body}`)
  }

  return res.json()
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
  actual: { atdUtc: number | null; ataUtc: number | null }
  tail: { registration: string | null; icaoType: string | null }
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

  // ─── Movement Messages (MVT/LDM) ─────────────────────────

  getMovementMessages: (params: MovementMessageQuery) => {
    const p = new URLSearchParams({ operatorId: params.operatorId })
    if (params.direction) p.set('direction', params.direction)
    if (params.actionCodes) p.set('actionCodes', params.actionCodes.join(','))
    if (params.status) p.set('status', params.status)
    if (params.flightNumber) p.set('flightNumber', params.flightNumber)
    if (params.flightDateFrom) p.set('flightDateFrom', params.flightDateFrom)
    if (params.flightDateTo) p.set('flightDateTo', params.flightDateTo)
    if (params.limit) p.set('limit', String(params.limit))
    if (params.offset) p.set('offset', String(params.offset))
    return request<{ messages: MovementMessageRef[]; total: number }>(`/movement-messages?${p.toString()}`)
  },

  getMovementMessageStats: (operatorId: string) =>
    request<MovementMessageStats>(`/movement-messages/stats?operatorId=${operatorId}`),

  getHeldMovementMessages: (operatorId: string) =>
    request<{ messages: MovementMessageRef[] }>(`/movement-messages/held?operatorId=${operatorId}`),

  releaseMovementMessages: (messageIds: string[]) =>
    request<{ released: number }>('/movement-messages/release', {
      method: 'POST',
      body: JSON.stringify({ messageIds }),
    }),

  discardMovementMessages: (messageIds: string[]) =>
    request<{ discarded: number }>('/movement-messages/discard', {
      method: 'POST',
      body: JSON.stringify({ messageIds }),
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

export interface MovementMessageRef {
  _id: string
  operatorId: string
  messageType: 'MVT' | 'LDM'
  actionCode: string
  direction: 'inbound' | 'outbound'
  status: 'held' | 'pending' | 'sent' | 'applied' | 'rejected' | 'discarded'
  flightNumber: string | null
  flightDate: string | null
  registration: string | null
  depStation: string | null
  arrStation: string | null
  summary: string | null
  rawMessage: string | null
  scenarioId: string | null
  flightInstanceId: string | null
  createdAtUtc: string
  updatedAtUtc: string
}

export interface MovementMessageQuery {
  operatorId: string
  direction?: 'inbound' | 'outbound'
  actionCodes?: string[]
  status?: string
  flightNumber?: string
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
