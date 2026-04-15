'use client'

import { useMemo, useCallback, useState, useEffect } from 'react'
import { Source, Layer, Marker, useMap } from 'react-map-gl/mapbox'
import type { WorldMapFlight, WorldMapAirport, FlightPosition } from './world-map-types'
import { sampleArc, getFlightMapStatus } from './world-map-types'
import { classifyAircraft, CLASS_ICON_SIZE } from '@/lib/world-map/aircraft-classes'
import { resolveAircraftShape, GENERATED_ICON_SIZE } from '@/lib/world-map/aircraft-silhouette'
import { isDelayedFlight } from './world-map-stats'

interface WorldMapLayersProps {
  airports: WorldMapAirport[]
  flights: WorldMapFlight[]
  positions: FlightPosition[]
  now: Date
  acTypeColors: Record<string, string>
  isDark?: boolean
  highlightFlightId?: string | null
  onHoverFlight: (flight: WorldMapFlight | null, point: { x: number; y: number }) => void
  onHoverAirport: (airport: WorldMapAirport | null, point: { x: number; y: number }) => void
  onClickFlight: (flight: WorldMapFlight) => void
}

const ARC_COLORS: Record<string, string> = {
  airborne: '#8b8fa3',
  ground: '#8b8fa3',
  delayed: '#ef4444',
  completed: '#8b8fa3',
  scheduled: '#8b8fa3',
}

/** Shared viewport offset for the status dot + halo — right of the
 *  aircraft silhouette with enough padding to clear an A380. */
const DOT_OFFSET: [number, number] = [28, -6]

/** Shared color expression used by both the solid dot and the halo ring. */
const STATUS_COLOR_EXPR = [
  'case',
  ['get', 'isDelayed'],
  '#FF3B3B',
  ['==', ['get', 'status'], 'airborne'],
  '#06C270',
  ['==', ['get', 'status'], 'ground'],
  '#0063F7',
  ['==', ['get', 'status'], 'scheduled'],
  '#0063F7',
  '#8b8fa3',
]

