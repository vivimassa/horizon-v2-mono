'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'

interface CrewScheduleSearchProps {
  open: boolean
  onClose: () => void
}

interface CrewMatch {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  /** Pre-computed display string `LAST FIRST · EID`. */
  display: string
  /** Index in the original `display` where the query starts (for highlight). */
  hitStart: number
  hitEnd: number
}

/**
 * 4.1.6.2 Crew Schedule — Search panel.
 *
 * Aesthetic forked from 2.1.1 Movement Control's `gantt-search.tsx`:
 * top-right glass panel, icon header, accent-bordered input, match
 * counter, prev/next arrows, Enter / Shift+Enter / Escape shortcuts.
 *
 * Match scope: crew employee ID OR first/last name (case-insensitive
 * substring). On every match navigation we (1) select the crew (which
 * paints the accent-border + tinted-bg row treatment in the left panel
 * and a focus ring on the canvas) and (2) ask the canvas to scroll
 * the row into vertical view.
 */
export function CrewScheduleSearch({ open, onClose }: CrewScheduleSearchProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const crew = useCrewScheduleStore((s) => s.crew)
  const selectCrew = useCrewScheduleStore((s) => s.selectCrew)
  const scrollToCrew = useCrewScheduleStore((s) => s.scrollToCrew)

  const [query, setQuery] = useState('')
  const [matchIdx, setMatchIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setMatchIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const matches = useMemo<CrewMatch[]>(() => {
    const q = query.trim().toUpperCase()
    if (!q) return []
    const out: CrewMatch[] = []
    for (const c of crew) {
      const eid = (c.employeeId ?? '').toUpperCase()
      const first = (c.firstName ?? '').toUpperCase()
      const last = (c.lastName ?? '').toUpperCase()
      const fullA = `${last} ${first}`.trim()
      const fullB = `${first} ${last}`.trim()
      if (!eid.includes(q) && !first.includes(q) && !last.includes(q) && !fullA.includes(q) && !fullB.includes(q))
        continue
      const display = `${c.lastName ?? ''} ${c.firstName ?? ''} · ${c.employeeId ?? ''}`.trim()
      const upper = display.toUpperCase()
      const hitStart = upper.indexOf(q)
      out.push({
        id: c._id,
        employeeId: c.employeeId ?? '',
        firstName: c.firstName ?? '',
        lastName: c.lastName ?? '',
        display,
        hitStart: hitStart >= 0 ? hitStart : 0,
        hitEnd: hitStart >= 0 ? hitStart + q.length : 0,
      })
    }
    out.sort((a, b) => a.display.localeCompare(b.display))
    return out
  }, [crew, query])

  useEffect(() => {
    if (matchIdx >= matches.length) setMatchIdx(Math.max(0, matches.length - 1))
  }, [matches.length, matchIdx])

  const navigateToMatch = useCallback(
    (idx: number) => {
      const m = matches[idx]
      if (!m) return
      selectCrew(m.id)
      scrollToCrew(m.id)
    },
    [matches, selectCrew, scrollToCrew],
  )

  useEffect(() => {
    if (matches.length > 0 && query) {
      navigateToMatch(matchIdx)
    }
  }, [matchIdx, matches.length, query, navigateToMatch])

  const goNext = useCallback(() => {
    if (matches.length === 0) return
    setMatchIdx((i) => (i + 1) % matches.length)
  }, [matches.length])

  const goPrev = useCallback(() => {
    if (matches.length === 0) return
    setMatchIdx((i) => (i - 1 + matches.length) % matches.length)
  }, [matches.length])

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
  const hasQuery = query.trim().length > 0
  const noMatch = hasQuery && matches.length === 0
  const current = matches[matchIdx] ?? null

  return (
    <div
      className="absolute top-3 right-4 z-30 rounded-xl overflow-hidden"
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
          Search Crew by ID or Name
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
            placeholder="Crew ID or name..."
            className="w-full h-10 pl-3 pr-20 rounded-lg text-[14px] outline-none transition-colors"
            style={{
              background: inputBg,
              border: `1px solid ${noMatch ? '#E63535' : query ? 'var(--module-accent)' : glassBorder}`,
              color: palette.text,
              boxShadow: query ? '0 0 0 2px rgba(30,64,175,0.10)' : undefined,
            }}
          />
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

        {/* Current match — name highlighted in viewport line */}
        {current && (
          <div
            className="rounded-lg px-3 py-2 text-[13px] flex items-center gap-2"
            style={{
              background: isDark ? 'rgba(62,123,250,0.10)' : 'rgba(30,64,175,0.06)',
              border: '1px solid var(--module-accent)',
              color: palette.text,
            }}
          >
            <span className="w-1 self-stretch rounded-sm shrink-0" style={{ background: 'var(--module-accent)' }} />
            <span className="truncate font-medium">
              {current.display.slice(0, current.hitStart)}
              <mark
                style={{
                  background: 'var(--module-accent)',
                  color: '#fff',
                  padding: '0 2px',
                  borderRadius: 3,
                }}
              >
                {current.display.slice(current.hitStart, current.hitEnd)}
              </mark>
              {current.display.slice(current.hitEnd)}
            </span>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-medium" style={{ color: palette.textTertiary }}>
            {hasQuery && matches.length > 0
              ? `${matches.length} crew found`
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
