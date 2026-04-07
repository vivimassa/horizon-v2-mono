import type {
  GanttFlight, GanttAircraft, GanttAircraftType,
  BarLayout, RowLayout, LayoutResult,
  ZoomLevel, ColorMode, BarLabelMode,
} from './types'
import { ROW_HEIGHT_LEVELS } from './types'
import { utcToX, computeTicks, dateToMs } from './time-axis'
import { getBarColor, buildAcTypeColorMap } from './colors'

export interface LayoutInput {
  flights: GanttFlight[]
  aircraft: GanttAircraft[]
  aircraftTypes: GanttAircraftType[]
  periodFrom: string
  periodTo: string
  pph: number
  zoom: ZoomLevel
  rowHeightLevel: number
  collapsedTypes: Set<string>
  colorMode: ColorMode
  barLabelMode: BarLabelMode
  isDark: boolean
  containerWidth: number
}

const GROUP_HEADER_HEIGHT = 28
const AIRLINE_PREFIX_RE = /^[A-Z]{2}\s?-?/
const TAT_MS = 30 * 60_000 // 30 min default turnaround

// ── Virtual Placement (ported from V1) ──
// Distributes unassigned flights across aircraft rows of matching type.
// Display-only — never persisted.

interface AircraftSlot {
  registration: string
  windows: { start: number; end: number }[]
  lastArr: string | null
  lastEnd: number
}

function computeVirtualPlacements(
  unassigned: GanttFlight[],
  aircraft: GanttAircraft[],
  assignedByReg: Map<string, GanttFlight[]>,
): Map<string, string> {
  const placements = new Map<string, string>()

  // Group unassigned by AC type
  const byType = new Map<string, GanttFlight[]>()
  for (const f of unassigned) {
    const type = f.aircraftTypeIcao ?? 'UNKN'
    const list = byType.get(type) ?? []
    list.push(f)
    byType.set(type, list)
  }

  // Group aircraft by type
  const acByType = new Map<string, GanttAircraft[]>()
  for (const ac of aircraft) {
    const type = ac.aircraftTypeIcao ?? 'UNKN'
    const list = acByType.get(type) ?? []
    list.push(ac)
    acByType.set(type, list)
  }

  for (const [icaoType, flights] of byType) {
    const acList = acByType.get(icaoType)
    if (!acList || acList.length === 0) continue

    // Sort flights chronologically
    const sorted = [...flights].sort((a, b) => a.stdUtc - b.stdUtc)

    // Init slots from already-assigned flights
    const slots: AircraftSlot[] = acList.map(ac => {
      const real = assignedByReg.get(ac.registration) ?? []
      const windows = real.map(f => ({ start: f.stdUtc, end: f.staUtc }))
      let lastArr: string | null = null
      let lastEnd = 0
      for (const f of real) {
        if (f.staUtc > lastEnd) { lastEnd = f.staUtc; lastArr = f.arrStation }
      }
      return { registration: ac.registration, windows, lastArr, lastEnd }
    })

    // Greedy forward pass with station continuity
    for (const f of sorted) {
      let bestIdx = -1
      let bestScore = -Infinity

      for (let i = 0; i < slots.length; i++) {
        const s = slots[i]
        // Check time overlap
        const hasOverlap = s.windows.some(w =>
          f.stdUtc < w.end + TAT_MS && w.start < f.staUtc + TAT_MS
        )
        if (hasOverlap) continue

        let score = 0
        // Station continuity: last arrival matches this departure
        if (s.lastArr && s.lastArr === f.depStation) score += 1000
        // Prefer idle aircraft
        if (s.windows.length === 0) score += 500
        // Prefer aircraft with earlier last end (spread load)
        else score += 100

        if (score > bestScore) { bestScore = score; bestIdx = i }
      }

      // Fallback: any non-overlapping slot (least loaded)
      if (bestIdx < 0) {
        let minLoad = Infinity
        for (let i = 0; i < slots.length; i++) {
          const s = slots[i]
          const hasOverlap = s.windows.some(w =>
            f.stdUtc < w.end + TAT_MS && w.start < f.staUtc + TAT_MS
          )
          if (hasOverlap) continue
          if (s.windows.length < minLoad) { minLoad = s.windows.length; bestIdx = i }
        }
      }

      if (bestIdx >= 0) {
        placements.set(f.id, slots[bestIdx].registration)
        slots[bestIdx].windows.push({ start: f.stdUtc, end: f.staUtc })
        slots[bestIdx].lastArr = f.arrStation
        slots[bestIdx].lastEnd = f.staUtc
      }
    }
  }

  return placements
}

// ── Layout ──

