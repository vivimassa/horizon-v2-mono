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
  createdAt: string | null
  updatedAt: string | null
}

export interface CrewPositionReferences {
  expiryCodes: number
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

  getDelayCodes: (operatorId = 'horizon') =>
    request<DelayCodeRef[]>(`/delay-codes?operatorId=${operatorId}`),

  createDelayCode: (data: Partial<DelayCodeRef>) =>
    request<DelayCodeRef>('/delay-codes', { method: 'POST', body: JSON.stringify(data) }),

  updateDelayCode: (id: string, data: Partial<DelayCodeRef>) =>
    request<DelayCodeRef>(`/delay-codes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteDelayCode: (id: string) =>
    request<{ success: boolean }>(`/delay-codes/${id}`, { method: 'DELETE' }),

  getCrewPositions: (operatorId = 'horizon', includeInactive = false) =>
    request<CrewPositionRef[]>(`/crew-positions?operatorId=${operatorId}${includeInactive ? '&includeInactive=true' : ''}`),

  createCrewPosition: (data: Partial<CrewPositionRef>) =>
    request<CrewPositionRef>('/crew-positions', { method: 'POST', body: JSON.stringify(data) }),

  seedCrewPositions: (operatorId: string) =>
    request<CrewPositionRef[]>('/crew-positions/seed', { method: 'POST', body: JSON.stringify({ operatorId }) }),

  updateCrewPosition: (id: string, data: Partial<CrewPositionRef>) =>
    request<CrewPositionRef>(`/crew-positions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteCrewPosition: (id: string) =>
    request<{ success: boolean }>(`/crew-positions/${id}`, { method: 'DELETE' }),

  getCrewPositionReferences: (id: string) =>
    request<CrewPositionReferences>(`/crew-positions/${id}/references`),

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
