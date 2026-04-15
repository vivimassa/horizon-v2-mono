'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Search, X, Plane } from 'lucide-react'
import type { WorldMapFlight } from './world-map-types'
import { getFlightMapStatus } from './world-map-types'

interface WorldMapSearchProps {
  value: string
  onChange: (v: string) => void
  flights: WorldMapFlight[]
  now: Date
  onSelectFlight?: (flight: WorldMapFlight) => void
  onClear?: () => void
  isDark?: boolean
}

const STATUS_DOT: Record<string, string> = {
  airborne: '#f5c842',
  ground: '#3b82f6',
  delayed: '#ef4444',
  completed: '#6b7280',
  scheduled: '#94a3b8',
}

const STATUS_LABEL: Record<string, string> = {
  airborne: 'Airborne',
  ground: 'Ground',
  delayed: 'Delayed',
  completed: 'Completed',
  scheduled: 'Scheduled',
}

/** Pick the most relevant dep/arr time label + value based on flight state */
function getSmartTimes(
  f: WorldMapFlight,
  status: string,
): { depLabel: string; depTime: string; arrLabel: string; arrTime: string } {
  // Departure: ATD > ETD > STD
  let depLabel = 'STD'
  let depTime = f.stdUtc
  if (f.actualOut || f.actualOff) {
    depLabel = 'ATD'
    depTime = f.actualOut || f.actualOff || f.stdUtc
  }

  // Arrival: ATA > ETA > STA
  let arrLabel = 'STA'
  let arrTime = f.staUtc
  if (f.actualIn || f.actualOn) {
    arrLabel = 'ATA'
    arrTime = f.actualIn || f.actualOn || f.staUtc
  }

  return { depLabel, depTime, arrLabel, arrTime }
}

