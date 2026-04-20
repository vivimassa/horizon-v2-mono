'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { usePairingGanttStore } from '@/stores/use-pairing-gantt-store'
import { usePairingStore } from '@/stores/use-pairing-store'

/**
 * Portalled floating search pill. Opens via Ctrl+F (toolbar or keyboard).
 * Searches flight number, dep/arr station, and aircraft registration. Tail
 * matches scroll the axis into view with a 3s+0.8s amber fade.
 */
export function SearchPill() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const searchOpen = usePairingGanttStore((s) => s.searchOpen)
  const toggleSearch = usePairingGanttStore((s) => s.toggleSearch)
  const startSearchHighlight = usePairingGanttStore((s) => s.startSearchHighlight)
  const advanceSearchHighlight = usePairingGanttStore((s) => s.advanceSearchHighlight)
  const clearSearchHighlight = usePairingGanttStore((s) => s.clearSearchHighlight)
  const flights = usePairingStore((s) => s.flights)

  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const highlightRafRef = useRef<number>(0)

  // Global Ctrl+F handler
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        toggleSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleSearch])

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 20)
    }
  }, [searchOpen])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return [] as typeof flights
    return flights.filter(
      (f) =>
        f.flightNumber.toLowerCase().includes(q) ||
        f.departureAirport.toLowerCase().includes(q) ||
        f.arrivalAirport.toLowerCase().includes(q) ||
        (f.tailNumber?.toLowerCase().includes(q) ?? false),
    )
  }, [query, flights])

  function animateHighlight(registration: string) {
    startSearchHighlight(registration)
    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      const phase = Math.min(1, elapsed / 3800)
      advanceSearchHighlight(phase)
      if (phase >= 1) {
        clearSearchHighlight()
        cancelAnimationFrame(highlightRafRef.current)
        return
      }
      highlightRafRef.current = requestAnimationFrame(tick)
    }
    cancelAnimationFrame(highlightRafRef.current)
    highlightRafRef.current = requestAnimationFrame(tick)
  }

  function handleEnter(direction: 1 | -1) {
    if (results.length === 0) return
    const next = (cursor + direction + results.length) % results.length
    setCursor(next)
    const hit = results[next]
    if (hit.tailNumber) animateHighlight(hit.tailNumber)
  }

  if (!searchOpen) return null

  return (
    <div
      className="absolute top-3 right-3 z-30 flex items-center gap-2 rounded-xl pl-3 pr-2"
      style={{
        height: 40,
        background: isDark ? 'rgba(25,25,33,0.92)' : 'rgba(255,255,255,0.96)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.24)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <Search size={14} className="text-hz-text-tertiary" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setCursor(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            handleEnter(e.shiftKey ? -1 : 1)
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            toggleSearch()
          }
        }}
        placeholder="Flight, station, tail…"
        className="bg-transparent outline-none text-[13px] font-medium text-hz-text placeholder:text-hz-text-tertiary w-48"
      />
      <span className="text-[11px] font-mono text-hz-text-tertiary tabular-nums">
        {results.length > 0 ? `${cursor + 1}/${results.length}` : '0/0'}
      </span>
      <button
        type="button"
        onClick={() => handleEnter(-1)}
        className="p-1 rounded hover:bg-hz-border/30"
        aria-label="Previous match"
      >
        <ChevronUp size={12} />
      </button>
      <button
        type="button"
        onClick={() => handleEnter(1)}
        className="p-1 rounded hover:bg-hz-border/30"
        aria-label="Next match"
      >
        <ChevronDown size={12} />
      </button>
      <button
        type="button"
        onClick={() => {
          setQuery('')
          toggleSearch()
        }}
        className="p-1 rounded hover:bg-hz-border/30"
        aria-label="Close search"
      >
        <X size={12} />
      </button>
    </div>
  )
}
