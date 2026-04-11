'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Search, X, ChevronUp, ChevronDown, Link2Off } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { useGanttStore } from '@/stores/use-gantt-store'
import type { GanttFlight } from '@/lib/gantt/types'

interface GanttSearchProps {
  open: boolean
  onClose: () => void
}

export function GanttSearch({ open, onClose }: GanttSearchProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const flights = useGanttStore((s) => s.flights)
  const layout = useGanttStore((s) => s.layout)
  const selectFlight = useGanttStore((s) => s.selectFlight)

  const [query, setQuery] = useState('')
  const [chainBreakFilter, setChainBreakFilter] = useState(false)
  const [matchIdx, setMatchIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setQuery('')
      setChainBreakFilter(false)
      setMatchIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Compute chain break flight IDs from current layout
  const chainBreakIds = useMemo(() => {
    const ids = new Set<string>()
    if (!layout) return ids

    // Group flights by registration (assigned + virtual)
    const byReg = new Map<string, GanttFlight[]>()
    for (const bar of layout.bars) {
      const row = layout.rows[bar.row]
      if (!row?.registration) continue
      const list = byReg.get(row.registration) ?? []
      list.push(bar.flight)
      byReg.set(row.registration, list)
    }

    for (const [, regFlights] of byReg) {
      regFlights.sort((a, b) => a.stdUtc - b.stdUtc)
      for (let i = 1; i < regFlights.length; i++) {
        if (regFlights[i - 1].arrStation !== regFlights[i].depStation) {
          ids.add(regFlights[i].id)
          ids.add(regFlights[i - 1].id) // both sides of the break
        }
      }
    }
    return ids
  }, [layout])

  // Compute matches
  const matches = useMemo(() => {
    const results: GanttFlight[] = []
    const q = query.trim().toUpperCase()

    for (const f of flights) {
      // Chain break filter
      if (chainBreakFilter && !chainBreakIds.has(f.id)) continue

      // Text search (skip if no query and chain break filter is active)
      if (q) {
        const regMatch = (f.aircraftReg ?? '').toUpperCase().includes(q)
        const fltMatch = f.flightNumber.toUpperCase().includes(q)
        if (!regMatch && !fltMatch) continue
      } else if (!chainBreakFilter) {
        continue // no query and no filter = no results
      }

      results.push(f)
    }

    // Sort by departure time
    results.sort((a, b) => a.stdUtc - b.stdUtc)
    return results
  }, [flights, query, chainBreakFilter, chainBreakIds])

  // Clamp match index
  useEffect(() => {
    if (matchIdx >= matches.length) setMatchIdx(Math.max(0, matches.length - 1))
  }, [matches.length, matchIdx])

  // Navigate to current match
  const navigateToMatch = useCallback(
    (idx: number) => {
      const flight = matches[idx]
      if (!flight) return
      selectFlight(flight.id, false)
      // Scroll canvas to the flight's time
      useGanttStore.getState().scrollTargetMs = flight.stdUtc
      useGanttStore.setState({ scrollTargetMs: flight.stdUtc })
    },
    [matches, selectFlight],
  )

  // Auto-navigate on match change
  useEffect(() => {
    if (matches.length > 0 && (query || chainBreakFilter)) {
      navigateToMatch(matchIdx)
    }
  }, [matchIdx, matches.length, query, chainBreakFilter])

  const goNext = useCallback(() => {
    if (matches.length === 0) return
    const next = (matchIdx + 1) % matches.length
    setMatchIdx(next)
  }, [matchIdx, matches.length])

  const goPrev = useCallback(() => {
    if (matches.length === 0) return
    const prev = (matchIdx - 1 + matches.length) % matches.length
    setMatchIdx(prev)
  }, [matchIdx, matches.length])

  // Keyboard: Enter = next, Shift+Enter = prev, Escape = close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey) goPrev()
        else goNext()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, goNext, goPrev])

  if (!open) return null

  const glassBg = isDark ? 'rgba(25,25,33,0.90)' : 'rgba(255,255,255,0.92)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'
  const hasQuery = query.trim().length > 0 || chainBreakFilter
  const noMatch = hasQuery && matches.length === 0

  return (
    <div
      className="absolute top-12 right-4 z-30 rounded-xl overflow-hidden"
      style={{
        width: 340,
        background: glassBg,
        border: `1px solid ${glassBorder}`,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: isDark
          ? '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)'
          : '0 8px 32px rgba(96,97,112,0.14), 0 2px 8px rgba(96,97,112,0.06)',
        animation: 'bc-dropdown-in 100ms ease-out',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: `1px solid ${glassBorder}` }}>
        <Search size={14} style={{ color: palette.textTertiary }} />
        <span className="text-[13px] font-semibold flex-1" style={{ color: palette.text }}>
          Search Flights and AC Registrations
        </span>
        <button onClick={onClose} className="p-1 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5">
          <X size={14} style={{ color: palette.textTertiary }} />
        </button>
      </div>

      <div className="px-3 py-3 space-y-2.5">
        {/* Search input */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setMatchIdx(0)
            }}
            placeholder="Flight number or registration..."
            className="w-full h-10 pl-3 pr-20 rounded-lg text-[14px] outline-none transition-colors"
            style={{
              background: inputBg,
              border: `1px solid ${noMatch ? '#E63535' : query ? 'var(--module-accent)' : glassBorder}`,
              color: palette.text,
              boxShadow: query ? '0 0 0 2px rgba(30,64,175,0.10)' : undefined,
            }}
          />
          {/* Match counter */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {hasQuery && (
              <span
                className="text-[11px] font-mono font-medium px-1"
                style={{
                  color: noMatch ? '#E63535' : palette.textTertiary,
                }}
              >
                {noMatch ? 'No match' : `${matchIdx + 1}/${matches.length}`}
              </span>
            )}
          </div>
        </div>

        {/* Chain break toggle */}
        <button
          onClick={() => {
            setChainBreakFilter((v) => !v)
            setMatchIdx(0)
          }}
          className="w-full h-9 px-3 rounded-lg text-[12px] font-medium flex items-center gap-2 transition-all"
          style={{
            background: chainBreakFilter ? (isDark ? 'rgba(255,136,0,0.10)' : 'rgba(255,136,0,0.08)') : inputBg,
            border: `1px solid ${chainBreakFilter ? 'rgba(255,136,0,0.30)' : glassBorder}`,
            color: chainBreakFilter ? '#FF8800' : palette.textSecondary,
          }}
        >
          <Link2Off size={14} />
          <span className="flex-1 text-left">Flights with chain breaks</span>
          {chainBreakFilter && (
            <span className="text-[11px] font-mono font-bold" style={{ color: '#FF8800' }}>
              {chainBreakIds.size}
            </span>
          )}
        </button>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-medium" style={{ color: palette.textTertiary }}>
            {hasQuery && matches.length > 0
              ? `${matches.length} flight${matches.length !== 1 ? 's' : ''} found`
              : hasQuery
                ? ''
                : 'Enter to navigate results'}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={goPrev}
              disabled={matches.length === 0}
              className="w-7 h-7 flex items-center justify-center rounded-md transition-colors disabled:opacity-30"
              style={{ color: palette.textSecondary }}
              onMouseEnter={(e) => {
                if (matches.length > 0)
                  e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
              title="Previous (Shift+Enter)"
            >
              <ChevronUp size={16} />
            </button>
            <button
              onClick={goNext}
              disabled={matches.length === 0}
              className="w-7 h-7 flex items-center justify-center rounded-md transition-colors disabled:opacity-30"
              style={{ color: palette.textSecondary }}
              onMouseEnter={(e) => {
                if (matches.length > 0)
                  e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
              title="Next (Enter)"
            >
              <ChevronDown size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
