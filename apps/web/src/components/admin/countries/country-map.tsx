'use client'

import { useRef, useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useTheme } from '@/components/theme-provider'

interface CountryMapProps {
  iso2: string
  name: string
  officialName: string | null
  latitude: number | null
  longitude: number | null
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

// ISO2 → ISO3166-1 numeric for Mapbox worldview filter
// Mapbox country-boundaries uses ISO 3166-1 alpha-3 in the `iso_3166_1` property
// but we can match on `iso_3166_1_alpha_3` or just use the feature-state approach.

export function CountryMap({ iso2, name, officialName, latitude, longitude }: CountryMapProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [style, setStyle] = useState<'streets' | 'satellite'>('streets')
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => {
    if (!containerRef.current || !TOKEN || !iso2) return

    const mapStyle =
      style === 'satellite'
        ? 'mapbox://styles/mapbox/satellite-streets-v12'
        : isDark
          ? 'mapbox://styles/mapbox/dark-v11'
          : 'mapbox://styles/mapbox/light-v11'

    const center: [number, number] = [longitude ?? 0, latitude ?? 20]

    const map = new mapboxgl.Map({
      container: containerRef.current,
      accessToken: TOKEN,
      style: mapStyle,
      center,
      zoom: 4,
      attributionControl: false,
    })

    map.addControl(new mapboxgl.AttributionControl({ compact: true }))

    let removed = false
    let dashAnimId = 0
    const safeResize = () => {
      if (!removed) map.resize()
    }

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(safeResize)
    })
    if (wrapperRef.current) ro.observe(wrapperRef.current)

    map.on('load', () => {
      safeResize()

      // Fetch GeoJSON border from an open dataset
      const countryCode = iso2.toUpperCase()

      // Use Mapbox's built-in country boundaries (available in all styles)
      // Add a fill layer for the country highlight
      map.addSource('country-boundary', {
        type: 'vector',
        url: 'mapbox://mapbox.country-boundaries-v1',
      })

      // Semi-transparent fill
      map.addLayer({
        id: 'country-fill',
        type: 'fill',
        source: 'country-boundary',
        'source-layer': 'country_boundaries',
        filter: ['==', ['get', 'iso_3166_1'], countryCode],
        paint: {
          'fill-color': isDark ? '#60a5fa' : '#1e40af',
          'fill-opacity': 0.08,
        },
      })

      // Solid border line
      map.addLayer({
        id: 'country-border',
        type: 'line',
        source: 'country-boundary',
        'source-layer': 'country_boundaries',
        filter: ['==', ['get', 'iso_3166_1'], countryCode],
        paint: {
          'line-color': isDark ? '#60a5fa' : '#1e40af',
          'line-width': 2,
          'line-opacity': 0.4,
        },
      })

      // Animated dashed accent border (marching ants effect)
      map.addLayer({
        id: 'country-border-dash',
        type: 'line',
        source: 'country-boundary',
        'source-layer': 'country_boundaries',
        filter: ['==', ['get', 'iso_3166_1'], countryCode],
        paint: {
          'line-color': isDark ? '#60a5fa' : '#3E7BFA',
          'line-width': 2.5,
          'line-opacity': 0.7,
          'line-dasharray': [2, 2],
        },
      })

      // Animate the dash by cycling line-dasharray offset
      let dashStep = 0
      const animateDash = () => {
        dashStep = (dashStep + 0.05) % 4
        if (map.getLayer('country-border-dash')) {
          map.setPaintProperty('country-border-dash', 'line-dasharray', [2, 2, dashStep, 100 - dashStep])
        }
        dashAnimId = requestAnimationFrame(animateDash)
      }
      dashAnimId = requestAnimationFrame(animateDash)

      // Fit map to country bounds
      // Query the rendered features to get the bounding box
      map.once('idle', () => {
        const features = map.querySourceFeatures('country-boundary', {
          sourceLayer: 'country_boundaries',
          filter: ['==', ['get', 'iso_3166_1'], countryCode],
        })

        if (features.length > 0) {
          const bounds = new mapboxgl.LngLatBounds()
          for (const feature of features) {
            const geom = feature.geometry
            if (geom.type === 'Polygon') {
              for (const ring of geom.coordinates) {
                for (const coord of ring) {
                  bounds.extend(coord as [number, number])
                }
              }
            } else if (geom.type === 'MultiPolygon') {
              for (const polygon of geom.coordinates) {
                for (const ring of polygon) {
                  for (const coord of ring) {
                    bounds.extend(coord as [number, number])
                  }
                }
              }
            }
          }

          if (!bounds.isEmpty()) {
            map.fitBounds(bounds, { padding: 40, maxZoom: 8, duration: 1000 })
          }
        }
      })
    })

    mapRef.current = map

    return () => {
      removed = true
      ro.disconnect()
      cancelAnimationFrame(dashAnimId)
      map.remove()
    }
  }, [iso2, latitude, longitude, style, isDark])

  if (!TOKEN) {
    return (
      <div className="flex items-center justify-center h-full bg-hz-card text-sm text-hz-text-secondary">
        Mapbox token not configured
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className="relative h-full w-full">
      <div ref={containerRef} className="!absolute inset-0 h-full w-full" />

      {/* Country name overlay */}
      <div className="absolute top-3 left-3 pointer-events-none">
        <span
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[14px] font-semibold backdrop-blur-md"
          style={{
            background: isDark ? 'rgba(30,30,34,0.85)' : 'rgba(255,255,255,0.88)',
            border: `0.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            color: isDark ? '#e4e4e7' : '#111',
          }}
        >
          {officialName || name}
        </span>
      </div>

      {/* Style toggle */}
      <button
        onClick={() => setStyle((s) => (s === 'streets' ? 'satellite' : 'streets'))}
        className="absolute top-2 right-2 px-2.5 py-1 rounded-lg text-[13px] font-semibold shadow-sm hover:shadow-md transition-shadow backdrop-blur-md"
        style={{
          background: isDark ? 'rgba(30,30,34,0.85)' : 'rgba(255,255,255,0.9)',
          color: isDark ? '#e4e4e7' : '#333',
          border: `0.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'}`,
        }}
      >
        {style === 'streets' ? 'Satellite' : 'Streets'}
      </button>
    </div>
  )
}