export function WorldMapLayers({
  airports,
  flights,
  positions,
  now,
  acTypeColors,
  isDark = true,
  highlightFlightId,
  onHoverFlight,
  onHoverAirport,
  onClickFlight,
}: WorldMapLayersProps) {
  // ── Airport GeoJSON ──
  const airportGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: airports.map((a) => ({
        type: 'Feature' as const,
        id: a.iataCode,
        properties: { iata: a.iataCode, name: a.name, isHub: a.isHub },
        geometry: { type: 'Point' as const, coordinates: [a.lng, a.lat] },
      })),
    }),
    [airports],
  )

  // ── Flight arc GeoJSON ──
  const arcGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: flights.map((f) => {
        const status = getFlightMapStatus(f, now)
        const coords = sampleArc(f.depLng, f.depLat, f.arrLng, f.arrLat)
        return {
          type: 'Feature' as const,
          properties: { id: f.id, status, color: ARC_COLORS[status] || '#475569' },
          geometry: { type: 'LineString' as const, coordinates: coords },
        }
      }),
    }),
    [flights],
  )

  // ── Aircraft position GeoJSON ──
  const aircraftGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: positions.map((p) => {
        const acType = p.flight.aircraftTypeIcao || ''
        const acClass = classifyAircraft(acType)
        const hasTint = acType && acType in acTypeColors
        const iconKey = hasTint ? `aircraft-${acClass}-${acType}` : `aircraft-${acClass}`
        // If we've got a real parametric shape for this ICAO, the SVG
        // already encodes correct wingspan — use uniform size. Otherwise
        // the class-level fallback still needs per-class scaling.
        const hasGeneratedShape = resolveAircraftShape(acType) !== null
        const iconSize = hasGeneratedShape ? GENERATED_ICON_SIZE : CLASS_ICON_SIZE[acClass]
        const status = getFlightMapStatus(p.flight, now)
        return {
          type: 'Feature' as const,
          id: p.id,
          properties: {
            id: p.id,
            flightNumber: p.flight.flightNumber,
            bearing: p.bearing,
            status,
            isDelayed: isDelayedFlight(p.flight),
            acType,
            acClass,
            iconKey,
            iconSize,
          },
          geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        }
      }),
    }),
    [positions, now, acTypeColors],
  )

  // ── Lookup maps for hover ──
  const flightById = useMemo(() => {
    const m = new Map<string, WorldMapFlight>()
    for (const f of flights) m.set(f.id, f)
    return m
  }, [flights])

  const airportByIata = useMemo(() => {
    const m = new Map<string, WorldMapAirport>()
    for (const a of airports) m.set(a.iataCode, a)
    return m
  }, [airports])

  return (
    <>
      {/* Airport layers */}
      <Source id="airports" type="geojson" data={airportGeoJson}>
        <Layer
          id="airport-outer"
          type="circle"
          paint={{
            'circle-radius': ['case', ['get', 'isHub'], 12, 6] as any,
            'circle-color': '#3b82f6',
            'circle-opacity': ['case', ['get', 'isHub'], 0.15, 0.08] as any,
          }}
        />
        <Layer
          id="airport-dot"
          type="circle"
          paint={{
            'circle-radius': ['case', ['get', 'isHub'], 4, 2.5] as any,
            'circle-color': '#3b82f6',
            'circle-opacity': 0.7,
          }}
        />
      </Source>

      {/* Flight arc layers */}
      <Source id="flight-arcs" type="geojson" data={arcGeoJson}>
        <Layer
          id="flight-arcs"
          type="line"
          paint={{
            'line-color': ['get', 'color'] as any,
            'line-width': 1.2,
            'line-opacity': [
              'case',
              ['==', ['get', 'status'], 'airborne'],
              0.6,
              ['==', ['get', 'status'], 'ground'],
              0.4,
              0.15,
            ] as any,
          }}
          layout={{
            'line-cap': 'round',
            'line-join': 'round',
          }}
        />
      </Source>

      {/* Aircraft position layers */}
      <Source id="aircraft" type="geojson" data={aircraftGeoJson}>
        {/* Shadow / backlight pass — blurred, flat-color clone of each
            silhouette rendered slightly below and behind the main icon
            for a visionOS-style sense of depth. */}
        <Layer
          id="aircraft-shadow"
          type="symbol"
          layout={{
            'icon-image': ['concat', 'shadow-', ['get', 'iconKey']] as any,
            'icon-size': ['get', 'iconSize'] as any,
            'icon-rotate': ['get', 'bearing'] as any,
            'icon-rotation-alignment': 'map',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          }}
          paint={{
            'icon-opacity': 1,
            // Light mode: small drop-shadow offset. Dark mode: zero offset
            // so the soft light glow reads as a symmetric backlight.
            'icon-translate': isDark ? [0, 0] : [0, 3],
            'icon-translate-anchor': 'viewport',
          }}
        />
        <Layer
          id="aircraft-icons"
          type="symbol"
          layout={{
            'icon-image': ['get', 'iconKey'] as any,
            'icon-size': ['get', 'iconSize'] as any,
            'icon-rotate': ['get', 'bearing'] as any,
            'icon-rotation-alignment': 'map',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          }}
          paint={{
            'icon-opacity': 0.95,
          }}
        />
        {/* Status halo — larger ring, radar-pings (radius grows, opacity
            fades) via StatusDotPulse below. Rendered BELOW the solid dot
            so the solid stays crisp. */}
        <Layer
          id="aircraft-status-halo"
          type="circle"
          filter={['!=', ['get', 'status'], 'completed'] as any}
          paint={{
            'circle-radius': 5,
            'circle-color': STATUS_COLOR_EXPR as any,
            'circle-stroke-width': 0,
            'circle-opacity': 0.6,
            'circle-translate': DOT_OFFSET,
            'circle-translate-anchor': 'viewport',
          }}
        />
        {/* Solid status dot — steady, crisp, the attention anchor. */}
        <Layer
          id="aircraft-status-dot"
          type="circle"
          filter={['!=', ['get', 'status'], 'completed'] as any}
          paint={{
            'circle-radius': 4,
            'circle-color': STATUS_COLOR_EXPR as any,
            'circle-stroke-width': 1.2,
            'circle-stroke-color': 'rgba(0,0,0,0.55)',
            'circle-opacity': 1,
            'circle-translate': DOT_OFFSET,
            'circle-translate-anchor': 'viewport',
          }}
        />
        <StatusDotPulse />
      </Source>

      {/* Highlight ring around selected flight */}
      {highlightFlightId && <HighlightRing positions={positions} flightId={highlightFlightId} />}
    </>
  )
}

