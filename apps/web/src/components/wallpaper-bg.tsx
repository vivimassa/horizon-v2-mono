'use client'

import { useState, useEffect, useRef } from 'react'

// ── Curated aviation wallpapers (Unsplash, free commercial use) ──
const WALLPAPERS = [
  'https://images.unsplash.com/photo-1551963838-0598cc18d5e4?w=1920&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1488085061387-422e29b40080?w=1920&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1570970580763-7993ca30d726?w=1920&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1698306559032-a9e4c7601e78?w=1920&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1741309695546-44b2a66fca8a?w=1920&q=80&auto=format&fit=crop',
]

const DEFAULT_INTERVAL = 8000
const FADE_MS = 1800

const KB_CSS = `@keyframes wallpaper-kb{0%{transform:scale(1)}100%{transform:scale(1.4)}}`

interface WallpaperBgProps {
  showIndicators?: boolean
  interval?: number
  blur?: number
  lightOverlay?: boolean
}

export function WallpaperBg({
  showIndicators = false,
  interval = DEFAULT_INTERVAL,
  blur = 0,
  lightOverlay = false,
}: WallpaperBgProps) {
  const [current, setCurrent] = useState(0)
  const [ready, setReady] = useState(false)
  const preloaded = useRef(new Set<number>())

  // Preload images
  useEffect(() => {
    const first = new Image()
    first.src = WALLPAPERS[0]
    first.onload = () => {
      preloaded.current.add(0)
      setReady(true)
    }
    WALLPAPERS.forEach((url, i) => {
      if (i === 0) return
      const img = new Image()
      img.src = url
      img.onload = () => preloaded.current.add(i)
    })
  }, [])

  // Auto-advance
  useEffect(() => {
    if (!ready) return
    const id = setInterval(() => setCurrent((p) => (p + 1) % WALLPAPERS.length), interval)
    return () => clearInterval(id)
  }, [ready, interval])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: KB_CSS }} />

      {/* Wallpaper slides with Ken Burns */}
      {WALLPAPERS.map((url, i) => (
        <div
          key={i}
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
          background: lightOverlay
            ? 'linear-gradient(135deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.30) 40%, rgba(255,255,255,0.45) 100%)'
            : 'linear-gradient(135deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.55) 100%)',
          zIndex: 1,
        }}
      />
      {/* Vignette */}
      <div
        className="fixed inset-0"
        style={{
          background: lightOverlay
            ? 'radial-gradient(ellipse at center, transparent 50%, rgba(255,255,255,0.3) 100%)'
            : 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)',
          zIndex: 1,
        }}
      />

      {/* Slide indicators */}
      {showIndicators && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-2"
          style={{ zIndex: 20, animation: 'login-fade 1s ease-out 1s both' }}
        >
          {WALLPAPERS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Wallpaper ${i + 1}`}
              className="rounded-full transition-all duration-500"
              style={{
                width: i === current ? 24 : 8,
                height: 8,
                background: i === current ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)',
              }}
            />
          ))}
        </div>
      )}
    </>
  )
}
