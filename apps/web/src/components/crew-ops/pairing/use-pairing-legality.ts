'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, queryKeys, type SerializedRuleSetRef } from '@skyhub/api'
import { validatePairingClient, type Flight, type CrewConfig } from '@skyhub/logic/src/fdtl/validator'
import { usePairingStore } from '@/stores/use-pairing-store'
import type { PairingFlight, LegalityResult, LegalityCheck } from './types'
import { mockLegalityResult } from './mocks'

/** Fallback thresholds mirror the server-side schema defaults in
 *  `OperatorPairingConfig`. Applied when the operator has no saved
 *  config yet, so the soft rule still fires with reasonable numbers
 *  instead of silently passing everything. */
const DEFAULT_AC_CHANGE_GROUND = {
  domToDomMin: 45,
  domToIntlMin: 60,
  intlToDomMin: 60,
  intlToIntlMin: 75,
} as const

/**
 * Loads the operator's FDTL rule set from `/fdtl/rule-set`. Cached for 5 min —
 * rules rarely change during a planning session. Returns `undefined` if no
 * scheme is configured (so callers can fall back to mock legality).
 */
export function useFdtlRuleSet() {
  return useQuery<SerializedRuleSetRef | null>({
    queryKey: queryKeys.pairings.ruleSet,
    queryFn: async () => {
      try {
        return await api.getFdtlRuleSet()
      } catch {
        return null
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Compute a `LegalityResult` for a selection of flights. Uses the operator's
 * real FDTL framework via `validatePairingClient` when a rule set is loaded;
 * otherwise falls back to the mock so the UI stays usable in dev / when no
 * FDTL scheme is configured.
 */
export function usePairingLegality(
  flights: PairingFlight[],
  options: {
    complementKey?: 'standard' | 'aug1' | 'aug2' | 'custom'
    facilityClass?: string
    cockpitCount?: number
    homeBase?: string
    deadheadIds?: Set<string>
  } = {},
): { result: LegalityResult; usingMock: boolean; ruleSet: SerializedRuleSetRef | null | undefined } {
  const { data: ruleSet, isSuccess } = useFdtlRuleSet()
  const pairingConfig = usePairingStore((s) => s.pairingConfig)
  const stationCountries = usePairingStore((s) => s.stationCountries)
  const homeCountryIso2 = usePairingStore((s) => s.homeCountryIso2)

  return useMemo(() => {
    if (flights.length === 0) {
      return {
        result: { overallStatus: 'pass', checks: [] } as LegalityResult,
        usingMock: false,
        ruleSet: ruleSet ?? null,
      }
    }

    const softChecks = evaluateAircraftChangeGroundTime(
      flights,
      pairingConfig?.aircraftChangeGroundTime ?? DEFAULT_AC_CHANGE_GROUND,
      stationCountries,
      homeCountryIso2,
    )

    // If the FDTL rule set is loaded, run the real engine.
    if (isSuccess && ruleSet) {
      const fdtlFlights: Flight[] = flights.map((f) => ({
        id: f.id,
        departureAirport: f.departureAirport,
        arrivalAirport: f.arrivalAirport,
        aircraftType: f.aircraftType,
        std: f.std,
        sta: f.sta,
        stdUtc: f.stdUtc,
        staUtc: f.staUtc,
        blockMinutes: f.blockMinutes,
      }))

      const crewConfig: CrewConfig | undefined =
        options.complementKey && options.facilityClass
          ? {
              complementKey: options.complementKey,
              cockpitCount: options.cockpitCount ?? complementToCockpit(options.complementKey),
              facilityClass: options.facilityClass,
            }
          : undefined

      const raw = validatePairingClient(
        ruleSet as Parameters<typeof validatePairingClient>[0],
        fdtlFlights,
        options.deadheadIds ?? new Set(),
        options.homeBase ?? flights[0]?.departureAirport ?? '',
        crewConfig,
      )

      // The validator's `LegalityResult` is a close match to our local type —
      // widen `status` to also allow 'info' (our type accepts it; validator
      // won't emit it today but we keep the surface compatible).
      const merged = mergeSoftChecks(raw as unknown as LegalityResult, softChecks)
      return {
        result: merged,
        usingMock: false,
        ruleSet,
      }
    }

    // Fallback: no rule set loaded → use realistic mock so the UI still works.
    return {
      result: mergeSoftChecks(mockLegalityResult(flights), softChecks),
      usingMock: true,
      ruleSet: ruleSet ?? null,
    }
  }, [
    flights,
    isSuccess,
    ruleSet,
    options.complementKey,
    options.facilityClass,
    options.cockpitCount,
    options.homeBase,
    options.deadheadIds,
    pairingConfig,
    stationCountries,
    homeCountryIso2,
  ])
}

/** Classify a leg as DOM or INTL. A leg is DOMESTIC when both endpoints sit
 *  in the same country as the operator's home base. If the home country isn't
 *  known, fall back to same-country-on-both-endpoints (still a useful
 *  heuristic, and matches how most planners reason). Returns null when
 *  either endpoint's country is unknown — caller skips the check. */
function classifyLeg(
  depCountry: string | undefined,
  arrCountry: string | undefined,
  home: string | null,
): 'dom' | 'intl' | null {
  if (!depCountry || !arrCountry) return null
  if (home) {
    return depCountry === home && arrCountry === home ? 'dom' : 'intl'
  }
  return depCountry === arrCountry ? 'dom' : 'intl'
}

function fmtHHMM(min: number): string {
  const m = Math.max(0, Math.floor(min))
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${h}:${String(mm).padStart(2, '0')}`
}

/** Evaluate the 4.1.5.4 aircraft-change ground-time soft rule across a
 *  chain of flights. Emits one `LegalityCheck` (status: 'warning') per
 *  consecutive leg pair where the tail changes AND the ground-time gap
 *  falls below the configured threshold for the relevant dom/intl combo.
 *  Returns an empty array when config is missing so callers merge a no-op. */
function evaluateAircraftChangeGroundTime(
  flights: PairingFlight[],
  config: {
    domToDomMin: number
    domToIntlMin: number
    intlToDomMin: number
    intlToIntlMin: number
  } | null,
  stationCountries: Record<string, string>,
  home: string | null,
): LegalityCheck[] {
  if (!config || flights.length < 2) return []
  const out: LegalityCheck[] = []
  for (let i = 0; i < flights.length - 1; i += 1) {
    const prev = flights[i]
    const next = flights[i + 1]
    // Only fires when the tail actually changes between legs. Missing tails
    // on either side skip the check — we can't tell an aircraft change from
    // a same-tail turn without the data.
    if (!prev.tailNumber || !next.tailNumber) continue
    if (prev.tailNumber === next.tailNumber) continue

    const gapMin = Math.max(0, Math.round((Date.parse(next.stdUtc) - Date.parse(prev.staUtc)) / 60000))
    const prevCls = classifyLeg(stationCountries[prev.departureAirport], stationCountries[prev.arrivalAirport], home)
    const nextCls = classifyLeg(stationCountries[next.departureAirport], stationCountries[next.arrivalAirport], home)
    if (!prevCls || !nextCls) continue

    const key: 'domToDomMin' | 'domToIntlMin' | 'intlToDomMin' | 'intlToIntlMin' =
      prevCls === 'dom' && nextCls === 'dom'
        ? 'domToDomMin'
        : prevCls === 'dom' && nextCls === 'intl'
          ? 'domToIntlMin'
          : prevCls === 'intl' && nextCls === 'dom'
            ? 'intlToDomMin'
            : 'intlToIntlMin'
    const limitMin = config[key]
    if (!Number.isFinite(limitMin) || limitMin <= 0) continue
    if (gapMin >= limitMin) continue

    const comboLabel =
      key === 'domToDomMin'
        ? 'DOM→DOM'
        : key === 'domToIntlMin'
          ? 'DOM→INTL'
          : key === 'intlToDomMin'
            ? 'INTL→DOM'
            : 'INTL→INTL'
    out.push({
      label: `Insufficient Ground Time (${fmtHHMM(gapMin)}/${fmtHHMM(limitMin)})`,
      actual: fmtHHMM(gapMin),
      limit: fmtHHMM(limitMin),
      status: 'warning',
      fdtlRef: `AC change · ${comboLabel} · ${prev.tailNumber} → ${next.tailNumber}`,
    })
  }
  return out
}

/** Append soft checks to an FDTL result without letting them escalate the
 *  overall status to 'violation'. A warning-only soft rule bumps `pass` up
 *  to `warning`; existing `violation` stays violation. */
function mergeSoftChecks(result: LegalityResult, soft: LegalityCheck[]): LegalityResult {
  if (soft.length === 0) return result
  const hasWarning = soft.some((c) => c.status === 'warning')
  const overallStatus: LegalityResult['overallStatus'] =
    result.overallStatus === 'violation' ? 'violation' : hasWarning ? 'warning' : result.overallStatus
  return {
    ...result,
    checks: [...result.checks, ...soft],
    overallStatus,
  }
}

function complementToCockpit(key: 'standard' | 'aug1' | 'aug2' | 'custom'): number {
  if (key === 'aug1') return 3
  if (key === 'aug2') return 4
  return 2
}
