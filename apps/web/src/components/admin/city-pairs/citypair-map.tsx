'use client'

import { useRef, useEffect, useState, useMemo } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useTheme } from '@/components/theme-provider'

interface CityPairMapProps {
  lat1: number
  lon1: number
  lat2: number
  lon2: number
  label1: string
  label2: string
  distanceNm?: number | null
  distanceKm?: number | null
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

/** Haversine great circle intermediate points → [lon, lat] */
function greatCirclePoints(lat1: number, lon1: number, lat2: number, lon2: number, n = 100): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI
  const lat1r = toRad(lat1),
    lon1r = toRad(lon1)
  const lat2r = toRad(lat2),
    lon2r = toRad(lon2)
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat1r - lat2r) / 2) ** 2 + Math.cos(lat1r) * Math.cos(lat2r) * Math.sin((lon1r - lon2r) / 2) ** 2,
      ),
    )
  if (d === 0) return [[lon1, lat1]]
  const pts: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const f = i / n
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(lat1r) * Math.cos(lon1r) + B * Math.cos(lat2r) * Math.cos(lon2r)
    const y = A * Math.cos(lat1r) * Math.sin(lon1r) + B * Math.cos(lat2r) * Math.sin(lon2r)
    const z = A * Math.sin(lat1r) + B * Math.sin(lat2r)
    pts.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))])
  }
  return pts
}

// ── Continuous light beam overlay ──
// A smooth beam of light travels A→B then B→A in a seamless loop.
// The beam has a soft gradient head/tail and a glow filter for premium feel.
const CYCLE_MS = 5000 // full A→B→A round trip
const BEAM_FRACTION = 0.15 // beam length as fraction of route

