import type { PairingFlight } from '@/components/crew-ops/pairing/types'

export interface CrossFamilyConflict {
  flightA: { flightNumber: string; aircraftTypeIcao: string }
  flightB: { flightNumber: string; aircraftTypeIcao: string }
}

export interface CrossFamilyResult {
  ok: boolean
  conflict: CrossFamilyConflict | null
}

/**
 * Pairing legs must share same aircraft family (e.g. A320+A321 OK, A350+A380 blocked).
 * Crew type ratings don't overlap across families; MFF checks happen at roster time.
 * Returns first offending pair for a precise error message.
 */
export function validateCrossFamily(
  flights: Array<Pick<PairingFlight, 'flightNumber' | 'aircraftType'>>,
  familyMap: Record<string, string | null>,
): CrossFamilyResult {
  if (flights.length < 2) return { ok: true, conflict: null }
  const first = flights[0]
  const firstFamily = familyMap[first.aircraftType] ?? null
  for (let i = 1; i < flights.length; i += 1) {
    const f = flights[i]
    const fam = familyMap[f.aircraftType] ?? null
    // Unknown family (either side) → skip; don't block on missing master data.
    if (firstFamily == null || fam == null) continue
    if (fam !== firstFamily) {
      return {
        ok: false,
        conflict: {
          flightA: { flightNumber: first.flightNumber, aircraftTypeIcao: first.aircraftType },
          flightB: { flightNumber: f.flightNumber, aircraftTypeIcao: f.aircraftType },
        },
      }
    }
  }
  return { ok: true, conflict: null }
}
