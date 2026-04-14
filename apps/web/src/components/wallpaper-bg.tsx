'use client'

import { useState, useEffect, useRef } from 'react'

// ── Curated dark aviation wallpapers (Unsplash, free commercial use) ──
const WALLPAPERS_DARK = [
  'https://images.unsplash.com/photo-1751698158488-9faa95a179f8?w=1920&q=80&auto=format&fit=crop', // Wing on tarmac at night — Dubai
  'https://images.unsplash.com/photo-1510505216937-86d3219fa1fd?w=1920&q=80&auto=format&fit=crop', // Cockpit view at night — city bokeh
  'https://images.unsplash.com/photo-1689414871831-a395df32941e?w=1920&q=80&auto=format&fit=crop', // Foggy night airport — Incheon
  'https://images.unsplash.com/photo-1758473788156-e6b2ae00c77d?w=1920&q=80&auto=format&fit=crop', // Airplane in dark night sky
  'https://images.unsplash.com/photo-1695775147307-690ce4b1ee97?w=1920&q=80&auto=format&fit=crop', // Plane through cloudy sky at night
]

// ── Curated bright daylight aviation wallpapers (Unsplash, free commercial use) ──
const WALLPAPERS_LIGHT = [
  'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1920&q=80&auto=format&fit=crop', // Fluffy clouds, golden-hour sky
  'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=1920&q=80&auto=format&fit=crop', // Emirates aircraft on runway, daylight
  'https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=1920&q=80&auto=format&fit=crop', // White plane tail, blue sky
  'https://images.unsplash.com/photo-1521727857535-28d2047314ac?w=1920&q=80&auto=format&fit=crop', // Aircraft turbine, daylight
  'https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=1920&q=80&auto=format&fit=crop', // White plane wing, bright clouds
]

const DEFAULT_INTERVAL = 8000
const FADE_MS = 1800

const KB_CSS = `@keyframes wallpaper-kb{0%{transform:scale(1)}100%{transform:scale(1.4)}}`

type WallpaperVariant = 'dark' | 'light'

interface WallpaperBgProps {
  showIndicators?: boolean
  interval?: number
  blur?: number
  /** Which wallpaper set + overlay tone to use. Defaults to "dark" for backward compat. */
  variant?: WallpaperVariant
  /** Deprecated: use variant instead. Kept for callers that still pass it. */
  lightOverlay?: boolean
}

export function WallpaperBg({
  showIndicators = false,
  interval = DEFAULT_INTERVAL,
  blur = 0,
  variant,
  lightOverlay = false,
}: WallpaperBgProps) {
  // Resolve variant: explicit prop wins; fallback maps legacy lightOverlay to a dimmed dark set.
  const resolved: WallpaperVariant = variant ?? (lightOverlay ? 'light' : 'dark')
  const wallpapers = resolved === 'light' ? WALLPAPERS_LIGHT : WALLPAPERS_DARK

  // The rendered set lags the requested set until the new set's first image
  // is preloaded. This keeps the previous wallpaper visible during a theme
  // swap so there's no blank-flash before the fresh slide fades in.
  const [renderedSet, setRenderedSet] = useState<string[]>(wallpapers)
  const [current, setCurrent] = useState(0)
  const [ready, setReady] = useState(false)
  const preloaded = useRef(new Set<string>())

  useEffect(() => {
    let cancelled = false

    const commitSet = () => {
      if (cancelled) return
      setRenderedSet(wallpapers)
      setCurrent(0)
      setReady(true)
    }

    // Kick preload on non-first images regardless.
    wallpapers.forEach((url, i) => {
      if (i === 0) return
      if (preloaded.current.has(url)) return
      const img = new Image()
      img.src = url
      img.onload = () => preloaded.current.add(url)
    })

    const firstUrl = wallpapers[0]
    if (preloaded.current.has(firstUrl)) {
      commitSet()
      return
    }

    const first = new Image()
    first.src = firstUrl
    first.onload = () => {
      preloaded.current.add(firstUrl)
      commitSet()
    }

    return () => {
      cancelled = true
    }
  }, [wallpapers])

  // Auto-advance within the currently-rendered set.
  useEffect(() => {
    if (!ready) return
    const id = setInterval(() => setCurrent((p) => (p + 1) % renderedSet.length), interval)
    return () => clearInterval(id)
  }, [ready, interval, renderedSet.length])

  // Overlay tints — dark variant uses black wash; light variant uses a soft white/airy wash.
  const gradientOverlay =
    resolved === 'light'
      ? 'linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.22) 40%, rgba(255,255,255,0.38) 100%)'
      : 'linear-gradient(135deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.55) 100%)'

  const vignette =
    resolved === 'light'
      ? 'radial-gradient(ellipse at center, transparent 55%, rgba(255,255,255,0.35) 100%)'
      : 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)'

  const indicatorActive = resolved === 'light' ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)'
  const indicatorInactive = resolved === 'light' ? 'rgba(15,23,42,0.30)' : 'rgba(255,255,255,0.30)'

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: KB_CSS }} />

      {/* Wallpaper slides with Ken Burns */}
      {renderedSet.map((url, i) => (
        <div
          key={`${url}-${i}`}
          className="fixed inset-0"
          style={{
            opacity: ready && i === current ? 1 : 0,
            transition: `opacity ${FADE_MS}ms ease-in-out`,
            zIndex: 0,
          }}
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${url})`,
              animation: `wallpaper-kb 20s ease-in-out infinite alternate`,
              animationDelay: `${i * -4}s`,
              filter: blur ? `blur(${blur}px)` : undefined,
              transform: blur ? 'scale(1.05)' : undefined,
            }}
          />
        </div>
      ))}

      {/* Gradient overlay */}
      <div
        className="fixed inset-0"
        style={{
          background: gradientOverlay,
          zIndex: 1,
        }}
      />
      {/* Vignette */}
      <div
        className="fixed inset-0"
        style={{
          background: vignette,
          zIndex: 1,
        }}
      />

      {/* Slide indicators */}
      {showIndicators && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-2"
          style={{ zIndex: 20, animation: 'login-fade 1s ease-out 1s both' }}
        >
          {renderedSet.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Wallpaper ${i + 1}`}
              className="rounded-full transition-all duration-500"
              style={{
                width: i === current ? 24 : 8,
                height: 8,
                background: i === current ? indicatorActive : indicatorInactive,
              }}
            />
          ))}
        </div>
      )}
    </>
  )
}
