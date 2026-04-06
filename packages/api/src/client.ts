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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...init?.headers as Record<string, string> }
  if (init?.body) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${_baseUrl}${path}`, {
    ...init,
    headers,
  })

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
  hasCurfew: boolean
  curfewStart: string | null
  curfewEnd: string | null
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
  formula: string
  acTypeScope: 'none' | 'family' | 'variant'
  warningDays: number | null
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
  isActive: boolean
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

export const api = {
  // Flights
  getFlights: (operatorId = 'horizon', from?: string, to?: string) => {
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

  lookupAirport: (icao: string) =>
    request<AirportLookupResult>(`/airports/lookup?icao=${encodeURIComponent(icao)}`),

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

  getAircraftTypes: (operatorId = 'horizon') =>
    request<AircraftTypeRef[]>(`/aircraft-types?operatorId=${operatorId}`),

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
  getAircraftRegistrations: (operatorId = 'horizon') =>
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
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${_baseUrl}/aircraft-registrations/${id}/image`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
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

  createCityPair: (data: { station1Icao: string; station2Icao: string; standardBlockMinutes?: number; notes?: string }) =>
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

  // ─── Activity Code Groups ────────────────────────────────
  getActivityCodeGroups: (operatorId = 'horizon') =>
    request<ActivityCodeGroupRef[]>(`/activity-code-groups?operatorId=${operatorId}`),

  createActivityCodeGroup: (data: Partial<ActivityCodeGroupRef>) =>
    request<ActivityCodeGroupRef>('/activity-code-groups', { method: 'POST', body: JSON.stringify(data) }),

  updateActivityCodeGroup: (id: string, data: Partial<ActivityCodeGroupRef>) =>
    request<ActivityCodeGroupRef>(`/activity-code-groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteActivityCodeGroup: (id: string) =>
    request<{ success: boolean }>(`/activity-code-groups/${id}`, { method: 'DELETE' }),

  // ─── Activity Codes ────────────────────────────────────
  getActivityCodes: (operatorId = 'horizon') =>
    request<ActivityCodeRef[]>(`/activity-codes?operatorId=${operatorId}`),

  createActivityCode: (data: Partial<ActivityCodeRef>) =>
    request<ActivityCodeRef>('/activity-codes', { method: 'POST', body: JSON.stringify(data) }),

  updateActivityCode: (id: string, data: Partial<ActivityCodeRef>) =>
    request<ActivityCodeRef>(`/activity-codes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  updateActivityCodeFlags: (id: string, flags: string[]) =>
    request<ActivityCodeRef>(`/activity-codes/${id}/flags`, { method: 'PATCH', body: JSON.stringify({ flags }) }),

  updateActivityCodePositions: (id: string, positions: string[]) =>
    request<ActivityCodeRef>(`/activity-codes/${id}/positions`, { method: 'PATCH', body: JSON.stringify({ applicablePositions: positions }) }),

  deleteActivityCode: (id: string) =>
    request<{ success: boolean }>(`/activity-codes/${id}`, { method: 'DELETE' }),

  seedActivityCodeDefaults: (operatorId = 'horizon') =>
    request<{ success: boolean; groupCount: number; codeCount: number }>('/activity-codes/seed-defaults', {
      method: 'POST',
      body: JSON.stringify({ operatorId }),
    }),

  getDelayCodes: (operatorId = 'horizon') =>
    request<DelayCodeRef[]>(`/delay-codes?operatorId=${operatorId}`),

  createDelayCode: (data: Partial<DelayCodeRef>) =>
    request<DelayCodeRef>('/delay-codes', { method: 'POST', body: JSON.stringify(data) }),

  updateDelayCode: (id: string, data: Partial<DelayCodeRef>) =>
    request<DelayCodeRef>(`/delay-codes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteDelayCode: (id: string) =>
    request<{ success: boolean }>(`/delay-codes/${id}`, { method: 'DELETE' }),

  getCrewPositions: (operatorId = 'horizon', includeInactive = false) => {
    let path = `/crew-positions?operatorId=${operatorId}`
    if (includeInactive) path += '&includeInactive=true'
    return request<CrewPositionRef[]>(path)
  },

  createCrewPosition: (data: Partial<CrewPositionRef>) =>
    request<CrewPositionRef>('/crew-positions', { method: 'POST', body: JSON.stringify(data) }),

  updateCrewPosition: (id: string, data: Partial<CrewPositionRef>) =>
    request<CrewPositionRef>(`/crew-positions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteCrewPosition: (id: string) =>
    request<{ success: boolean }>(`/crew-positions/${id}`, { method: 'DELETE' }),

  getCrewPositionReferences: (id: string) =>
    request<CrewPositionReferences>(`/crew-positions/${id}/references`),

  seedCrewPositions: (operatorId = 'horizon') =>
    request<{ success: boolean }>('/crew-positions/seed-defaults', {
      method: 'POST',
      body: JSON.stringify({ operatorId }),
    }),

  // ─── Crew Complements ──────────────────────────────────
  getCrewComplements: (operatorId = 'horizon', aircraftTypeIcao?: string) => {
    let path = `/crew-complements?operatorId=${operatorId}`
    if (aircraftTypeIcao) path += `&aircraftTypeIcao=${encodeURIComponent(aircraftTypeIcao)}`
    return request<CrewComplementRef[]>(path)
  },

  createCrewComplement: (data: Partial<CrewComplementRef>) =>
    request<CrewComplementRef>('/crew-complements', { method: 'POST', body: JSON.stringify(data) }),

  updateCrewComplement: (id: string, data: Partial<CrewComplementRef>) =>
    request<CrewComplementRef>(`/crew-complements/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteCrewComplement: (id: string) =>
    request<{ success: boolean }>(`/crew-complements/${id}`, { method: 'DELETE' }),

  seedCrewComplementDefaults: (operatorId = 'horizon', aircraftTypeIcao?: string) =>
    request<{ success: boolean; count: number }>('/crew-complements/seed-defaults', {
      method: 'POST',
      body: JSON.stringify({ operatorId, aircraftTypeIcao }),
    }),

  deleteCrewComplementsByType: (operatorId: string, icaoType: string) =>
    request<{ success: boolean }>(`/crew-complements/by-type/${encodeURIComponent(icaoType)}?operatorId=${operatorId}`, {
      method: 'DELETE',
    }),

  // ─── Crew Groups ─────────────────────────────────────────
  getCrewGroups: (operatorId = 'horizon', includeInactive = false) => {
    let path = `/crew-groups?operatorId=${operatorId}`
    if (includeInactive) path += '&includeInactive=true'
    return request<CrewGroupRef[]>(path)
  },

  createCrewGroup: (data: Partial<CrewGroupRef>) =>
    request<CrewGroupRef>('/crew-groups', { method: 'POST', body: JSON.stringify(data) }),

  updateCrewGroup: (id: string, data: Partial<CrewGroupRef>) =>
    request<CrewGroupRef>(`/crew-groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteCrewGroup: (id: string) =>
    request<{ success: boolean }>(`/crew-groups/${id}`, { method: 'DELETE' }),

  seedCrewGroups: (operatorId = 'horizon') =>
    request<{ success: boolean; count: number }>('/crew-groups/seed-defaults', {
      method: 'POST',
      body: JSON.stringify({ operatorId }),
    }),

  // ─── Duty Patterns ──────────────────────────────────────
  getDutyPatterns: (operatorId = 'horizon') =>
    request<DutyPatternRef[]>(`/duty-patterns?operatorId=${operatorId}`),

  createDutyPattern: (data: Partial<DutyPatternRef>) =>
    request<DutyPatternRef>('/duty-patterns', { method: 'POST', body: JSON.stringify(data) }),

  updateDutyPattern: (id: string, data: Partial<DutyPatternRef>) =>
    request<DutyPatternRef>(`/duty-patterns/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteDutyPattern: (id: string) =>
    request<{ success: boolean }>(`/duty-patterns/${id}`, { method: 'DELETE' }),

  seedDutyPatterns: (operatorId = 'horizon') =>
    request<{ success: boolean; count: number }>('/duty-patterns/seed-defaults', {
      method: 'POST',
      body: JSON.stringify({ operatorId }),
    }),

  // ─── MPP Lead Times ─────────────────────────────────────
  getMppLeadTimeGroups: (operatorId = 'horizon') =>
    request<MppLeadTimeGroupRef[]>(`/mpp-lead-time-groups?operatorId=${operatorId}`),

  createMppLeadTimeGroup: (data: Partial<MppLeadTimeGroupRef>) =>
    request<MppLeadTimeGroupRef>('/mpp-lead-time-groups', { method: 'POST', body: JSON.stringify(data) }),

  updateMppLeadTimeGroup: (id: string, data: Partial<MppLeadTimeGroupRef>) =>
    request<MppLeadTimeGroupRef>(`/mpp-lead-time-groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteMppLeadTimeGroup: (id: string) =>
    request<{ success: boolean }>(`/mpp-lead-time-groups/${id}`, { method: 'DELETE' }),

  getMppLeadTimeItems: (operatorId = 'horizon', groupId?: string) => {
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

  seedMppLeadTimeDefaults: (operatorId = 'horizon') =>
    request<{ success: boolean; groupCount: number; itemCount: number }>('/mpp-lead-times/seed-defaults', {
      method: 'POST',
      body: JSON.stringify({ operatorId }),
    }),

  // ─── Scheduled Flights ──────────────────────────────────
  getScheduledFlights: (params: { operatorId?: string; seasonCode?: string; scenarioId?: string; status?: string; sortBy?: string; sortDir?: string } = {}) => {
    const p = new URLSearchParams()
    if (params.operatorId) p.set('operatorId', params.operatorId)
    if (params.seasonCode) p.set('seasonCode', params.seasonCode)
    if (params.scenarioId) p.set('scenarioId', params.scenarioId)
    if (params.status) p.set('status', params.status)
    if (params.sortBy) p.set('sortBy', params.sortBy)
    if (params.sortDir) p.set('sortDir', params.sortDir)
    return request<ScheduledFlightRef[]>(`/scheduled-flights?${p.toString()}`)
  },

  getScheduledFlight: (id: string) =>
    request<ScheduledFlightRef>(`/scheduled-flights/${id}`),

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

  // ─── FDTL ───────────────────────────────────────────────
  getFdtlFrameworks: () =>
    request<FdtlFrameworkRef[]>('/fdtl/frameworks'),

  getFdtlTabGroups: () =>
    request<FdtlTabGroup[]>('/fdtl/tab-groups'),

  getFdtlScheme: (operatorId = 'horizon') =>
    request<FdtlSchemeRef>(`/fdtl/schemes/${operatorId}`),

  createFdtlScheme: (data: Partial<FdtlSchemeRef>) =>
    request<FdtlSchemeRef>('/fdtl/schemes', { method: 'POST', body: JSON.stringify(data) }),

  updateFdtlScheme: (id: string, data: Partial<FdtlSchemeRef>) =>
    request<FdtlSchemeRef>(`/fdtl/schemes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getFdtlRules: (operatorId = 'horizon', frameworkCode?: string, tabKey?: string) => {
    let path = `/fdtl/rules?operatorId=${operatorId}`
    if (frameworkCode) path += `&frameworkCode=${frameworkCode}`
    if (tabKey) path += `&tabKey=${tabKey}`
    return request<FdtlRuleRef[]>(path)
  },

  updateFdtlRule: (id: string, data: Partial<FdtlRuleRef>) =>
    request<FdtlRuleRef>(`/fdtl/rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  resetFdtlRule: (id: string) =>
    request<FdtlRuleRef>(`/fdtl/rules/${id}/reset`, { method: 'POST' }),

  getFdtlTables: (operatorId = 'horizon', frameworkCode?: string, tabKey?: string) => {
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

  resetFdtlTable: (tableId: string) =>
    request<FdtlTableRef>(`/fdtl/tables/${tableId}/reset`, { method: 'POST' }),

  seedFdtl: (operatorId = 'horizon', frameworkCode: string) =>
    request<{ success: boolean; frameworkCode: string; rulesSeeded: number; tablesSeeded: number }>('/fdtl/seed', {
      method: 'POST',
      body: JSON.stringify({ operatorId, frameworkCode }),
    }),

  getExpiryCodeCategories: (operatorId = 'horizon') =>
    request<ExpiryCodeCategoryRef[]>(`/expiry-code-categories?operatorId=${operatorId}`),

  getExpiryCodes: (operatorId = 'horizon') =>
    request<ExpiryCodeRef[]>(`/expiry-codes?operatorId=${operatorId}`),

  getFlightServiceTypes: (operatorId = 'horizon') =>
    request<FlightServiceTypeRef[]>(`/flight-service-types?operatorId=${operatorId}`),

  createFlightServiceType: (data: Partial<FlightServiceTypeRef>) =>
    request<FlightServiceTypeRef>('/flight-service-types', { method: 'POST', body: JSON.stringify(data) }),

  updateFlightServiceType: (id: string, data: Partial<FlightServiceTypeRef>) =>
    request<FlightServiceTypeRef>(`/flight-service-types/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteFlightServiceType: (id: string) =>
    request<{ success: boolean }>(`/flight-service-types/${id}`, { method: 'DELETE' }),

  getOperators: () => request<OperatorRef[]>('/operators'),

  getOperator: (id: string) => request<OperatorRef>(`/operators/${id}`),

  updateOperator: (id: string, data: Partial<OperatorRef>) =>
    request<OperatorRef>(`/operators/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getReferenceStats: () => request<ReferenceStats>('/reference/stats'),

  // ─── Cabin Classes ──────────────────────────────────────
  getCabinClasses: (operatorId = 'horizon') =>
    request<CabinClassRef[]>(`/cabin-classes?operatorId=${operatorId}`),

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
  getLopaConfigs: (operatorId = 'horizon', aircraftType?: string) => {
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
  getMe: (userId = 'skyhub-admin-001') =>
    request<UserData>(`/users/me?userId=${userId}`),

  updateProfile: (data: Partial<UserProfile>, userId = 'skyhub-admin-001') =>
    request<{ success: boolean; profile: UserProfile }>(`/users/me/profile?userId=${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateSecurity: (data: Record<string, any>, userId = 'skyhub-admin-001') =>
    request<{ success: boolean; security: UserSecurity }>(`/users/me/security?userId=${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updatePreferences: (data: Partial<UserPreferences>, userId = 'skyhub-admin-001') =>
    request<{ success: boolean; preferences: UserPreferences }>(`/users/me/preferences?userId=${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateNotifications: (data: Record<string, any>, userId = 'skyhub-admin-001') =>
    request<{ success: boolean; notifications: UserNotifications }>(`/users/me/notifications?userId=${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateDisplay: (data: Record<string, any>, userId = 'skyhub-admin-001') =>
    request<{ success: boolean; display: UserDisplay }>(`/users/me/display?userId=${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  revokeSession: (index: number, userId = 'skyhub-admin-001') =>
    request<{ success: boolean }>(`/users/me/sessions/${index}?userId=${userId}`, {
      method: 'DELETE',
    }),
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
