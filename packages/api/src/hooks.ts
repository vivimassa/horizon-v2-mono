/**
 * React Query hooks for the Sky Hub API.
 *
 * @tanstack/react-query is declared as a peerDependency on this package so
 * consumers (apps/mobile, apps/web) provide it at runtime.
 *
 * Stale-time conventions:
 * - Reference data (airports, aircraft types, etc.) — 5 min
 * - Operational data (flights, schedules, scenarios) — 30 sec
 * - User data (me) — 1 min
 *
 * Every mutation hook invalidates its owning `.all` key (and any detail key
 * for update/delete) so subsequent queries refetch.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { queryKeys } from './query-keys'
import type {
  AirportRef,
  AircraftTypeRef,
  AircraftRegistrationRef,
  CountryRef,
  DelayCodeRef,
  CityPairRef,
  CrewPositionRef,
  CrewGroupRef,
  DutyPatternRef,
  ActivityCodeRef,
  OperatorRef,
  UserData,
  ScheduledFlightRef,
  ScenarioRef,
  ScenarioEnvelopeRef,
  MovementMessageRef,
  MovementMessageQuery,
  MovementMessageStats,
  CreateMovementMessageInput,
  CreateMovementMessageResult,
  ParseInboundResult,
  ApplyInboundResult,
} from './client'

// ─── Stale time constants ───
const REFERENCE_STALE = 5 * 60 * 1000 // 5 min
const OPERATIONAL_STALE = 30 * 1000 // 30 sec
const USER_STALE = 60 * 1000 // 1 min

// ─── User / auth ───

export function useMe() {
  return useQuery<UserData>({
    queryKey: queryKeys.me,
    queryFn: () => api.getMe(),
    staleTime: USER_STALE,
  })
}

// ─── Reference data query hooks ───

export function useAirports(params?: Parameters<typeof api.getAirports>[0]) {
  return useQuery<AirportRef[]>({
    queryKey: queryKeys.airports.list(params),
    queryFn: () => api.getAirports(params),
    staleTime: REFERENCE_STALE,
  })
}

export function useAirport(id: string) {
  return useQuery<AirportRef>({
    queryKey: queryKeys.airports.detail(id),
    queryFn: () => api.getAirport(id),
    enabled: !!id,
    staleTime: REFERENCE_STALE,
  })
}

export function useAircraftTypes(operatorId = '') {
  return useQuery<AircraftTypeRef[]>({
    queryKey: queryKeys.aircraftTypes.list(operatorId),
    queryFn: () => api.getAircraftTypes(operatorId),
    staleTime: REFERENCE_STALE,
  })
}

export function useAircraftRegistrations(operatorId = '') {
  return useQuery<AircraftRegistrationRef[]>({
    queryKey: queryKeys.aircraftRegistrations.list(operatorId),
    queryFn: () => api.getAircraftRegistrations(operatorId),
    staleTime: REFERENCE_STALE,
  })
}

export function useCountries(params?: Parameters<typeof api.getCountries>[0]) {
  return useQuery<CountryRef[]>({
    queryKey: queryKeys.countries.list(params),
    queryFn: () => api.getCountries(params),
    staleTime: REFERENCE_STALE,
  })
}

export function useCityPairs(operatorId?: string) {
  return useQuery<CityPairRef[]>({
    queryKey: queryKeys.cityPairs.list(operatorId),
    queryFn: () => api.getCityPairs(operatorId),
    staleTime: REFERENCE_STALE,
  })
}

export function useDelayCodes(operatorId = '') {
  return useQuery<DelayCodeRef[]>({
    queryKey: queryKeys.delayCodes.list(operatorId),
    queryFn: () => api.getDelayCodes(operatorId),
    staleTime: REFERENCE_STALE,
  })
}

export function useActivityCodes(operatorId = '') {
  return useQuery<ActivityCodeRef[]>({
    queryKey: queryKeys.activityCodes.list(operatorId),
    queryFn: () => api.getActivityCodes(operatorId),
    staleTime: REFERENCE_STALE,
  })
}

export function useCrewPositions(operatorId = '', includeInactive = false) {
  return useQuery<CrewPositionRef[]>({
    queryKey: queryKeys.crewPositions.list(operatorId, includeInactive),
    queryFn: () => api.getCrewPositions(operatorId, includeInactive),
    staleTime: REFERENCE_STALE,
  })
}

export function useCrewGroups(operatorId = '', includeInactive = false) {
  return useQuery<CrewGroupRef[]>({
    queryKey: queryKeys.crewGroups.list(operatorId, includeInactive),
    queryFn: () => api.getCrewGroups(operatorId, includeInactive),
    staleTime: REFERENCE_STALE,
  })
}

export function useDutyPatterns(operatorId = '') {
  return useQuery<DutyPatternRef[]>({
    queryKey: queryKeys.dutyPatterns.list(operatorId),
    queryFn: () => api.getDutyPatterns(operatorId),
    staleTime: REFERENCE_STALE,
  })
}

export function useOperators() {
  return useQuery<OperatorRef[]>({
    queryKey: queryKeys.operators.all,
    queryFn: () => api.getOperators(),
    staleTime: REFERENCE_STALE,
  })
}

// ─── Operational data hooks ───

export function useScheduledFlights(params: Parameters<typeof api.getScheduledFlights>[0] = {}) {
  return useQuery<ScheduledFlightRef[]>({
    queryKey: queryKeys.scheduledFlights.list(params as Record<string, unknown>),
    queryFn: () => api.getScheduledFlights(params),
    staleTime: OPERATIONAL_STALE,
  })
}

export function useScenarios(params: Parameters<typeof api.getScenarios>[0] = {}) {
  return useQuery<ScenarioRef[]>({
    queryKey: queryKeys.scenarios.list((params as { operatorId?: string }).operatorId),
    queryFn: () => api.getScenarios(params),
    staleTime: OPERATIONAL_STALE,
  })
}

export function useScenarioEnvelopes(params: Parameters<typeof api.getScenarioEnvelopes>[0] = {}) {
  return useQuery<ScenarioEnvelopeRef[]>({
    queryKey: queryKeys.scenarios.envelopes(params.operatorId),
    queryFn: () => api.getScenarioEnvelopes(params),
    staleTime: OPERATIONAL_STALE,
  })
}

// ─── Mutation hooks ───

export function useCreateAirport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<AirportRef>) => api.createAirport(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.airports.all }),
  })
}

export function useUpdateAirport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AirportRef> }) => api.updateAirport(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.airports.all })
      qc.invalidateQueries({ queryKey: queryKeys.airports.detail(id) })
    },
  })
}

export function useDeleteAirport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteAirport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.airports.all }),
  })
}

export function useCreateAircraftType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<AircraftTypeRef>) => api.createAircraftType(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.aircraftTypes.all }),
  })
}

export function useUpdateAircraftType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AircraftTypeRef> }) => api.updateAircraftType(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.aircraftTypes.all })
      qc.invalidateQueries({ queryKey: queryKeys.aircraftTypes.detail(id) })
    },
  })
}

export function useDeleteAircraftType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteAircraftType(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.aircraftTypes.all }),
  })
}

// ─── Movement Messages ────────────────────────────────────

export function useMovementMessages(params: MovementMessageQuery) {
  return useQuery<{ messages: MovementMessageRef[]; total: number }>({
    queryKey: queryKeys.movementMessages.list(params as unknown as Record<string, unknown>),
    queryFn: () => api.getMovementMessages(params),
    enabled: !!params.operatorId,
    staleTime: OPERATIONAL_STALE,
  })
}

export function useMovementMessage(id: string) {
  return useQuery<{ message: MovementMessageRef }>({
    queryKey: queryKeys.movementMessages.detail(id),
    queryFn: () => api.getMovementMessage(id),
    enabled: !!id,
    staleTime: OPERATIONAL_STALE,
  })
}

export function useMovementMessageStats(
  operatorId: string,
  params?: { flightDateFrom?: string; flightDateTo?: string },
) {
  return useQuery<MovementMessageStats>({
    queryKey: [
      ...queryKeys.movementMessages.stats(operatorId),
      params?.flightDateFrom ?? '',
      params?.flightDateTo ?? '',
    ],
    queryFn: () => api.getMovementMessageStats(operatorId, params),
    enabled: Boolean(operatorId),
    staleTime: OPERATIONAL_STALE,
  })
}

export function useHeldMovementMessages(operatorId: string) {
  return useQuery<{ messages: MovementMessageRef[] }>({
    queryKey: queryKeys.movementMessages.held(operatorId),
    queryFn: () => api.getHeldMovementMessages(operatorId),
    enabled: !!operatorId,
    staleTime: OPERATIONAL_STALE,
  })
}

export function useMovementMessagesByFlight(operatorId: string, flightInstanceId: string) {
  return useQuery<{ messages: MovementMessageRef[]; total: number }>({
    queryKey: queryKeys.movementMessages.byFlight(flightInstanceId),
    queryFn: () => api.getMovementMessages({ operatorId, flightInstanceId, limit: 100 }),
    enabled: Boolean(operatorId) && Boolean(flightInstanceId),
    staleTime: OPERATIONAL_STALE,
  })
}

export function useCreateMovementMessage() {
  const qc = useQueryClient()
  return useMutation<CreateMovementMessageResult, Error, CreateMovementMessageInput>({
    mutationFn: (input) => api.createMovementMessage(input),
    onSuccess: (data) => {
      // Only invalidate on successful creation — a 409 conflict is a
      // productive interrupt, not a state change.
      if (!data.ok) return
      qc.invalidateQueries({ queryKey: queryKeys.movementMessages.all })
      if (data.message.flightInstanceId) {
        qc.invalidateQueries({
          queryKey: queryKeys.movementMessages.byFlight(data.message.flightInstanceId),
        })
      }
    },
  })
}

export function useReleaseMovementMessages() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (messageIds: string[]) => api.releaseMovementMessages(messageIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.movementMessages.all }),
  })
}

export function useDiscardMovementMessages() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (messageIds: string[]) => api.discardMovementMessages(messageIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.movementMessages.all }),
  })
}

export function useTransmitMovementMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.transmitMovementMessage(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.movementMessages.all })
      qc.invalidateQueries({ queryKey: queryKeys.movementMessages.detail(data.message._id) })
    },
  })
}

export function useParseInboundTelex() {
  return useMutation<ParseInboundResult, Error, string>({
    mutationFn: (rawMessage: string) => api.parseInboundTelex(rawMessage),
  })
}

export function useApplyInboundMvtMessage() {
  const qc = useQueryClient()
  return useMutation<ApplyInboundResult, Error, { rawMessage: string; flightInstanceId: string }>({
    mutationFn: (input) => api.applyInboundMvtMessage(input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.movementMessages.all })
      qc.invalidateQueries({ queryKey: queryKeys.flights.all })
      if (data.message.flightInstanceId) {
        qc.invalidateQueries({ queryKey: queryKeys.flights.detail(data.message.flightInstanceId) })
        qc.invalidateQueries({
          queryKey: queryKeys.movementMessages.byFlight(data.message.flightInstanceId),
        })
      }
    },
  })
}
