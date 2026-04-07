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
}

const GROUP_HEADER_HEIGHT = 28
const AIRLINE_PREFIX_RE = /^[A-Z]{2}\s?-?/

export function computeLayout(input: LayoutInput): LayoutResult {
  const {
    flights, aircraft, aircraftTypes, periodFrom, periodTo,
    pph, zoom, rowHeightLevel, collapsedTypes, colorMode, barLabelMode, isDark,
  } = input

  const config = ROW_HEIGHT_LEVELS[rowHeightLevel] ?? ROW_HEIGHT_LEVELS[1]
  const { rowH, barH } = config
  const startMs = dateToMs(periodFrom)
  const endMs = dateToMs(periodTo) + 86_400_000 // inclusive end
  const periodDays = Math.round((endMs - startMs) / 86_400_000)

  const acTypeColorMap = buildAcTypeColorMap(aircraftTypes)

  // Index flights by registration
  const flightsByReg = new Map<string, GanttFlight[]>()
  const unassignedFlights: GanttFlight[] = []
  for (const f of flights) {
    if (f.aircraftReg) {
      const list = flightsByReg.get(f.aircraftReg) ?? []
      list.push(f)
      flightsByReg.set(f.aircraftReg, list)
    } else {
      unassignedFlights.push(f)
    }
  }

  // Group aircraft by type ICAO
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

    // Group header
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
        label: ac.registration,
        y,
        height: rowH,
        color: typeColor,
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

  // Unassigned group
  if (unassignedFlights.length > 0) {
    rows.push({
      type: 'unassigned',
      label: `Unassigned (${unassignedFlights.length} flights)`,
      y,
      height: GROUP_HEADER_HEIGHT,
    })
    y += GROUP_HEADER_HEIGHT

    for (const f of unassignedFlights) {
      rows.push({
        type: 'unassigned',
        label: f.flightNumber,
        y,
        height: rowH,
      })

      const x = utcToX(f.stdUtc, startMs, pph)
      const xEnd = utcToX(f.staUtc, startMs, pph)
      const width = Math.max(2, xEnd - x)
      const { bg, text } = getBarColor(f, colorMode, acTypeColorMap, isDark)
      const label = barLabelMode === 'flightNo'
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

      y += rowH
    }
  }

  const ticks = computeTicks(startMs, periodDays, pph, zoom)
  const totalWidth = periodDays * 24 * pph

  return { rows, bars, ticks, totalWidth, totalHeight: y }
}
