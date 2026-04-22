import type { PairingLegRef, PairingRef, UncrewedPairingRef } from '@skyhub/api'
import type { BarLabelMode } from './layout'

/**
 * Layout for the Uncrewed Duties tray in 4.1.6 Crew Schedule.
 *
 * Renders each uncrewed pairing as a time-aligned strip on the same axis
 * as the main Gantt. QTA (single duty day, no layover) → one continuous
 * pill. Multi-day pairings with layovers → separate work pills per duty
 * day joined by zebra-hatched rest strips tagged `Rest · <LAYOVER>`.
 *
 * This matches server-side `computeAssignmentWindow`:
 *   • Brief  = `briefMinutes` before first leg STD (from FdtlScheme)
 *   • Debrief = `debriefMinutes` after last leg STA (from FdtlScheme)
 * Defaults (45 / 45) are used when the scheme hasn't been seeded.
 *
 * Day-1 report and final-day release fall back to `pairing.reportTime` /
 * `pairing.releaseTime` when those are set (authoritative snapshots from
 * the pairing composer); otherwise we compute from the leg windows.
 */

export interface UncrewedMissingSeat {
  seatPositionId: string
  seatCode: string
  count: number
}

export interface UncrewedWorkBar {
  pairingId: string
  /** Unique key for React lists — `${pairingId}:d${dutyDay}`. */
  key: string
  laneIndex: number
  /** Which duty day this segment represents (1-based). */
  dutyDay: number
  /** True when this bar is the first segment of its pairing — missing-seat
   *  chips are rendered on the first bar only. */
  isFirstOfPairing: boolean
  x: number
  width: number
  label: string
  pairingCode: string
  missing: UncrewedMissingSeat[]
}

export interface UncrewedRestStrip {
  pairingId: string
  key: string
  laneIndex: number
  x: number
  width: number
  label: string
  station: string
}

export interface UncrewedLayoutInput {
  uncrewed: UncrewedPairingRef[]
  pairingsById: Map<string, PairingRef>
  periodStartMs: number
  pph: number
  totalWidth: number
  /** Max lanes to render before collapsing overflow. Default 6. */
  maxLanes?: number
  /** Brief minutes before first STD (from operator's FdtlScheme). */
  briefMinutes?: number
  /** Debrief minutes after last STA (from operator's FdtlScheme —
   *  `postFlightMinutes + debriefMinutes`). */
  debriefMinutes?: number
  /** What to render inside the pill — pairing code, sector (DEP→ARR),
   *  or the first flight number. Mirrors the main canvas toolbar. */
  barLabelMode?: BarLabelMode
}

export interface UncrewedLayoutOutput {
  workBars: UncrewedWorkBar[]
  restStrips: UncrewedRestStrip[]
  lanes: number
  /** Pairings that didn't fit in the first `maxLanes` — offered as an
   *  expandable "+N more" affordance by the caller. */
  overflowCount: number
}

// Fallbacks are 0/0 (NOT the schema defaults) so when the FDTL scheme
// hasn't been wired, a missing brief/debrief becomes immediately obvious:
// reporting time will equal first STD. If you see that in production the
// culprit is always "the FDTL scheme isn't flowing in" — no other layer
// can cause it.
const DEFAULT_BRIEF_MIN = 0
const DEFAULT_DEBRIEF_MIN = 0
const MIN_BAR_WIDTH_PX = 4

interface DutyDaySpan {
  dutyDay: number
  reportMs: number
  releaseMs: number
}

/** Group a pairing's legs by duty day and compute the work window
 *  (report → release) for each day. Day-1 report and final-day release
 *  prefer the pairing-level `reportTime` / `releaseTime` when present. */
function computeDutyDaySpans(p: PairingRef, briefMin: number, debriefMin: number): DutyDaySpan[] {
  if (!p.legs.length) return []
  const byDay = new Map<number, PairingLegRef[]>()
  for (const leg of p.legs) {
    const arr = byDay.get(leg.dutyDay) ?? []
    arr.push(leg)
    byDay.set(leg.dutyDay, arr)
  }
  const days = [...byDay.keys()].sort((a, b) => a - b)
  const spans: DutyDaySpan[] = []
  const pairingReportMs = p.reportTime ? new Date(p.reportTime).getTime() : null
  const pairingReleaseMs = p.releaseTime ? new Date(p.releaseTime).getTime() : null
  // Day-1 floor: pairing.startDate at UTC midnight. When a pairing's first
  // leg departs on the PREVIOUS UTC date (cross-midnight cases), clamping
  // day-1 reportMs to this floor keeps the bar on the pairing's declared
  // start date — which is what the Gantt day columns are keyed on. Without
  // this the bar would render on the prior day column and the pairing
  // appears invisible when the viewport starts on pairing.startDate.
  const startDateFloorMs = p.startDate ? new Date(p.startDate + 'T00:00:00.000Z').getTime() : null
  for (let i = 0; i < days.length; i += 1) {
    const d = days[i]
    const legs = (byDay.get(d) ?? []).slice().sort((a, b) => a.legOrder - b.legOrder)
    if (!legs.length) continue
    const firstStd = new Date(legs[0].stdUtcIso).getTime()
    const lastSta = new Date(legs[legs.length - 1].staUtcIso).getTime()
    const isFirst = i === 0
    const isLast = i === days.length - 1
    let reportMs = isFirst && pairingReportMs !== null ? pairingReportMs : firstStd - briefMin * 60_000
    if (isFirst && pairingReportMs === null && startDateFloorMs !== null && reportMs < startDateFloorMs) {
      reportMs = startDateFloorMs
    }
    const releaseMs = isLast && pairingReleaseMs !== null ? pairingReleaseMs : lastSta + debriefMin * 60_000
    spans.push({ dutyDay: d, reportMs, releaseMs })
  }
  return spans
}