/** Format instance date as short label, e.g. "24 Mar" — only if not today */
function formatDateLabel(instanceDate: string, nowDate: string): string | null {
  if (instanceDate === nowDate) return null
  const d = new Date(instanceDate + 'T00:00:00Z')
  const day = d.getUTCDate()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${day} ${months[d.getUTCMonth()]}`
}

export function WorldMapSearch({
  value,
  onChange,
  flights,
  now,
  onSelectFlight,
  onClear,
  isDark = true,
}: WorldMapSearchProps) {
  const [expanded, setExpanded] = useState(false)
  const [focusedIdx, setFocusedIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (expanded && inputRef.current) inputRef.current.focus()
  }, [expanded])

  // Global Ctrl+F / Cmd+F shortcut — overrides the browser's Find dialog
  // while the world map is mounted and focuses our search instead.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setExpanded(true)
        // If already expanded, re-focus + select so the user can retype.
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Filter matching flights
  const matches = useMemo(() => {
    if (!value || value.length < 1) return []
    const q = value.toUpperCase()
    return flights
      .filter((f) => {
        const fn = f.flightNumber.toUpperCase()
        const tail = (f.tailNumber || '').toUpperCase()
        return fn.includes(q) || tail.includes(q)
      })
      .slice(0, 20) // cap results
  }, [value, flights])

  // Reset focus when matches change
  useEffect(() => {
    setFocusedIdx(-1)
  }, [matches])

  // Close on outside click
  useEffect(() => {
    if (!expanded) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (!value) setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [expanded, value])

  function handleSelect(flight: WorldMapFlight) {
    onChange(flight.flightNumber)
    onSelectFlight?.(flight)
    setFocusedIdx(-1)
  }

  function handleClear() {
    onChange('')
    onClear?.()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClear()
      setExpanded(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIdx((i) => Math.min(i + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && focusedIdx >= 0 && matches[focusedIdx]) {
      e.preventDefault()
      handleSelect(matches[focusedIdx])
    }
  }

  const showDropdown = expanded && value && value.length >= 1

  // Colors
  const panelBg = isDark ? 'rgba(24, 24, 27, 0.96)' : 'rgba(255, 255, 255, 0.98)'
  const borderColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const focusBg = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)'
  const primaryText = isDark ? '#fafafa' : '#18181b'
  const secondaryText = isDark ? 'rgba(250,250,250,0.50)' : 'rgba(24,24,27,0.50)'
  const tertiaryText = isDark ? 'rgba(250,250,250,0.35)' : 'rgba(24,24,27,0.35)'

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed top-16 right-4 z-30 w-10 h-10 rounded-xl glass border border-black/10 dark:border-white/10 flex items-center justify-center hover:bg-foreground/[0.03] transition-colors shadow-lg"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
      </button>
    )
  }

  return (
    <div
      ref={containerRef}
      className="fixed top-16 right-4 z-30"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Search input */}
      <div
        className="flex items-center gap-1 px-3 shadow-lg"
        style={{
          background: panelBg,
          border: `1px solid ${borderColor}`,
          borderRadius: showDropdown ? '12px 12px 0 0' : '12px',
          backdropFilter: 'blur(24px) saturate(1.4)',
        }}
      >
        <Search className="h-4 w-4 shrink-0" style={{ color: secondaryText }} />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search flight or tail..."
          className="w-[220px] h-10 bg-transparent text-[13px] outline-none"
          style={{ color: primaryText, fontFamily: 'Inter, system-ui, sans-serif' }}
        />
        {value && (
          <button
            onClick={() => {
              handleClear()
              inputRef.current?.focus()
            }}
            className="p-1 rounded-lg transition-colors"
            style={{ color: secondaryText }}
            onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          className="shadow-2xl overflow-hidden"
          style={{
            background: panelBg,
            borderLeft: `1px solid ${borderColor}`,
            borderRight: `1px solid ${borderColor}`,
            borderBottom: `1px solid ${borderColor}`,
            borderRadius: '0 0 12px 12px',
            backdropFilter: 'blur(24px) saturate(1.4)',
            maxHeight: 360,
            overflowY: 'auto',
          }}
        >
          {matches.length === 0 ? (
            <div className="px-4 py-6 text-center" style={{ color: tertiaryText, fontSize: 12 }}>
              No matching flights
            </div>
          ) : (
            <div className="py-1">
              {matches.map((flight, idx) => {
                const status = getFlightMapStatus(flight, now)
                const dotColor = STATUS_DOT[status] || STATUS_DOT.scheduled
                const isFocused = idx === focusedIdx
                const times = getSmartTimes(flight, status)
                const todayUtc = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
                const dateLabel = formatDateLabel(flight.instanceDate, todayUtc)
                return (
                  <button
                    key={flight.id}
                    className="w-full text-left px-3 py-2 flex items-center gap-3 transition-colors duration-100"
                    style={{ background: isFocused ? focusBg : 'transparent' }}
                    onMouseEnter={(e) => {
                      setFocusedIdx(idx)
                      e.currentTarget.style.background = hoverBg
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isFocused ? focusBg : 'transparent'
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSelect(flight)
                    }}
                  >
                    {/* Status dot */}
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: dotColor, boxShadow: `0 0 6px ${dotColor}60` }}
                    />

                    {/* Flight info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[13px] font-semibold" style={{ color: primaryText }}>
                          {flight.flightNumber}
                        </span>
                        <span className="text-[11px]" style={{ color: tertiaryText }}>
                          {STATUS_LABEL[status]}
                        </span>
                        {dateLabel && (
                          <span
                            className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                            style={{
                              color: tertiaryText,
                              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                            }}
                          >
                            {dateLabel}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] font-medium" style={{ color: secondaryText }}>
                          {flight.depStation}
                        </span>
                        <Plane className="h-2.5 w-2.5" style={{ color: tertiaryText, transform: 'rotate(45deg)' }} />
                        <span className="text-[11px] font-medium" style={{ color: secondaryText }}>
                          {flight.arrStation}
                        </span>
                        <span className="text-[10px] font-mono ml-1" style={{ color: tertiaryText }}>
                          <span style={{ color: times.depLabel !== 'STD' ? secondaryText : tertiaryText }}>
                            {times.depLabel}
                          </span>{' '}
                          {times.depTime}–
                          <span style={{ color: times.arrLabel !== 'STA' ? secondaryText : tertiaryText }}>
                            {times.arrLabel}
                          </span>{' '}
                          {times.arrTime}z
                        </span>
                      </div>
                    </div>

                    {/* Tail number */}
                    {flight.tailNumber && (
                      <span className="text-[11px] font-mono shrink-0" style={{ color: secondaryText }}>
                        {flight.tailNumber}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