function PingPongGlow({ map, points, color }: { map: mapboxgl.Map; points: [number, number][]; color: string }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!map || !svgRef.current || points.length < 2) return
    const svg = svgRef.current
    let cancelled = false
    let animId = 0

    while (svg.firstChild) svg.removeChild(svg.firstChild)

    const ns = 'http://www.w3.org/2000/svg'

    // Defs — gradient for static line fade + glow filter
    const defs = document.createElementNS(ns, 'defs')

    const fadeGrad = document.createElementNS(ns, 'linearGradient')
    fadeGrad.setAttribute('id', 'routeFade')
    fadeGrad.setAttribute('gradientUnits', 'userSpaceOnUse')
    ;[
      { offset: '0%', opacity: '0' },
      { offset: '10%', opacity: '1' },
      { offset: '90%', opacity: '1' },
      { offset: '100%', opacity: '0' },
    ].forEach((s) => {
      const stop = document.createElementNS(ns, 'stop')
      stop.setAttribute('offset', s.offset)
      stop.setAttribute('stop-color', color)
      stop.setAttribute('stop-opacity', s.opacity)
      fadeGrad.appendChild(stop)
    })
    defs.appendChild(fadeGrad)

    // Glow filter
    const filter = document.createElementNS(ns, 'filter')
    filter.setAttribute('id', 'beamGlow')
    filter.setAttribute('x', '-50%')
    filter.setAttribute('y', '-50%')
    filter.setAttribute('width', '200%')
    filter.setAttribute('height', '200%')
    const blur = document.createElementNS(ns, 'feGaussianBlur')
    blur.setAttribute('in', 'SourceGraphic')
    blur.setAttribute('stdDeviation', '3')
    blur.setAttribute('result', 'blur')
    filter.appendChild(blur)
    const merge = document.createElementNS(ns, 'feMerge')
    const mn1 = document.createElementNS(ns, 'feMergeNode')
    mn1.setAttribute('in', 'blur')
    const mn2 = document.createElementNS(ns, 'feMergeNode')
    mn2.setAttribute('in', 'SourceGraphic')
    merge.appendChild(mn1)
    merge.appendChild(mn2)
    filter.appendChild(merge)
    defs.appendChild(filter)

    svg.appendChild(defs)

    const g = document.createElementNS(ns, 'g')

    // Static faint route line
    const staticPath = document.createElementNS(ns, 'path')
    staticPath.setAttribute('fill', 'none')
    staticPath.setAttribute('stroke', 'url(#routeFade)')
    staticPath.setAttribute('stroke-opacity', '0.18')
    staticPath.setAttribute('stroke-width', '1.5')
    staticPath.setAttribute('stroke-linejoin', 'round')
    g.appendChild(staticPath)

    // Beam path (the moving light)
    const beamPath = document.createElementNS(ns, 'path')
    beamPath.setAttribute('fill', 'none')
    beamPath.setAttribute('stroke', color)
    beamPath.setAttribute('stroke-width', '2.5')
    beamPath.setAttribute('stroke-linecap', 'round')
    beamPath.setAttribute('stroke-linejoin', 'round')
    beamPath.setAttribute('filter', 'url(#beamGlow)')
    g.appendChild(beamPath)

    svg.appendChild(g)

    let totalLength = 0
    let beamLen = 0

    function buildPath() {
      const projected = points.map(([lng, lat]) => {
        const pt = map.project([lng, lat])
        return [pt.x, pt.y] as [number, number]
      })
      const d = 'M' + projected.map(([x, y]) => `${x},${y}`).join('L')
      staticPath.setAttribute('d', d)
      beamPath.setAttribute('d', d)

      if (projected.length >= 2) {
        fadeGrad.setAttribute('x1', String(projected[0][0]))
        fadeGrad.setAttribute('y1', String(projected[0][1]))
        fadeGrad.setAttribute('x2', String(projected[projected.length - 1][0]))
        fadeGrad.setAttribute('y2', String(projected[projected.length - 1][1]))
      }

      totalLength = beamPath.getTotalLength()
      beamLen = totalLength * BEAM_FRACTION
    }

    buildPath()

    const startTime = performance.now()

    function animate(time: number) {
      if (cancelled) return
      if (totalLength <= 0) {
        animId = requestAnimationFrame(animate)
        return
      }

      // t goes 0→1 over CYCLE_MS, continuously
      const elapsed = (time - startTime) % CYCLE_MS
      const t = elapsed / CYCLE_MS

      // Smooth ping-pong: 0→1 (forward) then 1→0 (reverse)
      // Use sine easing for buttery smooth acceleration/deceleration
      const pingPong =
        t < 0.5
          ? (1 - Math.cos(t * 2 * Math.PI)) / 2 // 0→1 with ease
          : (1 + Math.cos((t - 0.5) * 2 * Math.PI)) / 2 // 1→0 with ease

      // Beam position: offset from start
      const offset = pingPong * (totalLength - beamLen)

      // Use dash-array: [beamLen, totalLength] with offset
      beamPath.setAttribute('stroke-dasharray', `${beamLen} ${totalLength}`)
      beamPath.setAttribute('stroke-dashoffset', String(-offset))

      // Fade beam opacity slightly at endpoints for softness
      const edgeDist = Math.min(offset, totalLength - beamLen - offset)
      const edgeFade = Math.min(1, edgeDist / (beamLen * 0.8))
      beamPath.setAttribute('stroke-opacity', String(edgeFade))

      animId = requestAnimationFrame(animate)
    }

    animId = requestAnimationFrame(animate)

    const handler = () => buildPath()
    map.on('move', handler)
    map.on('zoom', handler)
    map.on('resize', handler)

    return () => {
      cancelled = true
      cancelAnimationFrame(animId)
      map.off('move', handler)
      map.off('zoom', handler)
      map.off('resize', handler)
      while (svg.firstChild) svg.removeChild(svg.firstChild)
    }
  }, [map, points, color])

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ overflow: 'visible', zIndex: 1 }}
    />
  )
}

// ── Main component ──

