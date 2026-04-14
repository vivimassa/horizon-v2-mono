/**
 * Thin client wrappers around the Fastify /ssim/parse + /ssim/import/*
 * endpoints built in server/src/routes/ssim-import.ts. Uses authedFetch
 * + getOperatorId so every call carries the right tenant + bearer token.
 *
 * Consumed by apps/web/src/stores/use-ssim-import-store.ts to drive the
 * 1.2.1 SSIM Import workspace.
 */

import { getApiBaseUrl } from '@skyhub/api'
import { authedFetch } from './authed-fetch'
import { getOperatorId } from '@/stores/use-operator-store'

export type SsimTimeMode = 'standard' | 'utc_only'
export type SsimRotationMode = 'single-leg' | 'combine-ofr'

export interface SsimCarrier {
  airlineCode: string
  seasonStart: string
  seasonEnd: string
  creationDate: string
  airlineName: string
  releaseCode: string
  creator: string
}

export interface SsimParsedFlight {
  airlineCode: string
  flightNumber: number
  suffix: string
  periodStart: string
  periodEnd: string
  daysOfOperation: string
  depStation: string
  arrStation: string
  stdLocal: string
  stdUtc: string
  staLocal: string
  staUtc: string
  depUtcOffset: string
  arrUtcOffset: string
  aircraftType: string
  serviceType: string
  seatConfig: Record<string, number>
  totalCapacity: number
  blockMinutes: number
  recordNumber: number
  nextAirlineCode: string | null
  nextFlightNumber: number | null
}

export interface SsimParseStats {
  totalRecords: number
  uniqueFlightNumbers: number
  uniqueRoutes: number
  dateRange: { start: string; end: string }
  aircraftTypes: string[]
  serviceTypes: Record<string, number>
  stations: string[]
  domesticRoutes: number
  internationalRoutes: number
  aircraftTypeCounts: Record<string, number>
}

export interface SsimValidation {
  airlineMatch: boolean
  recordCountOk: boolean
  missingAirports: string[]
  missingCityPairs: Array<{ dep: string; arr: string }>
  missingAircraftTypes: string[]
}

export interface SsimParseResponse {
  carrier: SsimCarrier | null
  flights: SsimParsedFlight[]
  stats: SsimParseStats
  errors: Array<{ line: number; message: string }>
  trailer: { airlineCode: string; lastFlightSerial: number; recordCount: number } | null
  validation: SsimValidation
}

/** Shape sent in the flights-batch body (adds clipped effective window). */
export type SsimBatchFlight = SsimParsedFlight & {
  effectiveFrom: string
  effectiveUntil: string
}

interface QueryParts {
  operatorId: string
  seasonCode: string
  scenarioId?: string | null
}

function queryString({ operatorId, seasonCode, scenarioId }: QueryParts): string {
  const qs = new URLSearchParams({ operatorId, seasonCode })
  if (scenarioId) qs.set('scenarioId', scenarioId)
  return qs.toString()
}

async function postJson<T>(path: string, body: unknown, q: QueryParts): Promise<T> {
  const url = `${getApiBaseUrl()}${path}?${queryString(q)}`
  const res = await authedFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const msg = (data as { error?: string }).error ?? `${res.status} ${res.statusText}`
    throw new Error(msg)
  }
  return (await res.json()) as T
}

export async function parseSsim(
  fileContent: string,
  timeMode: SsimTimeMode,
  seasonCode: string,
  scenarioId?: string | null,
): Promise<SsimParseResponse> {
  return postJson(
    '/ssim/parse',
    { fileContent, timeMode },
    {
      operatorId: getOperatorId(),
      seasonCode,
      scenarioId,
    },
  )
}

export async function createMissingAirports(
  codes: string[],
  seasonCode: string,
  scenarioId?: string | null,
): Promise<{ created: number; skipped: number }> {
  return postJson(
    '/ssim/import/airports',
    { codes },
    {
      operatorId: getOperatorId(),
      seasonCode,
      scenarioId,
    },
  )
}

export async function createMissingCityPairs(
  pairs: Array<{ dep: string; arr: string }>,
  seasonCode: string,
  scenarioId?: string | null,
): Promise<{ created: number; skipped: number }> {
  return postJson(
    '/ssim/import/city-pairs',
    { pairs },
    {
      operatorId: getOperatorId(),
      seasonCode,
      scenarioId,
    },
  )
}

export async function clearExistingFlights(
  dateFrom: string,
  dateTo: string,
  seasonCode: string,
  scenarioId?: string | null,
): Promise<{ deleted: number }> {
  return postJson(
    '/ssim/import/clear',
    { dateFrom, dateTo },
    {
      operatorId: getOperatorId(),
      seasonCode,
      scenarioId,
    },
  )
}

export async function importFlightsBatch(
  flights: SsimBatchFlight[],
  rotationMode: SsimRotationMode,
  batchNum: number,
  seasonCode: string,
  scenarioId?: string | null,
): Promise<{ created: number; errors: Array<{ lineNo: number; message: string }> }> {
  return postJson(
    '/ssim/import/flights-batch',
    { flights, rotationMode, batchNum },
    {
      operatorId: getOperatorId(),
      seasonCode,
      scenarioId,
    },
  )
}

export async function finalizeImport(seasonCode: string, scenarioId?: string | null): Promise<{ synced: number }> {
  return postJson(
    '/ssim/import/finalize',
    {},
    {
      operatorId: getOperatorId(),
      seasonCode,
      scenarioId,
    },
  )
}

export async function seedCityPairBlockTimes(
  seasonCode: string,
  scenarioId?: string | null,
): Promise<{ updated: number }> {
  return postJson(
    '/ssim/import/block-times',
    {},
    {
      operatorId: getOperatorId(),
      seasonCode,
      scenarioId,
    },
  )
}

/**
 * Intersect a SSIM leg's recurrence window with the user-selected import
 * period. Returns the clipped effective window or null when there's no
 * overlap. All strings are ISO YYYY-MM-DD.
 */
export function clipLegToPeriod(
  legFrom: string,
  legTo: string,
  userFrom: string,
  userTo: string,
): { effectiveFrom: string; effectiveUntil: string } | null {
  const from = legFrom > userFrom ? legFrom : userFrom
  const to = legTo < userTo ? legTo : userTo
  if (from > to) return null
  return { effectiveFrom: from, effectiveUntil: to }
}
