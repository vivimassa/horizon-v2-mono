/**
 * Central query key factory for React Query.
 *
 * Every hook in hooks.ts should pull its queryKey from here so that
 * invalidations after mutations can reliably refresh related caches.
 *
 * Convention: top-level keys are lowercase plural nouns matching the
 * api.xxx() method names.
 */

export const queryKeys = {
  // ─── User / auth ───
  me: ['me'] as const,

  // ─── Reference data (rare changes, long staleTime) ───
  airports: {
    all: ['airports'] as const,
    list: (params?: Record<string, unknown>) => ['airports', 'list', params ?? {}] as const,
    detail: (id: string) => ['airports', 'detail', id] as const,
  },
  aircraftTypes: {
    all: ['aircraftTypes'] as const,
    list: (operatorId?: string) => ['aircraftTypes', 'list', operatorId ?? ''] as const,
    detail: (id: string) => ['aircraftTypes', 'detail', id] as const,
  },
  aircraftRegistrations: {
    all: ['aircraftRegistrations'] as const,
    list: (operatorId?: string) => ['aircraftRegistrations', 'list', operatorId ?? ''] as const,
    detail: (id: string) => ['aircraftRegistrations', 'detail', id] as const,
  },
  countries: {
    all: ['countries'] as const,
    list: (params?: Record<string, unknown>) => ['countries', 'list', params ?? {}] as const,
    detail: (id: string) => ['countries', 'detail', id] as const,
  },
  cityPairs: {
    all: ['cityPairs'] as const,
    list: (operatorId?: string) => ['cityPairs', 'list', operatorId ?? ''] as const,
    detail: (id: string) => ['cityPairs', 'detail', id] as const,
  },
  delayCodes: {
    all: ['delayCodes'] as const,
    list: (operatorId?: string) => ['delayCodes', 'list', operatorId ?? ''] as const,
  },
  activityCodes: {
    all: ['activityCodes'] as const,
    list: (operatorId?: string) => ['activityCodes', 'list', operatorId ?? ''] as const,
    groups: (operatorId?: string) => ['activityCodes', 'groups', operatorId ?? ''] as const,
  },
  crewPositions: {
    all: ['crewPositions'] as const,
    list: (operatorId?: string, includeInactive?: boolean) =>
      ['crewPositions', 'list', operatorId ?? '', includeInactive ?? false] as const,
  },
  crewGroups: {
    all: ['crewGroups'] as const,
    list: (operatorId?: string, includeInactive?: boolean) =>
      ['crewGroups', 'list', operatorId ?? '', includeInactive ?? false] as const,
  },
  crewComplements: {
    all: ['crewComplements'] as const,
    list: (operatorId?: string, aircraftTypeIcao?: string) =>
      ['crewComplements', 'list', operatorId ?? '', aircraftTypeIcao ?? ''] as const,
  },
  dutyPatterns: {
    all: ['dutyPatterns'] as const,
    list: (operatorId?: string) => ['dutyPatterns', 'list', operatorId ?? ''] as const,
  },
  carrierCodes: {
    all: ['carrierCodes'] as const,
    list: (operatorId?: string) => ['carrierCodes', 'list', operatorId ?? ''] as const,
  },
  operators: {
    all: ['operators'] as const,
    detail: (id: string) => ['operators', 'detail', id] as const,
  },
  cabinClasses: {
    all: ['cabinClasses'] as const,
    list: (operatorId?: string) => ['cabinClasses', 'list', operatorId ?? ''] as const,
  },
  lopaConfigs: {
    all: ['lopaConfigs'] as const,
    list: (operatorId?: string, aircraftType?: string) =>
      ['lopaConfigs', 'list', operatorId ?? '', aircraftType ?? ''] as const,
  },
  expiryCodes: {
    all: ['expiryCodes'] as const,
    list: (operatorId?: string) => ['expiryCodes', 'list', operatorId ?? ''] as const,
  },
  flightServiceTypes: {
    all: ['flightServiceTypes'] as const,
    list: (operatorId?: string) => ['flightServiceTypes', 'list', operatorId ?? ''] as const,
  },

  // ─── Operational data (changes often, short staleTime) ───
  flights: {
    all: ['flights'] as const,
    list: (operatorId?: string, from?: string, to?: string) =>
      ['flights', 'list', operatorId ?? '', from ?? '', to ?? ''] as const,
    detail: (id: string) => ['flights', 'detail', id] as const,
  },
  scheduledFlights: {
    all: ['scheduledFlights'] as const,
    list: (params?: Record<string, unknown>) => ['scheduledFlights', 'list', params ?? {}] as const,
  },
  scenarios: {
    all: ['scenarios'] as const,
    list: (operatorId?: string) => ['scenarios', 'list', operatorId ?? ''] as const,
    detail: (id: string) => ['scenarios', 'detail', id] as const,
    envelopes: (operatorId?: string) => ['scenarios', 'envelopes', operatorId ?? ''] as const,
  },

  // ─── FDTL ───
  fdtl: {
    frameworks: ['fdtl', 'frameworks'] as const,
    schemes: (operatorId?: string) => ['fdtl', 'schemes', operatorId ?? ''] as const,
    rules: (operatorId?: string) => ['fdtl', 'rules', operatorId ?? ''] as const,
    tables: (operatorId?: string) => ['fdtl', 'tables', operatorId ?? ''] as const,
  },

  // ─── Movement Messages ───
  movementMessages: {
    all: ['movementMessages'] as const,
    list: (params?: Record<string, unknown>) => ['movementMessages', 'list', params ?? {}] as const,
    detail: (id: string) => ['movementMessages', 'detail', id] as const,
    stats: (operatorId: string) => ['movementMessages', 'stats', operatorId] as const,
    held: (operatorId: string) => ['movementMessages', 'held', operatorId] as const,
    byFlight: (flightInstanceId: string) => ['movementMessages', 'byFlight', flightInstanceId] as const,
  },

  // ─── Maintenance ───
  maintenanceEvents: {
    all: ['maintenanceEvents'] as const,
    list: (params?: Record<string, unknown>) => ['maintenanceEvents', 'list', params ?? {}] as const,
  },

  // ─── Crew Profile (4.1.1) ───
  crew: {
    all: ['crew'] as const,
    list: (filters?: Record<string, unknown>) => ['crew', 'list', filters ?? {}] as const,
    detail: (id: string) => ['crew', 'detail', id] as const,
  },

  // ─── Crew Documents (4.1.2) ───
  crewDocuments: {
    all: ['crewDocuments'] as const,
    folders: (crewId: string, parentId: string | null | undefined) =>
      ['crewDocuments', 'folders', crewId, parentId ?? null] as const,
    list: (crewId: string, filters?: Record<string, unknown>) =>
      ['crewDocuments', 'list', crewId, filters ?? {}] as const,
    status: (filters?: Record<string, unknown>) => ['crewDocuments', 'status', filters ?? {}] as const,
  },

  // ─── Manpower Planning (4.1.4) ───
  manpower: {
    all: ['manpower'] as const,
    plans: (operatorId: string) => ['manpower', 'plans', operatorId] as const,
    settings: (planId: string) => ['manpower', 'settings', planId] as const,
    fleetOverrides: (planId: string, year: number) => ['manpower', 'fleetOverrides', planId, year] as const,
    fleetUtilization: (planId: string) => ['manpower', 'fleetUtilization', planId] as const,
    events: (planId: string, year: number) => ['manpower', 'events', planId, year] as const,
    scheduleBh: (planId: string, year: number) => ['manpower', 'scheduleBh', planId, year] as const,
    crewHeadcount: (planId: string, year: number) => ['manpower', 'crewHeadcount', planId, year] as const,
    monthlyAcCount: (planId: string, year: number) => ['manpower', 'monthlyAcCount', planId, year] as const,
    standardComplements: (planId: string) => ['manpower', 'standardComplements', planId] as const,
  },

  // ─── MPP Lead Time (5.4.9) ───
  mppLeadTime: {
    all: ['mppLeadTime'] as const,
    groups: (operatorId: string) => ['mppLeadTime', 'groups', operatorId] as const,
    items: (operatorId: string, groupId?: string) => ['mppLeadTime', 'items', operatorId, groupId ?? null] as const,
  },

  // ─── Slots ───
  slots: {
    airports: ['slots', 'airports'] as const,
    series: (operatorId: string, airportIata: string, seasonCode: string) =>
      ['slots', 'series', operatorId, airportIata, seasonCode] as const,
    stats: (operatorId: string, airportIata: string, seasonCode: string) =>
      ['slots', 'stats', operatorId, airportIata, seasonCode] as const,
  },

  // ─── 4.1.5 Crew Pairing ───
  pairings: {
    all: ['pairings'] as const,
    context: ['pairings', 'context'] as const,
    list: (params: { dateFrom?: string; dateTo?: string; scenarioId?: string | null; baseAirport?: string } = {}) =>
      ['pairings', 'list', params] as const,
    detail: (id: string) => ['pairings', 'detail', id] as const,
    flightPool: (params: { dateFrom: string; dateTo: string; scenarioId?: string | null; aircraftTypes?: string[] }) =>
      ['pairings', 'flight-pool', params] as const,
    ruleSet: ['pairings', 'fdtl-rule-set'] as const,
  },
} as const