export function computeLayout(input: LayoutInput): LayoutResult {
  const {
    flights, aircraft, aircraftTypes, periodFrom, periodTo,
    pph, zoom, rowHeightLevel, collapsedTypes, colorMode, barLabelMode, isDark,
  } = input

  const config = ROW_HEIGHT_LEVELS[rowHeightLevel] ?? ROW_HEIGHT_LEVELS[1]
  const { rowH, barH } = config
  const startMs = dateToMs(periodFrom)
  const endMs = dateToMs(periodTo) + 86_400_000
  const periodDays = Math.round((endMs - startMs) / 86_400_000)

  const acTypeColorMap = buildAcTypeColorMap(aircraftTypes)

  // Separate assigned vs unassigned flights
  const assignedByReg = new Map<string, GanttFlight[]>()
  const unassignedFlights: GanttFlight[] = []
  for (const f of flights) {
    if (f.aircraftReg) {
      const list = assignedByReg.get(f.aircraftReg) ?? []
      list.push(f)
      assignedByReg.set(f.aircraftReg, list)
    } else {
      unassignedFlights.push(f)
    }
  }

  // Virtual placement: auto-distribute unassigned flights to aircraft rows
  const virtualPlacements = computeVirtualPlacements(unassignedFlights, aircraft, assignedByReg)

  // Merge virtual placements into flightsByReg
  const flightsByReg = new Map(assignedByReg)
  for (const f of unassignedFlights) {
    const reg = virtualPlacements.get(f.id)
    if (reg) {
      const list = flightsByReg.get(reg) ?? []
      list.push(f)
      flightsByReg.set(reg, list)
    }
  }

  // Truly unassigned (couldn't fit on any aircraft)
  const overflow = unassignedFlights.filter(f => !virtualPlacements.has(f.id))

  // Group aircraft by type
  const typeGroups = new Map<string, GanttAircraft[]>()
  for (const ac of aircraft) {
    const key = ac.aircraftTypeIcao ?? 'Unknown'
    const list = typeGroups.get(key) ?? []
    list.push(ac)
    typeGroups.set(key, list)
  }

  const rows: RowLayout[] = []
  const bars: BarLayout[] = []
  let y = 0

  const sortedTypes = [...typeGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  for (const [typeIcao, acList] of sortedTypes) {
    const typeInfo = aircraftTypes.find(t => t.icaoType === typeIcao)
    const typeColor = acTypeColorMap.get(typeIcao) ?? '#6b7280'

    rows.push({
      type: 'group_header',
      aircraftTypeIcao: typeIcao,
      aircraftTypeName: typeInfo?.name ?? typeIcao,
      label: `${typeIcao} (${acList.length} aircraft)`,
      y, height: GROUP_HEADER_HEIGHT,
      color: typeColor, aircraftCount: acList.length,
    })
    y += GROUP_HEADER_HEIGHT

    if (collapsedTypes.has(typeIcao)) continue

    for (const ac of acList) {
      rows.push({
        type: 'aircraft', registration: ac.registration,
        aircraftTypeIcao: typeIcao, aircraftTypeName: typeInfo?.name ?? typeIcao,
        label: ac.registration, y, height: rowH, color: typeColor,
      })

      const acFlights = flightsByReg.get(ac.registration) ?? []
      for (const f of acFlights) {
        const x = utcToX(f.stdUtc, startMs, pph)
        const xEnd = utcToX(f.staUtc, startMs, pph)
        const width = Math.max(2, xEnd - x)
        const { bg, text } = getBarColor(f, colorMode, acTypeColorMap, isDark)
        const label = barLabelMode === 'flightNo'
          ? f.flightNumber.replace(AIRLINE_PREFIX_RE, '')
          : `${f.depStation}-${f.arrStation}`

        bars.push({
          flightId: f.id, x, y: y + (rowH - barH) / 2,
          width, height: barH, color: bg, textColor: text,
          label, row: rows.length - 1, flight: f,
        })
      }
      y += rowH
    }
  }

  // Overflow (truly couldn't place)
  if (overflow.length > 0) {
    rows.push({ type: 'unassigned', label: `Unassigned (${overflow.length} flights)`, y, height: GROUP_HEADER_HEIGHT })
    y += GROUP_HEADER_HEIGHT

    for (const f of overflow) {
      rows.push({ type: 'unassigned', label: f.flightNumber, y, height: rowH })
      const x = utcToX(f.stdUtc, startMs, pph)
      const xEnd = utcToX(f.staUtc, startMs, pph)
      const width = Math.max(2, xEnd - x)
      const { bg, text } = getBarColor(f, colorMode, acTypeColorMap, isDark)
      const label = barLabelMode === 'flightNo'
        ? f.flightNumber.replace(AIRLINE_PREFIX_RE, '')
        : `${f.depStation}-${f.arrStation}`
      bars.push({
        flightId: f.id, x, y: y + (rowH - barH) / 2,
        width, height: barH, color: bg, textColor: text,
        label, row: rows.length - 1, flight: f,
      })
      y += rowH
    }
  }

  const ticks = computeTicks(startMs, periodDays, pph, zoom)
  const rawWidth = periodDays * 24 * pph
  const totalWidth = Math.max(rawWidth, input.containerWidth)

  return { rows, bars, ticks, totalWidth, totalHeight: y }
}
