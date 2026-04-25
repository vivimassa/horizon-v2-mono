import type { Pairing } from '@/components/crew-ops/pairing/types'
import type { CrewComplementRef } from '@skyhub/api'

export type CoverageState = 'uncovered' | 'fully' | 'under' | 'over' | 'mixed'

export interface FlightCoverage {
  state: CoverageState
  augmented: boolean
  /** Per-position required vs actual, useful for tooltips / inspector rows. */
  deltas: Array<{ code: string; required: number; actual: number; delta: number }>
}

interface Args {
  flightId: string
  aircraftTypeIcao: string | null
  pairings: Pairing[]
  complementMaster: CrewComplementRef[]
  /** If provided, only these position codes contribute to under/over deltas. null = all positions. */
  positionFilter?: string[] | null
  /** Server-resolved pairing id for this flight — used as a last-resort match
   *  when `flightIds` lookup fails (leg-id format drift between code paths). */
  pairingIdHint?: string | null
}

const AUG_RANK: Record<string, number> = { aug2: 2, aug1: 1 }

/**
 * Compute crew-coverage state of a single flight against required complement,
 * summing all pairings that include the flight as a non-deadhead leg.
 */
export function computeFlightCoverage({
  flightId,
  aircraftTypeIcao,
  pairings,
  complementMaster,
  positionFilter,
  pairingIdHint,
}: Args): FlightCoverage {
  const filterSetPre = positionFilter && positionFilter.length > 0 ? new Set(positionFilter) : null
  const matchesFlight = (p: Pairing): boolean => {
    if (p.flightIds.includes(flightId)) return true
    // Trust the server-resolved pairing id when provided — avoids the
    // recurring-flight collision that a bare scheduled-flight-id prefix
    // fallback would cause (same SH## on different dates = different legs).
    if (pairingIdHint && p.id === pairingIdHint) return true
    return false
  }
  const isDeadhead = (p: Pairing): boolean => p.deadheadFlightIds.includes(flightId)
  const icaoEarly = aircraftTypeIcao ?? ''
  const findTemplateEarly = (key: string): Record<string, number> | null => {
    const doc = complementMaster.find(
      (c) => c.aircraftTypeIcao === icaoEarly && c.templateKey === key && c.isActive !== false,
    )
    return doc ? (doc.counts as Record<string, number>) : null
  }
  const covering = pairings.filter((p) => {
    if (!matchesFlight(p) || isDeadhead(p)) return false
    if (!filterSetPre) return true
    // When filtering by position(s), only pairings that carry ≥1 selected
    // position count as covering this flight for that planner's view.
    // Pairings often omit `crewCounts` and rely on their complement template
    // (e.g. Standard 2-cockpit) — fall back to that template so a CP filter
    // doesn't drop pairings that would carry CP via the template.
    const counts = p.crewCounts ?? findTemplateEarly(p.complementKey) ?? {}
    return [...filterSetPre].some((code) => (counts[code] ?? 0) > 0)
  })
  if (covering.length === 0) return { state: 'uncovered', augmented: false, deltas: [] }

  // Asterisk glyph — shown only for Aug1 / Aug2 complements, not Custom.
  const augmented = covering.some((p) => p.complementKey === 'aug1' || p.complementKey === 'aug2')

  const icao = aircraftTypeIcao ?? ''
  const findTemplate = (key: string): Record<string, number> | null => {
    const doc = complementMaster.find(
      (c) => c.aircraftTypeIcao === icao && c.templateKey === key && c.isActive !== false,
    )
    return doc ? (doc.counts as Record<string, number>) : null
  }

  // Required template = highest augmentation present on covering pairings.
  const rankedKeys = [...new Set(covering.map((p) => p.complementKey))].sort(
    (a, b) => (AUG_RANK[b] ?? 0) - (AUG_RANK[a] ?? 0),
  )
  let required: Record<string, number> | null = null
  for (const k of rankedKeys) {
    required = findTemplate(k)
    if (required) break
  }
  if (!required) required = findTemplate('standard')
  // Master data missing for this AC type — neutral fallback to avoid false alarms.
  if (!required) return { state: 'fully', augmented, deltas: [] }

  // Sum actuals across covering pairings.
  const actual: Record<string, number> = {}
  for (const p of covering) {
    const counts = p.crewCounts ?? findTemplate(p.complementKey) ?? {}
    for (const [pos, n] of Object.entries(counts)) {
      actual[pos] = (actual[pos] ?? 0) + n
    }
  }

  let hasUnder = false
  let hasOver = false
  const filterSet = positionFilter && positionFilter.length > 0 ? new Set(positionFilter) : null
  const deltas: FlightCoverage['deltas'] = []
  for (const [pos, req] of Object.entries(required)) {
    if (filterSet && !filterSet.has(pos)) continue
    const have = actual[pos] ?? 0
    const d = have - req
    deltas.push({ code: pos, required: req, actual: have, delta: d })
    if (have < req) hasUnder = true
    else if (have > req) hasOver = true
  }
  if (hasUnder && hasOver) return { state: 'mixed', augmented, deltas }
  if (hasUnder) return { state: 'under', augmented, deltas }
  if (hasOver) return { state: 'over', augmented, deltas }
  return { state: 'fully', augmented, deltas }
}
