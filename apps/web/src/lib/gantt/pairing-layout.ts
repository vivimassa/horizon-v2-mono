import { utcToX } from './time-axis'
import type {
  PairingLayoutInput,
  PairingLayoutResult,
  PackedPairing,
  PillLayout,
  ConnectorSegment,
} from './pairing-types'
import type { Pairing, PairingLegMeta } from '@/components/crew-ops/pairing/types'

/**
 * Layout a set of pairings into packed lanes for the Pairing Zone canvas.
 *
 * Lane packing = greedy first-fit. Sort pairings by startDate; for each,
 * find the first lane whose last pairing ends before this one starts, or
 * open a new lane. O(N · L) where L = number of lanes.
 *
 * Broken-pairing detection:
 *   - Missing leg (can't resolve stdUtcIso/staUtcIso) → broken
 *   - Station gap (arr station of leg i ≠ dep station of leg i+1) → broken
 *   - Non-base-to-base (first dep or last arr not in baseAirports) → broken
 */
export function layoutPairings(input: PairingLayoutInput): PairingLayoutResult {
  const { pairings, filter, startMs, pph, baseAirports, minTurnaroundMinutes = 30 } = input

  const filtered = pairings.filter((p) => matchesFilter(p, filter))

  // Sort by first leg's stdUtc (fallback to startDate).
  const sorted = [...filtered].sort((a, b) => {
    const am = getPairingStartMs(a) ?? 0
    const bm = getPairingStartMs(b) ?? 0
    return am - bm
  })

  // Lane endings (last pairing's xMax per lane).
  const laneEnds: number[] = []
  const packed: PackedPairing[] = []

  for (const pairing of sorted) {
    const pills = buildPills(pairing.legs, startMs, pph)
    if (pills.length === 0) continue

    const xMin = pills[0].x
    const xMax = pills[pills.length - 1].x + pills[pills.length - 1].width

    // Find first available lane.
    let lane = -1
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i] <= xMin - 2) {
        lane = i
        break
      }
    }
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(xMax)
    } else {
      laneEnds[lane] = xMax
    }

    const { connectors, stationGap } = buildConnectors(pills, pairing.legs, minTurnaroundMinutes)
    const brokenReason = detectBrokenReason(pairing, pills, baseAirports, stationGap)

    packed.push({
      pairingId: pairing.id,
      pairingCode: pairing.pairingCode,
      lane,
      pills,
      connectors,
      status: pairing.status,
      workflowStatus: pairing.workflowStatus,
      isBroken: brokenReason !== null,
      brokenReason,
      xMin,
      xMax,
      pairing,
    })
  }

  return {
    packed,
    maxLane: laneEnds.length,
    visibleCount: packed.length,
    totalCount: pairings.length,
  }
}

function matchesFilter(p: Pairing, filter: PairingLayoutInput['filter']): boolean {
  if (filter === 'all') return true
  if (filter === 'illegal') return p.status === 'violation' || p.status === 'warning'
  if (filter === 'covered') return p.status === 'legal'
  if (filter === 'partial') return p.status === 'warning'
  if (filter === 'under') return p.cockpitCount < 2
  if (filter === 'over') return p.cockpitCount > 3
  if (filter === 'augmented') return p.complementKey !== 'standard'
  return true
}

function getPairingStartMs(p: Pairing): number | null {
  const first = p.legs[0]
  if (first?.stdUtcIso) return Date.parse(first.stdUtcIso)
  if (first?.stdUtc) return Date.parse(first.stdUtc)
  if (p.startDate) return Date.parse(`${p.startDate}T00:00:00Z`)
  return null
}

function buildPills(legs: PairingLegMeta[], startMs: number, pph: number): PillLayout[] {
  const pills: PillLayout[] = []
  for (const leg of legs) {
    const stdIso = leg.stdUtcIso ?? leg.stdUtc ?? null
    const staIso = leg.staUtcIso ?? leg.staUtc ?? null
    if (!stdIso || !staIso) continue
    const stdMs = Date.parse(stdIso)
    const staMs = Date.parse(staIso)
    if (Number.isNaN(stdMs) || Number.isNaN(staMs)) continue
    const x = utcToX(stdMs, startMs, pph)
    const xEnd = utcToX(staMs, startMs, pph)
    // Match the flight-bar floor from the Movement Control layout engine so
    // pairing pills track 1:1 with the flight bar above them at every zoom.
    const width = Math.max(2, xEnd - x)
    pills.push({
      flightId: leg.flightId,
      x,
      width,
      label: leg.flightNumber ?? '',
      isDeadhead: leg.isDeadhead,
      depStation: leg.depStation,
      arrStation: leg.arrStation,
      flightNumber: leg.flightNumber ?? '',
      stdMs,
      staMs,
    })
  }
  return pills
}

function buildConnectors(
  pills: PillLayout[],
  legs: PairingLegMeta[],
  minTurnaround: number,
): { connectors: ConnectorSegment[]; stationGap: boolean } {
  const connectors: ConnectorSegment[] = []
  let stationGap = false
  for (let i = 0; i < pills.length - 1; i++) {
    const a = pills[i]
    const b = pills[i + 1]
    const sitMs = b.stdMs - a.staMs
    const sitMinutes = Math.round(sitMs / 60_000)
    const gap = legs[i].arrStation !== legs[i + 1].depStation
    if (gap) stationGap = true
    connectors.push({
      x: a.x + a.width,
      width: Math.max(0, b.x - (a.x + a.width)),
      sitMinutes,
      isLegal: sitMinutes >= minTurnaround && !gap,
      isStationGap: gap,
    })
  }
  return { connectors, stationGap }
}

function detectBrokenReason(
  pairing: Pairing,
  pills: PillLayout[],
  baseAirports: string[] | null,
  stationGap: boolean,
): string | null {
  if (pairing.legs.length !== pills.length) return 'Missing leg data'
  if (stationGap) return 'Station chain gap'
  if (baseAirports && baseAirports.length > 0 && pills.length > 0) {
    const firstDep = pills[0].depStation
    const lastArr = pills[pills.length - 1].arrStation
    if (!baseAirports.includes(firstDep) || !baseAirports.includes(lastArr)) {
      return 'Not base-to-base'
    }
  }
  return null
}
