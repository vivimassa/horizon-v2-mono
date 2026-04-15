'use client'

import { useState, useEffect, useMemo, useCallback, useRef, startTransition } from 'react'
import { useTheme } from '@/components/theme-provider'
import MapGL, { type MapMouseEvent, type MapRef } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { getWorldMapFlights, getWorldMapAirports, getAircraftTypeColors } from '@/lib/world-map/api'
import {
  AIRCRAFT_CLASSES,
  CLASS_SVG_PATH,
  classifyAircraft,
  type AircraftClass,
} from '@/lib/world-map/aircraft-classes'
import { generateAircraftSvg, resolveAircraftShape } from '@/lib/world-map/aircraft-silhouette'
import { FlightInformationDialog } from '@/components/network/gantt/flight-information/flight-information-dialog'
import { useGanttStore } from '@/stores/use-gantt-store'
import { useDockStore } from '@/lib/dock-store'
import { WorldMapLayers, INTERACTIVE_LAYERS } from './world-map-layers'
import { WorldMapFilter } from './world-map-filter'
import { WorldMapSearch } from './world-map-search'
import { WorldMapClockDock } from './world-map-clock-dock'
import { WorldMapStats } from './world-map-stats'
import { WorldMapKpiPanels } from './world-map-kpi-panels'
import { FlightTooltip, AirportTooltip } from './world-map-tooltip'
import type {
  WorldMapFlight,
  WorldMapAirport,
  FlightPosition,
  MapFilter,
  MapStyleKey,
  KpiMode,
} from './world-map-types'
import {
  EMPTY_FILTER,
  MAP_STYLES,
  interpolateGreatCircle,
  computeFlightProgress,
  getFlightMapStatus,
} from './world-map-types'
import './world-map.css'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
const REFRESH_MS = 30_000
const POSITION_UPDATE_MS = 5_000