/** Greedy first-fit lane packing by overall pairing window. */
function packLanes(items: { reportMs: number; releaseMs: number }[]): number[] {
  const laneEnds: number[] = []
  const laneIndex: number[] = new Array(items.length)
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i]
    let found = -1
    for (let l = 0; l < laneEnds.length; l += 1) {
      if (laneEnds[l] <= it.reportMs) {
        found = l
        break
      }
    }
    if (found === -1) {
      found = laneEnds.length
      laneEnds.push(it.releaseMs)
    } else {
      laneEnds[found] = it.releaseMs
    }
    laneIndex[i] = found
  }
  return laneIndex
}

export function buildUncrewedLayout(input: UncrewedLayoutInput): UncrewedLayoutOutput {
  const { uncrewed, pairingsById, periodStartMs, pph } = input
  const maxLanes = input.maxLanes ?? 6
  const briefMin = input.briefMinutes ?? DEFAULT_BRIEF_MIN
  const debriefMin = input.debriefMinutes ?? DEFAULT_DEBRIEF_MIN
  const barLabelMode = input.barLabelMode ?? 'pairing'
  const hourMs = 3_600_000

  const computeLabel = (p: PairingRef, dutyDayLegs: PairingLegRef[]): string => {
    if (barLabelMode === 'sector') {
      if (!dutyDayLegs.length) return p.pairingCode
      return `${dutyDayLegs[0].depStation}→${dutyDayLegs[dutyDayLegs.length - 1].arrStation}`
    }
    if (barLabelMode === 'flight') {
      if (!dutyDayLegs.length) return p.pairingCode
      const first = dutyDayLegs[0]
      const suffix = dutyDayLegs.length > 1 ? ` +${dutyDayLegs.length - 1}` : ''
      return `${first.flightNumber}${suffix}`
    }
    return p.pairingCode
  }

  // Resolve (uncrewed → pairing → spans) up front. Drop anything without
  // a matching pairing or with no legs.
  type Item = {
    u: UncrewedPairingRef
    p: PairingRef
    spans: DutyDaySpan[]
    reportMs: number
    releaseMs: number
  }
  const items: Item[] = []
  for (const u of uncrewed) {
    const p = pairingsById.get(u.pairingId)
    if (!p) continue
    const spans = computeDutyDaySpans(p, briefMin, debriefMin)
    if (!spans.length) continue
    const reportMs = spans[0].reportMs
    const releaseMs = spans[spans.length - 1].releaseMs
    items.push({ u, p, spans, reportMs, releaseMs })
  }

  // Sort by report, then pack.
  items.sort((a, b) => a.reportMs - b.reportMs)
  const laneIdx = packLanes(items)

  const workBars: UncrewedWorkBar[] = []
  const restStrips: UncrewedRestStrip[] = []
  let overflowCount = 0

  for (let i = 0; i < items.length; i += 1) {
    const lane = laneIdx[i]
    if (lane >= maxLanes) {
      overflowCount += 1
      continue
    }
    const it = items[i]
    const { u, p, spans } = it
    const pairingCode = u.pairingCode ?? p.pairingCode ?? p._id.slice(0, 6)

    for (let di = 0; di < spans.length; di += 1) {
      const s = spans[di]
      const x = ((s.reportMs - periodStartMs) / hourMs) * pph
      const w = Math.max(MIN_BAR_WIDTH_PX, ((s.releaseMs - s.reportMs) / hourMs) * pph)
      const dutyDayLegs = p.legs.filter((l) => l.dutyDay === s.dutyDay)
      workBars.push({
        pairingId: p._id,
        key: `${p._id}:d${s.dutyDay}`,
        laneIndex: lane,
        dutyDay: s.dutyDay,
        isFirstOfPairing: di === 0,
        x,
        width: w,
        label: computeLabel(p, dutyDayLegs),
        pairingCode,
        missing: di === 0 ? u.missing : [],
      })

      // Rest strip between this duty day and the next.
      if (di < spans.length - 1) {
        const next = spans[di + 1]
        const restStartMs = s.releaseMs
        const restEndMs = next.reportMs
        if (restEndMs > restStartMs) {
          const rx = ((restStartMs - periodStartMs) / hourMs) * pph
          const rw = ((restEndMs - restStartMs) / hourMs) * pph
          // layoverAirports is ordered by duty day — layover AFTER day d
          // is at index (d-1). Fall back to the next leg's dep station
          // when the array is short.
          const stationFromList = p.layoverAirports[s.dutyDay - 1]
          const stationFallback = p.legs.find((l) => l.dutyDay === next.dutyDay)?.depStation ?? ''
          const station = stationFromList || stationFallback || '—'
          restStrips.push({
            pairingId: p._id,
            key: `${p._id}:rest${s.dutyDay}`,
            laneIndex: lane,
            x: rx,
            width: rw,
            label: `Rest · ${station}`,
            station,
          })
        }
      }
    }
  }

  const lanes = Math.min(maxLanes, Math.max(0, ...laneIdx.map((l) => l + 1), 0))
  return { workBars, restStrips, lanes, overflowCount }
}
