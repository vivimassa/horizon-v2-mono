'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTheme } from '@/components/theme-provider'
import MapGL, { type MapMouseEvent, type MapRef } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { getAircraftTypeColors } from '@/lib/world-map/api'
import { FlightInformationDialog } from '@/components/network/gantt/flight-information/flight-information-dialog'
import { useGanttStore } from '@/stores/use-gantt-store'
import { WorldMapLayers, INTERACTIVE_LAYERS } from './world-map-layers'
import { WorldMapOverlays } from './world-map-overlays'
import { useAircraftIcons } from './use-aircraft-icons'
import { useWorldMapData } from './use-world-map-data'
import type { KpiMode, MapStyleKey, WorldMapAirport, WorldMapFlight } from './world-map-types'
import { MAP_STYLES, computeFlightProgress, interpolateGreatCircle } from './world-map-types'
import './world-map.css'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GLOBE_PROJECTION = { name: 'globe' } as any
const DARK_FOG = {
  color: 'rgb(10, 12, 20)',
  'high-color': 'rgb(20, 24, 45)',
  'horizon-blend': 0.06,
  'space-color': 'rgb(5, 5, 15)',
  'star-intensity': 0.4,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any
const LIGHT_FOG = {
  color: 'rgb(220, 225, 235)',
  'high-color': 'rgb(180, 195, 220)',
  'horizon-blend': 0.08,
  'space-color': 'rgb(200, 210, 230)',
  'star-intensity': 0,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any

export interface WorldMapCanvasProps {
  /** Overrides theme auto-detection from ThemeProvider. */
  isDark?: boolean
  /** Map-only mode: hides filter/search/stats/KPI overlays. Tooltips + flight dialog still render. */
  bare?: boolean
  showFilter?: boolean
  showSearch?: boolean
  showStatsBar?: boolean
  showKpiPanels?: boolean
  /** Click handler for aircraft icons. Defaults to opening FlightInformationDialog via useGanttStore. */
  onFlightClick?: (flightInstanceId: string) => void
  initialViewState?: { longitude: number; latitude: number; zoom: number }
  /** Proportional UI scale for stats/KPI overlays when shown. */
  uiZoom?: number
}

export function WorldMapCanvas({
  isDark: isDarkProp,
  bare = false,
  showFilter: showFilterProp,
  showSearch: showSearchProp,
  showStatsBar: showStatsBarProp,
  showKpiPanels: showKpiPanelsProp,
  onFlightClick,
  initialViewState = { longitude: 106.6, latitude: 16, zoom: 4.5 },
  uiZoom = 1,
}: WorldMapCanvasProps) {
  const { theme } = useTheme()
  const isDark = isDarkProp ?? theme === 'dark'

  const showFilter = showFilterProp ?? !bare
  const showSearch = showSearchProp ?? !bare
  const showStatsBar = showStatsBarProp ?? !bare
  const showKpiPanels = showKpiPanelsProp ?? !bare

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapRef>(null)
  const [acTypeColors, setAcTypeColors] = useState<Record<string, string>>({})

  const data = useWorldMapData()
  const {
    flights,
    airports,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    setCommittedSearch,
    now,
    utcTime,
    aircraftTypes,
    filteredFlights,
    positions,
    airportCounts,
    flightById,
    airportByIata,
  } = data

  const { handleMapLoad, handleStyleData } = useAircraftIcons({ mapRef, isDark, acTypeColors })

  useEffect(() => {
    getAircraftTypeColors()
      .then(setAcTypeColors)
      .catch(() => {})
  }, [])

  // Keep Mapbox in sync when its container changes size (parent grid cell
  // resizes, sidebar toggles). Mapbox only auto-resizes on window.resize.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let rafId = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        mapRef.current?.getMap()?.resize()
      })
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(rafId)
    }
  }, [])

  const [mapStyleKey, setMapStyleKey] = useState<MapStyleKey>(isDark ? 'dark' : 'streets')
  const mapStyleOption = MAP_STYLES.find((s) => s.key === mapStyleKey) ?? MAP_STYLES[0]
  const mapStyle = mapStyleKey === 'auto' ? (isDark ? mapStyleOption.urlDark! : mapStyleOption.url) : mapStyleOption.url
  const useDarkFog = mapStyleOption.darkFog === 'auto' ? isDark : mapStyleOption.darkFog

  const [filterCollapsed, setFilterCollapsed] = useState(true)
  const [otpTarget, setOtpTarget] = useState(80)
  const [lfTarget, setLfTarget] = useState(80)
  const [tatTargetMin, setTatTargetMin] = useState(45)
  const [fuelTargetPct, setFuelTargetPct] = useState(3)
  const [activeKpis, setActiveKpis] = useState<KpiMode[]>([])

  const toggleKpi = useCallback((mode: KpiMode) => {
    setActiveKpis((prev) => (prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]))
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && activeKpis.length > 0) setActiveKpis([])
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeKpis])

  const [hoveredFlight, setHoveredFlight] = useState<{
    flight: WorldMapFlight
    x: number
    y: number
    progress: number
  } | null>(null)
  const [hoveredAirport, setHoveredAirport] = useState<{ airport: WorldMapAirport; x: number; y: number } | null>(null)
  const openFlightInfo = useGanttStore((s) => s.openFlightInfo)
  const flightInfoOpen = useGanttStore((s) => s.flightInfoDialogId !== null)
  const [highlightFlightId, setHighlightFlightId] = useState<string | null>(null)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseMove = useCallback(
    (e: MapMouseEvent) => {
      const feature = e.features?.[0]
      if (!feature) {
        setHoveredFlight(null)
        setHoveredAirport(null)
        return
      }
      // Tooltips render with position:fixed, so we need viewport-relative
      // coordinates. `e.point` is map-container-relative which only matched
      // the viewport when the map was the full page; once embedded in a
      // grid cell, we must use the native MouseEvent's clientX/Y.
      const x = e.originalEvent.clientX
      const y = e.originalEvent.clientY
      const layerId = feature.layer?.id
      if (layerId === 'aircraft-icons') {
        const fId = feature.properties?.id as string
        const flight = flightById.get(fId)
        if (flight) {
          const progress = computeFlightProgress(flight, now)
          setHoveredFlight({ flight, x, y, progress })
          setHoveredAirport(null)
        }
      } else if (layerId === 'airport-dot') {
        const iata = feature.properties?.iata as string
        const airport = airportByIata.get(iata)
        if (airport) {
          setHoveredAirport({ airport, x, y })
          setHoveredFlight(null)
        }
      }
    },
    [flightById, airportByIata, now],
  )

  const handleMouseLeave = useCallback(() => {
    setHoveredFlight(null)
    setHoveredAirport(null)
  }, [])

  const handleFlyToFlight = useCallback(
    (flight: WorldMapFlight) => {
      const map = mapRef.current
      if (!map) return

      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
      setHighlightFlightId(flight.id)
      highlightTimerRef.current = setTimeout(() => {
        setHighlightFlightId(null)
        highlightTimerRef.current = null
      }, 3000)

      const pos = positions.find((p) => p.flight.id === flight.id)
      if (pos) {
        map.flyTo({ center: [pos.lng, pos.lat], zoom: 5, duration: 1800 })
        return
      }
      const [lng, lat] = interpolateGreatCircle(flight.depLng, flight.depLat, flight.arrLng, flight.arrLat, 0.5)
      map.flyTo({ center: [lng, lat], zoom: 4, duration: 1800 })
    },
    [positions],
  )

  const handleClick = useCallback(
    (e: MapMouseEvent) => {
      const feature = e.features?.[0]
      if (!feature || feature.layer?.id !== 'aircraft-icons') return
      const fId = feature.properties?.id as string
      const flight = flightById.get(fId)
      if (!flight) return
      if (onFlightClick) onFlightClick(flight.id)
      else openFlightInfo(flight.id)
    },
    [flightById, openFlightInfo, onFlightClick],
  )

  return (
    <div ref={containerRef} className="wm-root absolute inset-0">
      <MapGL
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={initialViewState}
        projection={GLOBE_PROJECTION}
        mapStyle={mapStyle}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        onLoad={handleMapLoad}
        onStyleData={handleStyleData}
        interactiveLayerIds={INTERACTIVE_LAYERS}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        cursor={hoveredFlight || hoveredAirport ? 'pointer' : 'grab'}
        fog={useDarkFog ? DARK_FOG : LIGHT_FOG}
      >
        <WorldMapLayers
          airports={airports}
          flights={filteredFlights}
          positions={positions}
          now={now}
          acTypeColors={acTypeColors}
          isDark={isDark}
          highlightFlightId={highlightFlightId}
          onHoverFlight={() => {}}
          onHoverAirport={() => {}}
          onClickFlight={() => {}}
        />
      </MapGL>

      <WorldMapOverlays
        isDark={isDark}
        uiZoom={uiZoom}
        showFilter={showFilter}
        showSearch={showSearch}
        showStatsBar={showStatsBar}
        showKpiPanels={showKpiPanels}
        flights={flights}
        aircraftTypes={aircraftTypes}
        filter={filter}
        setFilter={setFilter}
        mapStyleKey={mapStyleKey}
        setMapStyleKey={setMapStyleKey}
        filterCollapsed={filterCollapsed}
        setFilterCollapsed={setFilterCollapsed}
        otpTarget={otpTarget}
        setOtpTarget={setOtpTarget}
        lfTarget={lfTarget}
        setLfTarget={setLfTarget}
        tatTargetMin={tatTargetMin}
        setTatTargetMin={setTatTargetMin}
        fuelTargetPct={fuelTargetPct}
        setFuelTargetPct={setFuelTargetPct}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSelectFlight={(flight) => {
          setCommittedSearch(flight.flightNumber)
          setSearchQuery(flight.flightNumber)
          handleFlyToFlight(flight)
        }}
        onClearSearch={() => {
          setSearchQuery('')
          setCommittedSearch('')
        }}
        utcTime={utcTime}
        now={now}
        activeKpis={activeKpis}
        onToggleKpi={toggleKpi}
        hoveredFlight={hoveredFlight}
        hoveredAirport={hoveredAirport}
        flightInfoOpen={flightInfoOpen}
        airportDepCounts={airportCounts.dep}
        airportArrCounts={airportCounts.arr}
      />

      <FlightInformationDialog />
    </div>
  )
}