function formatUtcNow(): string {
  const d = new Date()
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function todayStr(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function useUiZoom(): number {
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    function calc() {
      const w = window.innerWidth
      const z = Math.max(0.75, Math.min(w / 1920, 1.5))
      setZoom(Math.round(z * 100) / 100)
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])
  return zoom
}

export function WorldMapShell() {
  const uiZoom = useUiZoom()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [flights, setFlights] = useState<WorldMapFlight[]>([])
  const [airports, setAirports] = useState<WorldMapAirport[]>([])
  const [filter, setFilter] = useState<MapFilter>(EMPTY_FILTER)
  const [utcTime, setUtcTime] = useState(formatUtcNow)
  const [now, setNow] = useState(() => new Date())

  const mapRef = useRef<MapRef>(null)
  const [, setMapReady] = useState(false)
  const [acTypeColors, setAcTypeColors] = useState<Record<string, string>>({})

  const classImagesRef = useRef<Partial<Record<AircraftClass, HTMLImageElement>>>({})
  // ICAO → Image generated from the parametric silhouette registry, or
  // `false` if the ICAO has no registered shape. Cached for the session.
  const generatedImagesRef = useRef<Record<string, HTMLImageElement | false>>({})

  // Look up the aircraft's real-world dimensions in the shape registry,
  // build an SVG at runtime, and preload it as an <img>. Returns null if
  // the ICAO isn't registered (caller then falls back to class SVG).
  const loadGeneratedImage = useCallback((icao: string): Promise<HTMLImageElement | null> => {
    const cached = generatedImagesRef.current[icao]
    if (cached === false) return Promise.resolve(null)
    if (cached) return Promise.resolve(cached)
    const shape = resolveAircraftShape(icao)
    if (!shape) {
      generatedImagesRef.current[icao] = false
      return Promise.resolve(null)
    }
    const svg = generateAircraftSvg(shape)
    const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        generatedImagesRef.current[icao] = img
        resolve(img)
      }
      img.onerror = () => {
        generatedImagesRef.current[icao] = false
        resolve(null)
      }
      img.src = url
    })
  }, [])

  const createTintedIcon = useCallback((img: HTMLImageElement, tintColor: string): ImageData => {
    const w = img.naturalWidth || 256
    const h = img.naturalHeight || 256
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, w, h)
    ctx.globalCompositeOperation = 'source-atop'
    const rc = parseInt(tintColor.slice(1, 3), 16)
    const gc = parseInt(tintColor.slice(3, 5), 16)
    const bc = parseInt(tintColor.slice(5, 7), 16)
    const grey = Math.round(rc * 0.299 + gc * 0.587 + bc * 0.114)
    const desat = 0.2
    const r = Math.round(rc + (grey - rc) * desat)
    const g = Math.round(gc + (grey - gc) * desat)
    const b = Math.round(bc + (grey - bc) * desat)
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(0, 0, w, h)
    return ctx.getImageData(0, 0, w, h)
  }, [])

  /**
   * Build a blurred, flat-color version of the aircraft silhouette. Used
   * as a drop shadow / backlight pass underneath the main icon to give it
   * depth (visionOS aesthetic). Canvas' `filter: blur()` softens the
   * shape; source-atop then flattens it to a single color + alpha.
   */
  const createShadowIcon = useCallback(
    (img: HTMLImageElement, shadowColor: string, alpha: number, blurPx: number): ImageData => {
      const w = img.naturalWidth || 256
      const h = img.naturalHeight || 256
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.filter = `blur(${blurPx}px)`
      ctx.drawImage(img, 0, 0, w, h)
      ctx.filter = 'none'
      ctx.globalCompositeOperation = 'source-atop'
      const rc = parseInt(shadowColor.slice(1, 3), 16)
      const gc = parseInt(shadowColor.slice(3, 5), 16)
      const bc = parseInt(shadowColor.slice(5, 7), 16)
      ctx.fillStyle = `rgba(${rc},${gc},${bc},${alpha})`
      ctx.fillRect(0, 0, w, h)
      return ctx.getImageData(0, 0, w, h)
    },
    [],
  )

  // Single neutral tint for all aircraft. Cool-gray with a subtle blue
  // tilt rather than pure white/black — reads premium on both themes.
  // Status is carried by a separate dot layer, not the silhouette fill.
  const neutralTint = isDark ? '#B8BBC6' : '#5A5C66'

  // Shadow / backlight for the visionOS feel.
  // - Light mode: soft dark shadow, slightly stronger.
  // - Dark mode: soft light glow that makes the silhouette feel backlit.
  const shadowColor = isDark ? '#FFFFFF' : '#000000'
  const shadowAlpha = isDark ? 0.18 : 0.28
  const shadowBlurPx = isDark ? 5 : 4

  const addAircraftIcons = useCallback(
    async (map: any) => {
      const images = classImagesRef.current
      const register = (key: string, source: HTMLImageElement) => {
        if (!map.hasImage(key)) {
          map.addImage(key, createTintedIcon(source, neutralTint))
        }
        const shadowKey = `shadow-${key}`
        if (!map.hasImage(shadowKey)) {
          map.addImage(shadowKey, createShadowIcon(source, shadowColor, shadowAlpha, shadowBlurPx))
        }
      }

      // Class-level fallback (used when an ICAO isn't in the shape registry).
      for (const cls of AIRCRAFT_CLASSES) {
        const img = images[cls]
        if (!img || !img.complete) continue
        register(`aircraft-${cls}`, img)
      }
      // Per-ICAO variants. Prefer the parametrically generated silhouette
      // (real wingspan + engine layout) when the ICAO is in the registry;
      // otherwise tint the class-level fallback.
      for (const icao of Object.keys(acTypeColors)) {
        const cls = classifyAircraft(icao)
        const key = `aircraft-${cls}-${icao}`
        if (map.hasImage(key) && map.hasImage(`shadow-${key}`)) continue

        const generated = await loadGeneratedImage(icao)
        const source = generated ?? images[cls]
        if (!source || !source.complete) continue
        register(key, source)
      }
    },
    [
      acTypeColors,
      createTintedIcon,
      createShadowIcon,
      loadGeneratedImage,
      neutralTint,
      shadowColor,
      shadowAlpha,
      shadowBlurPx,
    ],
  )

  useEffect(() => {
    // Preload one SVG per class into an <img> so the tint pipeline can
    // rasterize them to canvas. Each class SVG ships at 256×256 but the
    // silhouette inside is sized proportionally to real wingspan, and we
    // also scale by class via Mapbox's icon-size expression.
    for (const cls of AIRCRAFT_CLASSES) {
      const img = new Image()
      img.src = CLASS_SVG_PATH[cls]
      img.onload = () => {
        classImagesRef.current[cls] = img
        const map = mapRef.current?.getMap()
        if (map) addAircraftIcons(map)
      }
    }
    getAircraftTypeColors()
      .then(setAcTypeColors)
      .catch(() => {})
    // addAircraftIcons is re-created when colors arrive; this effect runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-collapse the bottom nav dock on this page (focus workspace).
  useEffect(() => {
    useDockStore.getState().collapse()
  }, [])

  // Re-register icons when colors arrive (post-mount) or when the theme
  // flips. On theme change we have to remove the existing images first so
  // the new neutral tint takes effect (addAircraftIcons skips keys that
  // already exist).
  const lastTintRef = useRef(neutralTint)
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !map.loaded()) return
    if (lastTintRef.current !== neutralTint) {
      const removeBoth = (key: string) => {
        if (map.hasImage(key)) map.removeImage(key)
        const sk = `shadow-${key}`
        if (map.hasImage(sk)) map.removeImage(sk)
      }
      for (const cls of AIRCRAFT_CLASSES) removeBoth(`aircraft-${cls}`)
      for (const icao of Object.keys(acTypeColors)) {
        const cls = classifyAircraft(icao)
        removeBoth(`aircraft-${cls}-${icao}`)
      }
      lastTintRef.current = neutralTint
    }
    addAircraftIcons(map)
  }, [acTypeColors, addAircraftIcons, neutralTint])

  const handleMapLoad = useCallback(
    (e: any) => {
      addAircraftIcons(e.target)
      setMapReady(true)
    },
    [addAircraftIcons],
  )

  const handleStyleData = useCallback(
    (e: any) => {
      const map = e.target
      setTimeout(() => addAircraftIcons(map), 100)
    },
    [addAircraftIcons],
  )

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
  const [searchQuery, setSearchQuery] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [f, a] = await Promise.all([getWorldMapFlights(todayStr()), getWorldMapAirports()])
        startTransition(() => {
          setFlights(f)
          setAirports(a)
        })
      } catch (err) {
        console.error('[world-map] load failed', err)
      }
    }
    load()
    const iv = setInterval(() => {
      getWorldMapFlights(todayStr())
        .then((f) => startTransition(() => setFlights(f)))
        .catch(() => {})
    }, REFRESH_MS)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const iv = setInterval(() => {
      setNow(new Date())
      setUtcTime(formatUtcNow())
    }, POSITION_UPDATE_MS)
    return () => clearInterval(iv)
  }, [])

  const aircraftTypes = useMemo(() => {
    const s = new Set<string>()
    for (const f of flights) if (f.aircraftTypeIcao) s.add(f.aircraftTypeIcao)
    return Array.from(s).sort()
  }, [flights])

  const filteredFlights = useMemo(() => {
    return flights.filter((f) => {
      if (filter.aircraftTypes.length && (!f.aircraftTypeIcao || !filter.aircraftTypes.includes(f.aircraftTypeIcao)))
        return false
      if (filter.statuses.length) {
        const s = getFlightMapStatus(f)
        if (!filter.statuses.includes(s)) return false
      }
      if (committedSearch) {
        const q = committedSearch.toUpperCase()
        const tail = (f.tailNumber || '').toUpperCase()
        const fn = f.flightNumber.toUpperCase()
        if (!tail.includes(q) && !fn.includes(q)) return false
      }
      return true
    })
  }, [flights, filter, committedSearch])

  const positions = useMemo<FlightPosition[]>(() => {
    const result: FlightPosition[] = []
    for (const f of filteredFlights) {
      const status = getFlightMapStatus(f)
      if (status !== 'airborne') continue
      const progress = computeFlightProgress(f, now)
      if (progress <= 0 || progress >= 1) continue
      const [lng, lat, bearing] = interpolateGreatCircle(f.depLng, f.depLat, f.arrLng, f.arrLat, progress)
      result.push({ id: f.id, lng, lat, bearing, progress, flight: f })
    }
    return result
  }, [filteredFlights, now])

  const airportCounts = useMemo(() => {
    const dep = new Map<string, number>()
    const arr = new Map<string, number>()
    for (const f of filteredFlights) {
      dep.set(f.depStation, (dep.get(f.depStation) || 0) + 1)
      arr.set(f.arrStation, (arr.get(f.arrStation) || 0) + 1)
    }
    return { dep, arr }
  }, [filteredFlights])

  const flightById = useMemo(() => {
    const m = new Map<string, WorldMapFlight>()
    for (const f of filteredFlights) m.set(f.id, f)
    return m
  }, [filteredFlights])

  const airportByIata = useMemo(() => {
    const m = new Map<string, WorldMapAirport>()
    for (const a of airports) m.set(a.iataCode, a)
    return m
  }, [airports])

  const handleMouseMove = useCallback(
    (e: MapMouseEvent) => {
      const feature = e.features?.[0]
      if (!feature) {
        setHoveredFlight(null)
        setHoveredAirport(null)
        return
      }
      const { x, y } = e.point
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
      // Server route returns FlightInstance._id directly — no resolution step needed.
      openFlightInfo(flight.id)
    },
    [flightById, openFlightInfo],
  )

  return (
    <div className="wm-root fixed inset-0 z-0">
      <MapGL
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{ longitude: 106.6, latitude: 16, zoom: 4.5 }}
        projection={{ name: 'globe' } as any}
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
        fog={
          useDarkFog
            ? ({
                color: 'rgb(10, 12, 20)',
                'high-color': 'rgb(20, 24, 45)',
                'horizon-blend': 0.06,
                'space-color': 'rgb(5, 5, 15)',
                'star-intensity': 0.4,
              } as any)
            : ({
                color: 'rgb(220, 225, 235)',
                'high-color': 'rgb(180, 195, 220)',
                'horizon-blend': 0.08,
                'space-color': 'rgb(200, 210, 230)',
                'star-intensity': 0,
              } as any)
        }
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

      <WorldMapFilter
        filter={filter}
        onChange={setFilter}
        aircraftTypes={aircraftTypes}
        isDark={isDark}
        mapStyleKey={mapStyleKey}
        onMapStyleChange={setMapStyleKey}
        collapsed={filterCollapsed}
        onCollapsedChange={setFilterCollapsed}
        otpTarget={otpTarget}
        onOtpTargetChange={setOtpTarget}
        lfTarget={lfTarget}
        onLfTargetChange={setLfTarget}
        tatTargetMin={tatTargetMin}
        onTatTargetChange={setTatTargetMin}
        fuelTargetPct={fuelTargetPct}
        onFuelTargetChange={setFuelTargetPct}
      />

      <WorldMapSearch
        value={searchQuery}
        onChange={setSearchQuery}
        flights={flights}
        now={now}
        isDark={isDark}
        onSelectFlight={(flight) => {
          setCommittedSearch(flight.flightNumber)
          setSearchQuery(flight.flightNumber)
          handleFlyToFlight(flight)
        }}
        onClear={() => {
          setSearchQuery('')
          setCommittedSearch('')
        }}
      />

      <WorldMapClockDock />

      <WorldMapStats
        flights={flights}
        utcTime={utcTime}
        now={now}
        isDark={isDark}
        activeKpis={activeKpis}
        onToggleKpi={toggleKpi}
        uiZoom={uiZoom}
      />

      {activeKpis.length > 0 && (
        <WorldMapKpiPanels
          flights={flights}
          activeKpis={activeKpis}
          filterCollapsed={filterCollapsed}
          otpTarget={otpTarget}
          lfTarget={lfTarget}
          tatTargetMin={tatTargetMin}
          fuelTargetPct={fuelTargetPct}
          uiZoom={uiZoom}
        />
      )}

      {hoveredFlight && !flightInfoOpen && (
        <FlightTooltip
          flight={hoveredFlight.flight}
          x={hoveredFlight.x}
          y={hoveredFlight.y}
          progress={hoveredFlight.progress}
        />
      )}
      {hoveredAirport && (
        <AirportTooltip
          airport={hoveredAirport.airport}
          x={hoveredAirport.x}
          y={hoveredAirport.y}
          depCount={airportCounts.dep.get(hoveredAirport.airport.iataCode) || 0}
          arrCount={airportCounts.arr.get(hoveredAirport.airport.iataCode) || 0}
        />
      )}

      <FlightInformationDialog />
    </div>
  )
}
