// Gantt layout engine — row grouping, virtual placement, bar positions.
// Pure JS, no DOM. Shared by web + mobile.

import type {
  GanttFlight,
  GanttAircraft,
  GanttAircraftType,
  BarLayout,
  RowLayout,
  LayoutResult,
  ZoomLevel,
  ColorMode,
  BarLabelMode,
  FleetSortOrder,
} from '@skyhub/types'
import { ROW_HEIGHT_LEVELS } from '@skyhub/types'
import { utcToX, computeTicks, dateToMs } from './gantt-time'
import { getBarColor, buildAcTypeColorMap } from './gantt-colors'

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
  fleetSortOrder: FleetSortOrder
  isDark: boolean
  containerWidth: number
  /** Previous virtual placements — used as affinity hints to keep unassigned flights stable */
  previousVirtualPlacements?: Map<string, string>
  /** Forced placements — override virtual placement for specific flights (from drag-drop rearrange) */
  forcedPlacements?: Map<string, string>
  /** Optional: tail registration to pin at the top of its type group AND bubble that type group to the top.
   *  Used by the pairing gantt "Proposal" feature to surface the nearest legal next-leg candidate row. */
  pinnedRegistration?: string | null
}

/**
 * Best-known departure and arrival times for a flight.
 * Cascade: actual (OOOI) > estimated > scheduled.
 */
export function getDisplayTimes(f: GanttFlight): { depMs: number; arrMs: number } {
  const depMs = f.atdUtc ?? f.etdUtc ?? f.stdUtc
  const arrMs = f.ataUtc ?? f.etaUtc ?? f.staUtc
  return { depMs, arrMs }
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

/** A rotation block: one or more flights that must be assigned to the same aircraft */
interface FlightBlock {
  flights: GanttFlight[] // sorted by stdUtc
  depStation: string // first flight's departure
  arrStation: string // last flight's arrival
  startMs: number // earliest STD
  endMs: number // latest STA
}

/** Group flights into atomic blocks by rotationId, then sort blocks chronologically */
function buildBlocks(flights: GanttFlight[]): FlightBlock[] {
  const rotationMap = new Map<string, GanttFlight[]>()
  const singles: GanttFlight[] = []

  for (const f of flights) {
    if (f.rotationId) {
      const list = rotationMap.get(f.rotationId) ?? []
      list.push(f)
      rotationMap.set(f.rotationId, list)
    } else {
      singles.push(f)
    }
  }

  const blocks: FlightBlock[] = []

  // Rotation blocks — sort legs within each block by sequence then time
  for (const legs of rotationMap.values()) {
    legs.sort((a, b) => (a.rotationSequence ?? 0) - (b.rotationSequence ?? 0) || a.stdUtc - b.stdUtc)
    blocks.push({
      flights: legs,
      depStation: legs[0].depStation,
      arrStation: legs[legs.length - 1].arrStation,
      startMs: legs[0].stdUtc,
      endMs: legs[legs.length - 1].staUtc,
    })
  }

  // Single-flight blocks
  for (const f of singles) {
    blocks.push({
      flights: [f],
      depStation: f.depStation,
      arrStation: f.arrStation,
      startMs: f.stdUtc,
      endMs: f.staUtc,
    })
  }

  // Sort blocks by earliest departure
  blocks.sort((a, b) => a.startMs - b.startMs)
  return blocks
}

function computeVirtualPlacements(
  unassigned: GanttFlight[],
  aircraft: GanttAircraft[],
  assignedByReg: Map<string, GanttFlight[]>,
  previousPlacements?: Map<string, string>,
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

    // Build rotation-aware blocks
    const blocks = buildBlocks(flights)

    // Init slots from already-assigned flights
    const slots: AircraftSlot[] = acList.map((ac) => {
      const real = assignedByReg.get(ac.registration) ?? []
      const windows = real.map((f) => {
        const { depMs, arrMs } = getDisplayTimes(f)
        return { start: depMs, end: arrMs }
      })
      let lastArr: string | null = null
      let lastEnd = 0
      for (const f of real) {
        const arr = getDisplayTimes(f).arrMs
        if (arr > lastEnd) {
          lastEnd = arr
          lastArr = f.arrStation
        }
      }
      return { registration: ac.registration, windows, lastArr, lastEnd }
    })

    // Greedy forward pass — assign entire blocks atomically
    for (const block of blocks) {
      let bestIdx = -1
      let bestScore = -Infinity
      let bestLoad = Infinity

      for (let i = 0; i < slots.length; i++) {
        const s = slots[i]

        // ALL flights in the block must fit without overlap
        let blockFits = true
        for (const f of block.flights) {
          const { depMs, arrMs } = getDisplayTimes(f)
          const hasOverlap = s.windows.some((w) => depMs < w.end + TAT_MS && w.start < arrMs + TAT_MS)
          if (hasOverlap) {
            blockFits = false
            break
          }
        }
        if (!blockFits) continue

        let score = 0

        // Affinity: strongly prefer keeping flights on the same row as before
        if (previousPlacements) {
          const affinityCount = block.flights.filter((f) => previousPlacements.get(f.id) === s.registration).length
          if (affinityCount > 0) score += 2000 + affinityCount * 500
        }

        // Station continuity: last arrival matches block's first departure
        if (s.lastArr && s.lastArr === block.depStation) {
          score += 500
          const gap = block.startMs - s.lastEnd
          if (gap > 0 && gap < 3 * 3_600_000) score += 300
        }

        // Load penalty
        score -= s.windows.length * 200

        if (score > bestScore || (score === bestScore && s.windows.length < bestLoad)) {
          bestScore = score
          bestIdx = i
          bestLoad = s.windows.length
        }
      }

      if (bestIdx >= 0) {
        const s = slots[bestIdx]
        for (const f of block.flights) {
          placements.set(f.id, s.registration)
          const { depMs, arrMs } = getDisplayTimes(f)
          s.windows.push({ start: depMs, end: arrMs })
        }
        // Update slot tracking from the last flight in the block
        const lastFlight = block.flights[block.flights.length - 1]
        s.lastArr = lastFlight.arrStation
        s.lastEnd = getDisplayTimes(lastFlight).arrMs
      }
    }
  }

  return placements
}