export function CityPairMap({ lat1, lon1, lat2, lon2, label1, label2, distanceNm, distanceKm }: CityPairMapProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [style, setStyle] = useState<'streets' | 'satellite'>('streets')
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const accent = isDark ? '#60a5fa' : '#3b82f6'

  const gcPoints = useMemo(() => greatCirclePoints(lat1, lon1, lat2, lon2), [lat1, lon1, lat2, lon2])

  // Effect 1: Create the map ONCE (only recreate on style/theme change)
  useEffect(() => {
    if (!containerRef.current || !TOKEN) return

    const mapStyle =
      style === 'satellite'
        ? 'mapbox://styles/mapbox/satellite-streets-v12'
        : isDark
          ? 'mapbox://styles/mapbox/dark-v11'
          : 'mapbox://styles/mapbox/light-v11'

    const map = new mapboxgl.Map({
      container: containerRef.current,
      accessToken: TOKEN,
      style: mapStyle,
      center: [(lon1 + lon2) / 2, (lat1 + lat2) / 2],
      zoom: 5,
      projection: 'globe' as any,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: false,
    })

    map.addControl(new mapboxgl.AttributionControl({ compact: true }))

    let removed = false
    const safeResize = () => {
      if (!removed) map.resize()
    }

    const ro = new ResizeObserver(() => requestAnimationFrame(safeResize))
    if (wrapperRef.current) ro.observe(wrapperRef.current)

    map.on('load', () => {
      safeResize()
      setMapReady(true)
    })

    setMapInstance(map)

    return () => {
      removed = true
      ro.disconnect()
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      map.remove()
      setMapInstance(null)
      setMapReady(false)
    }
  }, [style, isDark])

  // Effect 2: Update markers and fly to new bounds when citypair changes
  useEffect(() => {
    if (!mapInstance || !mapReady) return

    // Remove old markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    const markerColor = isDark ? '#60a5fa' : '#3b82f6'

    ;[
      { lon: lon1, lat: lat1, label: label1 },
      { lon: lon2, lat: lat2, label: label2 },
    ].forEach(({ lon, lat, label }) => {
      const dot = document.createElement('div')
      dot.style.cssText = `width:16px;height:16px;background:${markerColor};border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35);`
      const dotMarker = new mapboxgl.Marker({ element: dot, anchor: 'center' }).setLngLat([lon, lat]).addTo(mapInstance)
      markersRef.current.push(dotMarker)

      const lbl = document.createElement('div')
      lbl.style.cssText =
        'padding:1px 6px;border-radius:8px;font-size:13px;font-weight:700;color:white;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);white-space:nowrap;'
      lbl.textContent = label
      const lblMarker = new mapboxgl.Marker({ element: lbl, anchor: 'top', offset: [0, 12] })
        .setLngLat([lon, lat])
        .addTo(mapInstance)
      markersRef.current.push(lblMarker)
    })

    // Fly to new bounds with smooth animation
    const bounds = new mapboxgl.LngLatBounds()
    bounds.extend([lon1, lat1])
    bounds.extend([lon2, lat2])
    mapInstance.fitBounds(bounds, { padding: 50, maxZoom: 8, duration: 1200, essential: true })
  }, [mapInstance, mapReady, lat1, lon1, lat2, lon2, label1, label2, isDark])

  if (!TOKEN) {
    return (
      <div className="flex items-center justify-center h-full bg-hz-card text-[14px] text-hz-text-secondary">
        Mapbox token not configured
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className="relative h-full w-full">
      <div ref={containerRef} className="!absolute inset-0 h-full w-full" />

      {/* Animated route glow overlay */}
      {mapInstance && <PingPongGlow map={mapInstance} points={gcPoints} color={accent} />}

      {/* Distance overlay */}
      {distanceNm != null && (
        <div className="absolute top-3 left-3 pointer-events-none flex items-center gap-2" style={{ zIndex: 2 }}>
          <span
            className="px-2.5 py-1 rounded-lg text-[13px] font-medium backdrop-blur-md"
            style={{
              background: isDark ? 'rgba(30,30,34,0.85)' : 'rgba(255,255,255,0.88)',
              color: isDark ? '#e4e4e7' : '#111',
              border: `0.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            {distanceNm.toLocaleString()} nm
          </span>
          {distanceKm != null && (
            <span
              className="px-2.5 py-1 rounded-lg text-[13px] font-medium backdrop-blur-md"
              style={{
                background: isDark ? 'rgba(30,30,34,0.85)' : 'rgba(255,255,255,0.88)',
                color: isDark ? '#e4e4e7' : '#111',
                border: `0.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'}`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              {distanceKm.toLocaleString()} km
            </span>
          )}
        </div>
      )}

      {/* Style toggle */}
      <button
        onClick={() => setStyle((s) => (s === 'streets' ? 'satellite' : 'streets'))}
        className="absolute top-2 right-2 px-2.5 py-1 rounded-lg text-[13px] font-semibold shadow-sm hover:shadow-md transition-shadow backdrop-blur-md"
        style={{
          background: isDark ? 'rgba(30,30,34,0.85)' : 'rgba(255,255,255,0.9)',
          color: isDark ? '#e4e4e7' : '#333',
          border: `0.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'}`,
          zIndex: 2,
        }}
      >
        {style === 'streets' ? 'Satellite' : 'Streets'}
      </button>
    </div>
  )
}
