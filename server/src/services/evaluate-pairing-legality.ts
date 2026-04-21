import { validatePairingClient } from '@skyhub/logic/src/fdtl/validator'
import { loadSerializedRuleSet } from './fdtl-rule-set.js'

export interface PairingLegForLegality {
  flightId: string
  isDeadhead?: boolean
  depStation: string
  arrStation: string
  stdUtcIso: string
  staUtcIso: string
  blockMinutes: number
  aircraftTypeIcao?: string | null
}

export interface PairingForLegality {
  baseAirport: string
  complementKey?: string | null
  cockpitCount?: number | null
  facilityClass?: string | null
  legs: PairingLegForLegality[]
}

/**
 * Run the operator's FDTL engine over a pairing and return a LegalityResult
 * plus the summary `fdtlStatus` badge — same shape the client stores on
 * `Pairing.lastLegalityResult` after a manual save.
 *
 * `ruleSet` is accepted to avoid re-loading per call in bulk paths. Pass
 * `null` to skip evaluation (e.g. operator without an FDTL scheme).
 */
export function evaluatePairingLegality(
  pairing: PairingForLegality,
  ruleSet: unknown | null,
): { result: unknown; status: 'legal' | 'warning' | 'violation' } | null {
  if (!ruleSet || pairing.legs.length === 0) return null

  const flights = pairing.legs.map((l) => ({
    id: l.flightId,
    departureAirport: l.depStation,
    arrivalAirport: l.arrStation,
    aircraftType: l.aircraftTypeIcao ?? '',
    std: l.stdUtcIso,
    sta: l.staUtcIso,
    stdUtc: l.stdUtcIso,
    staUtc: l.staUtcIso,
    blockMinutes: l.blockMinutes,
  }))

  const deadheadIds = new Set<string>()
  for (const l of pairing.legs) if (l.isDeadhead) deadheadIds.add(l.flightId)

  const complementKey =
    pairing.complementKey === 'aug1' || pairing.complementKey === 'aug2' || pairing.complementKey === 'custom'
      ? pairing.complementKey
      : 'standard'
  const crewConfig = pairing.facilityClass
    ? {
        complementKey,
        cockpitCount: pairing.cockpitCount ?? 2,
        facilityClass: pairing.facilityClass,
      }
    : undefined

  const raw = validatePairingClient(
    ruleSet as Parameters<typeof validatePairingClient>[0],
    flights,
    deadheadIds,
    pairing.baseAirport,
    crewConfig,
  )

  const status: 'legal' | 'warning' | 'violation' =
    raw.overallStatus === 'violation' ? 'violation' : raw.overallStatus === 'warning' ? 'warning' : 'legal'

  return { result: raw, status }
}

/** Convenience for single-shot callers: loads rule set and runs engine. */
export async function evaluatePairingLegalityFor(
  operatorId: string,
  pairing: PairingForLegality,
): Promise<{ result: unknown; status: 'legal' | 'warning' | 'violation' } | null> {
  const ruleSet = await loadSerializedRuleSet(operatorId)
  return evaluatePairingLegality(pairing, ruleSet)
}
