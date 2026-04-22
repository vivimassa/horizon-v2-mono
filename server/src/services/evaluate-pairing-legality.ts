import { validatePairingClient } from '@skyhub/logic/src/fdtl/validator'
import { toZonedTime, format as tzFormat } from 'date-fns-tz'
import { loadSerializedRuleSet } from './fdtl-rule-set.js'
import { Operator } from '../models/Operator.js'
import { Airport } from '../models/Airport.js'

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
  /** Per-airport IANA timezones keyed by IATA (or ICAO — caller's
   *  choice, must match `leg.depStation`). FDP band row lookup converts
   *  each leg's UTC STD using its departure airport's tz. Missing entry
   *  falls back to `timezone` below. */
  airportTimezones?: Record<string, string>
  /** Per-airport ISO country keyed the same way. Powers domestic /
   *  international classification for reporting-time overrides. */
  airportCountries?: Record<string, string>
  /** Operator-level tz fallback for FDP band when an airport entry is
   *  missing. For single-country operators this is sufficient. */
  timezone?: string
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

  // FDP band lookup uses LOCAL time (CAAV §15.025 row key e.g. "06:00-
  // 13:29"). Convert each leg's UTC using its *departure* airport's tz
  // so multi-country pairings slot into the right band per sector.
  // `stdUtc`/`staUtc` stay in UTC for duration math — tz-invariant.
  const fallbackTz = pairing.timezone ?? 'UTC'
  const tzByIata = pairing.airportTimezones ?? {}
  const toLocalIso = (utcIso: string, tz: string): string => {
    try {
      const local = toZonedTime(new Date(utcIso), tz)
      return tzFormat(local, "yyyy-MM-dd'T'HH:mm:ssXXX", { timeZone: tz })
    } catch {
      return utcIso
    }
  }
  const flights = pairing.legs.map((l) => {
    const depTz = tzByIata[l.depStation] ?? fallbackTz
    const arrTz = tzByIata[l.arrStation] ?? fallbackTz
    return {
      id: l.flightId,
      departureAirport: l.depStation,
      arrivalAirport: l.arrStation,
      aircraftType: l.aircraftTypeIcao ?? '',
      // std uses departure airport tz (band row key: "local FDP start").
      std: toLocalIso(l.stdUtcIso, depTz),
      // sta in arrival airport tz — used for display / debrief-local checks.
      sta: toLocalIso(l.staUtcIso, arrTz),
      stdUtc: l.stdUtcIso,
      staUtc: l.staUtcIso,
      blockMinutes: l.blockMinutes,
    }
  })

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
    undefined,
    undefined,
    pairing.airportCountries,
  )

  const status: 'legal' | 'warning' | 'violation' =
    raw.overallStatus === 'violation' ? 'violation' : raw.overallStatus === 'warning' ? 'warning' : 'legal'

  return { result: raw, status }
}

/** Convenience for single-shot callers: loads rule set + operator tz +
 *  per-airport tz/country maps, then runs engine. */
export async function evaluatePairingLegalityFor(
  operatorId: string,
  pairing: PairingForLegality,
): Promise<{ result: unknown; status: 'legal' | 'warning' | 'violation' } | null> {
  const iatas = new Set<string>()
  for (const l of pairing.legs) {
    if (l.depStation) iatas.add(l.depStation)
    if (l.arrStation) iatas.add(l.arrStation)
  }
  const [ruleSet, op, airports] = await Promise.all([
    loadSerializedRuleSet(operatorId),
    Operator.findById(operatorId).lean() as Promise<{ timezone?: string } | null>,
    iatas.size > 0
      ? (Airport.find(
          { $or: [{ iataCode: { $in: [...iatas] } }, { icaoCode: { $in: [...iatas] } }] },
          { iataCode: 1, icaoCode: 1, timezone: 1, country: 1 },
        ).lean() as Promise<
          Array<{ iataCode: string | null; icaoCode: string; timezone: string; country: string | null }>
        >)
      : Promise.resolve([]),
  ])
  const tz = pairing.timezone ?? op?.timezone ?? 'UTC'
  const tzMap: Record<string, string> = { ...(pairing.airportTimezones ?? {}) }
  const countryMap: Record<string, string> = { ...(pairing.airportCountries ?? {}) }
  for (const a of airports) {
    const keys = [a.iataCode, a.icaoCode].filter((x): x is string => !!x)
    for (const k of keys) {
      if (!tzMap[k] && a.timezone) tzMap[k] = a.timezone
      if (!countryMap[k] && a.country) countryMap[k] = a.country
    }
  }
  return evaluatePairingLegality(
    { ...pairing, timezone: tz, airportTimezones: tzMap, airportCountries: countryMap },
    ruleSet,
  )
}

/** Load per-airport tz + country maps in bulk — used by batch callers
 *  (pairings POST batch, crew-schedule aggregator) that already have
 *  the set of IATAs and want to avoid round-tripping per pairing. */
export async function loadAirportTzCountryMaps(
  iatas: Set<string>,
): Promise<{ tz: Record<string, string>; country: Record<string, string> }> {
  if (iatas.size === 0) return { tz: {}, country: {} }
  const airports = (await Airport.find(
    { $or: [{ iataCode: { $in: [...iatas] } }, { icaoCode: { $in: [...iatas] } }] },
    { iataCode: 1, icaoCode: 1, timezone: 1, country: 1 },
  ).lean()) as Array<{ iataCode: string | null; icaoCode: string; timezone: string; country: string | null }>
  const tz: Record<string, string> = {}
  const country: Record<string, string> = {}
  for (const a of airports) {
    const keys = [a.iataCode, a.icaoCode].filter((x): x is string => !!x)
    for (const k of keys) {
      if (a.timezone) tz[k] = a.timezone
      if (a.country) country[k] = a.country
    }
  }
  return { tz, country }
}
