'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, queryKeys, type SerializedRuleSetRef } from '@skyhub/api'
import { validatePairingClient, type Flight, type CrewConfig } from '@skyhub/logic/src/fdtl/validator'
import type { PairingFlight, LegalityResult } from './types'
import { mockLegalityResult } from './mocks'

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

  return useMemo(() => {
    if (flights.length === 0) {
      return {
        result: { overallStatus: 'pass', checks: [] } as LegalityResult,
        usingMock: false,
        ruleSet: ruleSet ?? null,
      }
    }

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
      return {
        result: raw as unknown as LegalityResult,
        usingMock: false,
        ruleSet,
      }
    }

    // Fallback: no rule set loaded → use realistic mock so the UI still works.
    return {
      result: mockLegalityResult(flights),
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
  ])
}

function complementToCockpit(key: 'standard' | 'aug1' | 'aug2' | 'custom'): number {
  if (key === 'aug1') return 3
  if (key === 'aug2') return 4
  return 2
}