// ── Layout ──

export function computeLayout(input: LayoutInput): LayoutResult {
  const {
    flights,
    aircraft,
    aircraftTypes,
    periodFrom,
    periodTo,
    pph,
    zoom,
    rowHeightLevel,
    collapsedTypes,
    colorMode,
    barLabelMode,
    isDark,
  } = input

  const config = ROW_HEIGHT_LEVELS[rowHeightLevel] ?? ROW_HEIGHT_LEVELS[1]
  const { rowH, barH } = config
  const startMs = dateToMs(periodFrom)
  const endMs = dateToMs(periodTo) + 86_400_000
  const periodDays = Math.round((endMs - startMs) / 86_400_000)

  const acTypeColorMap = buildAcTypeColorMap(aircraftTypes)

  // Split out suspended / cancelled — they render on dedicated synthetic rows at the
  // bottom and do not participate in tail assignment.
  const suspendedFlights: GanttFlight[] = []
  const cancelledFlights: GanttFlight[] = []
  const activeFlights: GanttFlight[] = []
  for (const f of flights) {
    if (f.status === 'suspended') suspendedFlights.push(f)
    else if (f.status === 'cancelled') cancelledFlights.push(f)
    else activeFlights.push(f)
  }

  // Separate assigned vs unassigned flights (active only)
  const assignedByReg = new Map<string, GanttFlight[]>()
  const unassignedFlights: GanttFlight[] = []
  for (const f of activeFlights) {
    if (f.aircraftReg) {
      const list = assignedByReg.get(f.aircraftReg) ?? []
      list.push(f)
      assignedByReg.set(f.aircraftReg, list)
    } else {
      unassignedFlights.push(f)
    }
  }

  // Apply forced placements first (from drag-drop rearrange) — these skip the greedy algorithm
  const forced = input.forcedPlacements
  const forcedFlightIds = new Set(forced?.keys() ?? [])
  const unassignedForGreedy = forced ? unassignedFlights.filter((f) => !forcedFlightIds.has(f.id)) : unassignedFlights

  // Pre-place forced flights into assignedByReg so greedy sees them as occupied
  const assignedByRegWithForced = new Map(assignedByReg)
  if (forced) {
    for (const f of unassignedFlights) {
      const reg = forced.get(f.id)
      if (reg) {
        const list = assignedByRegWithForced.get(reg) ?? []
        list.push(f)
        assignedByRegWithForced.set(reg, list)
      }
    }
  }

  // Virtual placement: auto-distribute remaining unassigned flights to aircraft rows
  const virtualPlacements = computeVirtualPlacements(
    unassignedForGreedy,
    aircraft,
    assignedByRegWithForced,
    input.previousVirtualPlacements,
  )

  // Merge forced placements into virtualPlacements map
  if (forced) {
    for (const [id, reg] of forced) virtualPlacements.set(id, reg)
  }

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
  const overflow = unassignedFlights.filter((f) => !virtualPlacements.has(f.id))

  // Group aircraft by type
  const typeGroups = new Map<string, GanttAircraft[]>()
  for (const ac of aircraft) {
    const key = ac.aircraftTypeIcao ?? 'Unknown'
    const list = typeGroups.get(key) ?? []
    list.push(ac)
    typeGroups.set(key, list)
  }

  // Compute block hours per aircraft for utilization sort
  const blockHrsByReg = new Map<string, number>()
  if (input.fleetSortOrder === 'utilization') {
    for (const [reg, fls] of flightsByReg) {
      blockHrsByReg.set(reg, fls.reduce((s, f) => s + f.blockMinutes, 0) / 60)
    }
  }

  // Sort aircraft within each type group
  for (const [, acList] of typeGroups) {
    if (input.fleetSortOrder === 'registration') {
      acList.sort((a, b) => a.registration.localeCompare(b.registration))
    } else if (input.fleetSortOrder === 'utilization') {
      acList.sort((a, b) => (blockHrsByReg.get(b.registration) ?? 0) - (blockHrsByReg.get(a.registration) ?? 0))
    } else {
      acList.sort((a, b) => a.registration.localeCompare(b.registration))
    }
    // Pin one reg at top of its group if requested.
    const pin = input.pinnedRegistration
    if (pin) {
      const idx = acList.findIndex((a) => a.registration === pin)
      if (idx > 0) {
        const [pinned] = acList.splice(idx, 1)
        acList.unshift(pinned)
      }
    }
  }

  const rows: RowLayout[] = []
  const bars: BarLayout[] = []
  let y = 0

  const sortedTypes = [...typeGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  // Bubble the type group hosting the pinned registration to the top.
  if (input.pinnedRegistration) {
    const idx = sortedTypes.findIndex(([, list]) => list.some((ac) => ac.registration === input.pinnedRegistration))
    if (idx > 0) {
      const [pinnedGroup] = sortedTypes.splice(idx, 1)
      sortedTypes.unshift(pinnedGroup)
    }
  }

  for (const [typeIcao, acList] of sortedTypes) {
    const typeInfo = aircraftTypes.find((t) => t.icaoType === typeIcao)
    const typeColor = acTypeColorMap.get(typeIcao) ?? '#6b7280'

    rows.push({
      type: 'group_header',
      aircraftTypeIcao: typeIcao,
      aircraftTypeName: typeInfo?.name ?? typeIcao,
      label: `${typeIcao} (${acList.length} aircraft)`,
      y,
      height: GROUP_HEADER_HEIGHT,
      color: typeColor,
      aircraftCount: acList.length,
    })
    y += GROUP_HEADER_HEIGHT

    if (collapsedTypes.has(typeIcao)) continue

    for (const ac of acList) {
      rows.push({
        type: 'aircraft',
        registration: ac.registration,
        aircraftTypeIcao: typeIcao,
        aircraftTypeName: typeInfo?.name ?? typeIcao,
        seatConfig: ac.seatConfig,
        label: ac.registration,
        y,
        height: rowH,
        color: typeColor,
      })

      const acFlights = flightsByReg.get(ac.registration) ?? []
      for (const f of acFlights) {
        const { depMs, arrMs } = getDisplayTimes(f)
        const x = utcToX(depMs, startMs, pph)
        const xEnd = utcToX(arrMs, startMs, pph)
        const width = Math.max(2, xEnd - x)
        const { bg, text } = getBarColor(f, colorMode, acTypeColorMap, isDark)
        const label =
          barLabelMode === 'flightNo'
            ? f.flightNumber.replace(AIRLINE_PREFIX_RE, '')
            : `${f.depStation}-${f.arrStation}`

        bars.push({
          flightId: f.id,
          x,
          y: y + (rowH - barH) / 2,
          width,
          height: barH,
          color: bg,
          textColor: text,
          label,
          row: rows.length - 1,
          flight: f,
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
      const { depMs, arrMs } = getDisplayTimes(f)
      const x = utcToX(depMs, startMs, pph)
      const xEnd = utcToX(arrMs, startMs, pph)
      const width = Math.max(2, xEnd - x)
      const { bg, text } = getBarColor(f, colorMode, acTypeColorMap, isDark)
      const label =
        barLabelMode === 'flightNo' ? f.flightNumber.replace(AIRLINE_PREFIX_RE, '') : `${f.depStation}-${f.arrStation}`
      bars.push({
        flightId: f.id,
        x,
        y: y + (rowH - barH) / 2,
        width,
        height: barH,
        color: bg,
        textColor: text,
        label,
        row: rows.length - 1,
        flight: f,
      })
      y += rowH
    }
  }

  // Synthetic status rows — Suspended and Cancelled each get a single dedicated track
  // at the bottom of the canvas. Bars can overlap since these flights aren't flying.
  const statusSections: Array<{ status: 'suspended' | 'cancelled'; flights: GanttFlight[]; label: string }> = [
    { status: 'suspended', flights: suspendedFlights, label: 'Suspended' },
    { status: 'cancelled', flights: cancelledFlights, label: 'Cancelled' },
  ]
  for (const section of statusSections) {
    if (section.flights.length === 0) continue
    rows.push({
      type: section.status,
      label: section.label,
      y,
      height: rowH,
      flightCount: section.flights.length,
    })
    for (const f of section.flights) {
      const { depMs, arrMs } = getDisplayTimes(f)
      const x = utcToX(depMs, startMs, pph)
      const xEnd = utcToX(arrMs, startMs, pph)
      const width = Math.max(2, xEnd - x)
      const { bg, text } = getBarColor(f, colorMode, acTypeColorMap, isDark)
      const label =
        barLabelMode === 'flightNo' ? f.flightNumber.replace(AIRLINE_PREFIX_RE, '') : `${f.depStation}-${f.arrStation}`
      bars.push({
        flightId: f.id,
        x,
        y: y + (rowH - barH) / 2,
        width,
        height: barH,
        color: bg,
        textColor: text,
        label,
        row: rows.length - 1,
        flight: f,
      })
    }
    y += rowH
  }

  const ticks = computeTicks(startMs, periodDays, pph, zoom)
  const rawWidth = periodDays * 24 * pph
  const totalWidth = Math.max(rawWidth, input.containerWidth)

  return { rows, bars, ticks, totalWidth, totalHeight: y, virtualPlacements }
}
