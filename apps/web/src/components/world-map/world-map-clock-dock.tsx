'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Search } from 'lucide-react'
import { searchAirportsForClock } from '@/lib/world-map/api'

const STORAGE_KEY = 'horizon-worldmap-clocks'

interface ClockZone {
  tz: string
  label: string // display label (IATA code or "UTC"/"LCL")
  name: string // full name (airport name or "Coordinated Universal Time")
  removable: boolean
}

const DEFAULT_ZONES: ClockZone[] = [{ tz: 'UTC', label: 'UTC', name: 'Coordinated Universal Time', removable: false }]

function loadCustomZones(): ClockZone[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    return JSON.parse(stored) as ClockZone[]
  } catch {
    return []
  }
}

function saveCustomZones(zones: ClockZone[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(zones))
}

// ── Analog Clock Component ───────────────────────────────────────

function AnalogClock({ tz, size = 100 }: { tz: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = size * dpr
    const h = size * dpr
    canvas.width = w
    canvas.height = h
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    const r = size / 2 - 4

    const now = new Date()
    const timeStr = now.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: tz === 'UTC' ? 'UTC' : tz,
      hour12: false,
    })
    const [h12, m, s] = timeStr.split(':').map(Number)
    const ms = now.getMilliseconds()

    const secAngle = ((s + ms / 1000) / 60) * Math.PI * 2 - Math.PI / 2
    const minAngle = ((m + (s + ms / 1000) / 60) / 60) * Math.PI * 2 - Math.PI / 2
    const hrAngle = (((h12 % 12) + (m + (s + ms / 1000) / 60) / 60) / 12) * Math.PI * 2 - Math.PI / 2

    ctx.clearRect(0, 0, size, size)

    const isDark = document.documentElement.classList.contains('dark')

    // Face
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'
    ctx.fill()
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Tick marks (skip 12, 3, 6, 9 — numbers go there)
    for (let i = 0; i < 12; i++) {
      if (i % 3 === 0) continue
      const angle = (i / 12) * Math.PI * 2 - Math.PI / 2
      const innerR = r - 4
      const outerR = r - 2
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR)
      ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR)
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'
      ctx.lineWidth = 0.8
      ctx.stroke()
    }

    // 12, 3, 6, 9 numbers
    const nums: [number, string][] = [
      [0, '12'],
      [3, '3'],
      [6, '6'],
      [9, '9'],
    ]
    ctx.font = `600 ${size * 0.11}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'
    for (const [idx, label] of nums) {
      const angle = (idx / 12) * Math.PI * 2 - Math.PI / 2
      const numR = r - size * 0.1
      ctx.fillText(label, cx + Math.cos(angle) * numR, cy + Math.sin(angle) * numR)
    }

    // Hour hand
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(hrAngle) * r * 0.5, cy + Math.sin(hrAngle) * r * 0.5)
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.stroke()

    // Minute hand
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(minAngle) * r * 0.7, cy + Math.sin(minAngle) * r * 0.7)
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'
    ctx.lineWidth = 1.8
    ctx.lineCap = 'round'
    ctx.stroke()

    // Second hand
    ctx.beginPath()
    ctx.moveTo(cx - Math.cos(secAngle) * r * 0.15, cy - Math.sin(secAngle) * r * 0.15)
    ctx.lineTo(cx + Math.cos(secAngle) * r * 0.8, cy + Math.sin(secAngle) * r * 0.8)
    ctx.strokeStyle = 'hsl(var(--primary))'
    ctx.lineWidth = 0.8
    ctx.lineCap = 'round'
    ctx.stroke()

    // Center dot
    ctx.beginPath()
    ctx.arc(cx, cy, 2, 0, Math.PI * 2)
    ctx.fillStyle = 'hsl(var(--primary))'
    ctx.fill()

    rafRef.current = requestAnimationFrame(draw)
  }, [tz, size])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [draw])

  return <canvas ref={canvasRef} style={{ width: size, height: size }} className="shrink-0" />
}

// ── Digital time display ─────────────────────────────────────────

function DigitalTime({ tz }: { tz: string }) {
  const [time, setTime] = useState('')

  useEffect(() => {
    function update() {
      const now = new Date()
      setTime(
        now.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: tz === 'UTC' ? 'UTC' : tz,
          hour12: false,
        }),
      )
    }
    update()
    const iv = setInterval(update, 1000)
    return () => clearInterval(iv)
  }, [tz])

  return <span className="font-mono text-[12px] leading-none">{time}</span>
}

// ── Main Clock Dock ──────────────────────────────────────────────

export function WorldMapClockDock() {
  const [open, setOpen] = useState(false)
  const [customZones, setCustomZones] = useState<ClockZone[]>([])
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<{ iata: string; name: string; timezone: string }[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    setCustomZones(loadCustomZones())
  }, [])

  const allZones = [...DEFAULT_ZONES, ...customZones]

  // Debounced airport search
  function handleSearch(q: string) {
    setSearch(q)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (q.length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    searchTimerRef.current = setTimeout(async () => {
      const r = await searchAirportsForClock(q)
      // Filter out already-added airports
      setResults(r.filter((a) => !allZones.some((z) => z.label === a.iata)))
      setSearching(false)
    }, 250)
  }

  function addAirport(airport: { iata: string; name: string; timezone: string }) {
    if (customZones.length >= 2) return
    const zone: ClockZone = {
      tz: airport.timezone,
      label: airport.iata,
      name: airport.name,
      removable: true,
    }
    const next = [...customZones, zone]
    setCustomZones(next)
    saveCustomZones(next)
    setShowAddMenu(false)
    setSearch('')
    setResults([])
  }

  function removeZone(label: string) {
    const next = customZones.filter((z) => z.label !== label)
    setCustomZones(next)
    saveCustomZones(next)
  }

  return (
    <>
      {/* Toggle button — right edge, only visible when closed */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-30 w-6 h-14 rounded-l-lg glass-heavy border border-r-0 border-black/10 dark:border-white/10 shadow-lg flex items-center justify-center hover:bg-foreground/[0.03] transition-all duration-200"
        >
          <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}

      {/* Clock panel */}
      <div
        className={`fixed top-[130px] z-30 glass rounded-l-2xl border border-r-0 border-black/10 dark:border-white/10 shadow-xl flex items-stretch transition-all duration-300 ${
          open ? 'right-0 opacity-100' : '-right-[180px] opacity-0 pointer-events-none'
        }`}
      >
        {/* Close strip — left edge, vertically centered */}
        <button
          onClick={() => {
            setOpen(false)
            setShowAddMenu(false)
          }}
          className="w-5 shrink-0 flex items-center justify-center rounded-l-2xl hover:bg-muted/50 transition-colors border-r border-black/5 dark:border-white/5"
        >
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        {/* Clock content */}
        <div className="flex flex-col items-center py-4 px-3 gap-4" style={{ width: '140px' }}>
          {allZones.map((zone) => (
            <div key={zone.label} className="flex flex-col items-center gap-1 relative group">
              <AnalogClock tz={zone.tz} size={100} />
              <DigitalTime tz={zone.tz} />
              <span className="text-[11px] uppercase tracking-wider leading-none text-muted-foreground">
                {zone.label}
              </span>
              {zone.removable && (
                <button
                  onClick={() => removeZone(zone.label)}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}

          {/* Add zone button */}
          {customZones.length < 2 && (
            <div className="relative">
              <button
                onClick={() => setShowAddMenu((p) => !p)}
                className="w-[100px] h-[100px] rounded-full border border-dashed border-black/15 dark:border-white/15 flex flex-col items-center justify-center gap-1 hover:bg-foreground/[0.03] transition-colors"
              >
                <Plus className="h-4 w-4 text-muted-foreground/50" />
                <span className="text-[9px] text-muted-foreground/50">Add Airport</span>
              </button>

              {showAddMenu && (
                <div className="absolute right-full mr-2 top-0 w-[220px] bg-popover rounded-xl border border-black/10 dark:border-white/10 shadow-xl overflow-hidden">
                  <div className="p-2 flex items-center gap-2 border-b border-black/5 dark:border-white/5">
                    <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => handleSearch(e.target.value)}
                      placeholder="Search IATA or city..."
                      className="w-full h-7 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground/40"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-[240px] overflow-y-auto">
                    {search.length < 2 && (
                      <div className="px-3 py-4 text-[11px] text-muted-foreground/50 text-center">
                        Type an IATA code or city name
                      </div>
                    )}
                    {search.length >= 2 && searching && (
                      <div className="px-3 py-3 text-[11px] text-muted-foreground/50 text-center">Searching...</div>
                    )}
                    {search.length >= 2 && !searching && results.length === 0 && (
                      <div className="px-3 py-3 text-[11px] text-muted-foreground/50 text-center">
                        No airports found
                      </div>
                    )}
                    {results.map((a) => (
                      <button
                        key={a.iata}
                        onClick={() => addAirport(a)}
                        className="w-full px-3 py-2 text-left hover:bg-foreground/[0.04] transition-colors flex items-center gap-3"
                      >
                        <span className="text-[13px] font-bold font-mono w-[36px] shrink-0">{a.iata}</span>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[12px] truncate">{a.name}</span>
                          <span className="text-[10px] text-muted-foreground truncate">{a.timezone}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