/** Animated highlight ring that follows a flight's position */
function HighlightRing({ positions, flightId }: { positions: FlightPosition[]; flightId: string }) {
  const [phase, setPhase] = useState<'in' | 'visible' | 'out'>('in')

  useEffect(() => {
    // fade in → visible → fade out
    const t1 = setTimeout(() => setPhase('visible'), 50)
    const t2 = setTimeout(() => setPhase('out'), 2400)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [flightId])

  const pos = positions.find((p) => p.flight.id === flightId)
  if (!pos) return null

  const opacity = phase === 'in' ? 0 : phase === 'out' ? 0 : 1

  return (
    <Marker longitude={pos.lng} latitude={pos.lat} anchor="center">
      <div
        style={{
          opacity,
          transition:
            phase === 'in'
              ? 'opacity 400ms ease-out'
              : phase === 'out'
                ? 'opacity 600ms ease-in'
                : 'opacity 400ms ease-out',
          pointerEvents: 'none',
        }}
      >
        {/* Outer pulse ring */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: '2px solid rgba(239, 68, 68, 0.35)',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            animation: 'highlight-pulse 1.5s ease-in-out infinite',
          }}
        />
        {/* Inner ring */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: '2.5px solid rgba(239, 68, 68, 0.7)',
            boxShadow: '0 0 12px rgba(239, 68, 68, 0.3), inset 0 0 8px rgba(239, 68, 68, 0.1)',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>
    </Marker>
  )
}

/** Interactive layer IDs for the map's onMouseMove/onClick */
export const INTERACTIVE_LAYERS = ['aircraft-icons', 'airport-dot']

/**
 * Slowly pulses the status halo's radius + opacity so each aircraft reads
 * like a live transmission. Runs one rAF loop regardless of flight count
 * (all halos share the same paint property), so cost is O(1) per frame.
 */
function StatusDotPulse() {
  const { current: mapRef } = useMap()

  useEffect(() => {
    if (!mapRef) return
    const map = mapRef.getMap()
    const PERIOD_MS = 1600
    const MIN_R = 5
    const MAX_R = 14
    const MAX_OPACITY = 0.55
    let raf = 0
    let start = 0

    const tick = (t: number) => {
      if (!start) start = t
      const phase = ((t - start) % PERIOD_MS) / PERIOD_MS // 0..1
      // Radius grows linearly; opacity fades on a quadratic ease-out so
      // the ring feels like it's propagating outward, not breathing.
      const radius = MIN_R + (MAX_R - MIN_R) * phase
      const opacity = MAX_OPACITY * (1 - phase) * (1 - phase)
      try {
        if (map.getLayer('aircraft-status-halo')) {
          map.setPaintProperty('aircraft-status-halo', 'circle-radius', radius)
          map.setPaintProperty('aircraft-status-halo', 'circle-opacity', opacity)
        }
      } catch {
        // Map torn down mid-frame — ignore.
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [mapRef])

  return null
}
