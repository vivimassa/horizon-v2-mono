'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

/**
 * SkyHub timezone dropdown — searchable IANA picker.
 *
 * Canonical primitive for any cron / schedule UI in Horizon. Future tasks
 * reuse this — nailing the design here pays back across every scheduler.
 *
 * Design rules followed:
 *   • 40px trigger height, 8px radius, hz-card bg, accent focus ring
 *   • Portal-rendered panel with flip-above when overflowing
 *   • Search-as-you-type filter, region grouping
 *   • Each row labels with current UTC offset, computed live so DST is honoured
 *
 * @example
 *   <TimezoneDropdown value={schedule.timezone} onChange={setTz} />
 */
export interface TimezoneDropdownProps {
  value: string
  onChange: (tz: string) => void
  disabled?: boolean
  className?: string
}

/** Fallback list — used when Intl.supportedValuesOf is unavailable. */
const FALLBACK_ZONES = [
  'UTC',
  'Asia/Ho_Chi_Minh',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Manila',
  'Asia/Jakarta',
  'Asia/Kuala_Lumpur',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Australia/Sydney',
  'Pacific/Auckland',
]

function listAllZones(): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
  if (typeof supported === 'function') {
    try {
      return supported.call(Intl, 'timeZone')
    } catch {
      /* fall through */
    }
  }
  return FALLBACK_ZONES
}

/** Returns "+07:00" / "-04:30" / "+00:00" for an IANA zone right now. */
function offsetLabel(tz: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    })
    const parts = fmt.formatToParts(new Date())
    const off = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
    // shortOffset returns "GMT+7" — normalise to "+07:00".
    const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(off)
    if (!m) return off || 'UTC'
    const sign = m[1]
    const hh = m[2].padStart(2, '0')
    const mm = (m[3] ?? '00').padStart(2, '0')
    return `${sign}${hh}:${mm}`
  } catch {
    return ''
  }
}

interface ZoneRow {
  tz: string
  region: string
  city: string
  offset: string
  search: string
}

function buildRows(zones: string[]): ZoneRow[] {
  const rows: ZoneRow[] = zones.map((tz) => {
    const slash = tz.indexOf('/')
    const region = slash >= 0 ? tz.slice(0, slash) : 'Other'
    const city = slash >= 0 ? tz.slice(slash + 1).replace(/_/g, ' ') : tz
    const off = offsetLabel(tz)
    return {
      tz,
      region,
      city,
      offset: off,
      search: `${tz} ${city} ${off}`.toLowerCase(),
    }
  })
  rows.sort((a, b) => (a.region === b.region ? a.city.localeCompare(b.city) : a.region.localeCompare(b.region)))
  return rows
}

export function TimezoneDropdown({ value, onChange, disabled, className = '' }: TimezoneDropdownProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [mounted, setMounted] = useState(false)
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setMounted(true), [])

  const allRows = useMemo(() => buildRows(listAllZones()), [])
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allRows
    return allRows.filter((r) => r.search.includes(q))
  }, [query, allRows])

  const currentOffset = offsetLabel(value)

  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const panelHeight = 360
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow < panelHeight + 8 ? rect.top - panelHeight - 4 : rect.bottom + 4
    setPanelPos({ top, left: rect.left, width: Math.max(rect.width, 320) })
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current && !triggerRef.current.contains(t) && panelRef.current && !panelRef.current.contains(t)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  useEffect(() => {
    if (open) {
      setQuery('')
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      disabled={disabled}
      onClick={() => setOpen((o) => !o)}
      className={`flex items-center gap-2 h-10 w-full rounded-lg border bg-hz-card px-3 transition-colors ${
        open ? 'border-module-accent ring-2 ring-module-accent/30' : 'border-hz-border hover:border-hz-border'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      <span className="flex-1 text-left text-[14px] text-hz-text truncate">{value || 'Select timezone…'}</span>
      <span className="text-[12px] font-mono text-hz-text-secondary tabular-nums">{currentOffset}</span>
      <ChevronDown
        className={`h-4 w-4 text-hz-text-secondary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
      />
    </button>
  )

  const panel =
    open && mounted
      ? createPortal(
          <div
            ref={panelRef}
            className="fixed z-50 rounded-xl border bg-hz-card shadow-2xl flex flex-col overflow-hidden"
            style={{
              top: panelPos.top,
              left: panelPos.left,
              width: panelPos.width,
              maxHeight: 360,
              borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
            }}
          >
            {/* Search */}
            <div className="shrink-0 px-2 py-2 border-b border-hz-border">
              <div className="flex items-center gap-2 h-9 px-2.5 rounded-lg bg-hz-bg border border-hz-border">
                <Search className="h-3.5 w-3.5 text-hz-text-secondary shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search city, region, offset…"
                  className="flex-1 bg-transparent outline-none text-[13px] text-hz-text placeholder:text-hz-text-secondary/50"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto py-1">
              {rows.length === 0 ? (
                <div className="px-3 py-4 text-[13px] text-hz-text-secondary">No matches.</div>
              ) : (
                renderGrouped(rows, value, (tz) => {
                  onChange(tz)
                  setOpen(false)
                })
              )}
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      {trigger}
      {panel}
    </>
  )
}

function renderGrouped(rows: ZoneRow[], selected: string, pick: (tz: string) => void) {
  const out: React.ReactNode[] = []
  let lastRegion = ''
  for (const r of rows) {
    if (r.region !== lastRegion) {
      lastRegion = r.region
      out.push(
        <div
          key={`g-${r.region}`}
          className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-wider uppercase text-hz-text-secondary/70"
        >
          {r.region}
        </div>,
      )
    }
    const isSelected = r.tz === selected
    out.push(
      <button
        key={r.tz}
        type="button"
        onClick={() => pick(r.tz)}
        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors ${
          isSelected ? 'bg-module-accent/10 text-module-accent font-semibold' : 'text-hz-text hover:bg-hz-border/30'
        }`}
      >
        <span className="flex-1 truncate">{r.city}</span>
        <span className="text-[11px] font-mono text-hz-text-secondary tabular-nums shrink-0">{r.offset}</span>
      </button>,
    )
  }
  return out
}
