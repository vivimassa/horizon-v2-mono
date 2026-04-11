'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

// ─── Helpers ────────────────────────────────────────────────────────────────

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseISO(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return { year: y, month: m - 1, day: d }
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function startDay(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

function formatDisplay(iso: string): string {
  if (!iso) return ''
  const { year, month, day } = parseISO(iso)
  return `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`
}

function isBetween(iso: string, from: string, to: string) {
  return iso >= from && iso <= to
}

// ─── Component ──────────────────────────────────────────────────────────────

interface DateRangePickerProps {
  from: string
  to: string
  onChangeFrom: (iso: string) => void
  onChangeTo: (iso: string) => void
  /** Render calendar inline (always visible) instead of in a dropdown portal */
  inline?: boolean
  className?: string
}

export function DateRangePicker({
  from,
  to,
  onChangeFrom,
  onChangeTo,
  inline = false,
  className = '',
}: DateRangePickerProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [open, setOpen] = useState(false)
  /** Which date the next click sets: "from" or "to" */
  const [picking, setPicking] = useState<'from' | 'to'>('from')
  const [hovered, setHovered] = useState('')
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const today = useMemo(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
  }, [])

  const initial = from ? parseISO(from) : today
  const [viewYear, setViewYear] = useState(initial.year)
  const [viewMonth, setViewMonth] = useState(initial.month)

  // Position dropdown (only for non-inline mode)
  useEffect(() => {
    if (inline || !open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const dropH = 380
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow < dropH ? rect.top - dropH - 4 : rect.bottom + 4
    setPos({ top, left: rect.left })
  }, [open, inline])

  // Close on outside click (only for non-inline mode)
  useEffect(() => {
    if (inline || !open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, inline])

  const prevMonth = useCallback(() => {
    const m = viewMonth
    if (m === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth(m - 1)
    }
  }, [viewMonth])

  const nextMonth = useCallback(() => {
    const m = viewMonth
    if (m === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth(m + 1)
    }
  }, [viewMonth])

  const handleOpen = useCallback(() => {
    setPicking('from')
    setOpen(true)
    // Navigate to "from" month if set, else today
    if (from) {
      const p = parseISO(from)
      setViewYear(p.year)
      setViewMonth(p.month)
    }
  }, [from])

  const selectDate = useCallback(
    (day: number) => {
      const iso = toISO(viewYear, viewMonth, day)
      if (picking === 'from') {
        onChangeFrom(iso)
        onChangeTo('') // reset TO so user picks fresh
        setPicking('to')
      } else {
        // Ensure TO >= FROM
        if (from && iso < from) {
          // Clicked before FROM — swap: this becomes new FROM, old FROM becomes TO
          onChangeTo(from)
          onChangeFrom(iso)
        } else {
          onChangeTo(iso)
        }
        if (!inline) setOpen(false)
        setPicking('from')
      }
    },
    [viewYear, viewMonth, picking, from, onChangeFrom, onChangeTo, inline],
  )

  const handleClear = useCallback(() => {
    onChangeFrom('')
    onChangeTo('')
    setPicking('from')
  }, [onChangeFrom, onChangeTo])

  // Build calendar grid
  const totalDays = daysInMonth(viewYear, viewMonth)
  const calOffset = startDay(viewYear, viewMonth)
  const prevMonthDays = daysInMonth(viewMonth === 0 ? viewYear - 1 : viewYear, viewMonth === 0 ? 11 : viewMonth - 1)
  const todayISO = toISO(today.year, today.month, today.day)

  // Theme colors
  const panelBg = isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.98)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const mutedText = isDark ? '#8F90A6' : '#555770'
  const dimText = isDark ? '#555770' : '#8F90A6'
  const textColor = isDark ? '#F5F2FD' : '#1C1C28'
  const accent = 'var(--module-accent, #1e40af)'
  const rangeBg = isDark ? 'rgba(62,123,250,0.12)' : 'rgba(62,123,250,0.08)'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  // Range highlight helpers
  const rangeFrom = from || ''
  const rangeTo = to || (picking === 'to' ? hovered : '')

  const getFromBorder = (v: string) => (v ? 'rgba(62,123,250,0.40)' : inputBorder)
  const getToBorder = (v: string) => (v ? 'rgba(62,123,250,0.40)' : inputBorder)
  const getActiveBg = (v: string) => (v ? (isDark ? 'rgba(62,123,250,0.10)' : 'rgba(62,123,250,0.05)') : inputBg)

  // ── Shared calendar body ──
  const calendarBody = (
    <>
      {/* Header: month/year + nav */}
      <div className="flex items-center justify-between px-4 py-2">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1 rounded-md transition-colors"
          style={{ color: mutedText }}
          onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-[13px] font-semibold" style={{ color: textColor }}>
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1 rounded-md transition-colors"
          style={{ color: mutedText }}
          onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 px-3">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[13px] font-semibold py-1" style={{ color: dimText }}>
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 px-3 pb-2">
        {/* Previous month trailing days */}
        {Array.from({ length: calOffset }).map((_, i) => {
          const day = prevMonthDays - calOffset + 1 + i
          return (
            <div key={`p${i}`} className="text-center py-[5px] text-[13px]" style={{ color: dimText, opacity: 0.5 }}>
              {day}
            </div>
          )
        })}
        {/* Current month */}
        {Array.from({ length: totalDays }).map((_, i) => {
          const day = i + 1
          const iso = toISO(viewYear, viewMonth, day)
          const isFrom = iso === rangeFrom
          const isTo = iso === rangeTo
          const isSelected = isFrom || isTo
          const isInRange = rangeFrom && rangeTo && rangeFrom < rangeTo && isBetween(iso, rangeFrom, rangeTo)
          const isToday = iso === todayISO

          return (
            <button
              key={day}
              type="button"
              onClick={() => selectDate(day)}
              onMouseEnter={() => setHovered(iso)}
              onMouseLeave={() => setHovered('')}
              className="relative flex items-center justify-center py-[5px] text-[13px] font-medium rounded-md transition-all"
              style={{
                color: isSelected ? '#fff' : isToday ? accent : textColor,
                background: isSelected ? accent : isInRange ? rangeBg : 'transparent',
                borderRadius:
                  isFrom && isInRange ? '6px 0 0 6px' : isTo && isInRange ? '0 6px 6px 0' : isInRange ? 0 : undefined,
              }}
              onMouseOver={(e) => {
                if (!isSelected && !isInRange) e.currentTarget.style.background = hoverBg
              }}
              onMouseOut={(e) => {
                if (!isSelected && !isInRange) e.currentTarget.style.background = 'transparent'
              }}
            >
              {day}
              {isToday && !isSelected && (
                <span
                  className="absolute bottom-[2px] left-1/2 -translate-x-1/2 rounded-full"
                  style={{ width: 3, height: 3, background: accent }}
                />
              )}
            </button>
          )
        })}
        {/* Next month leading days */}
        {(() => {
          const remaining = (calOffset + totalDays) % 7
          const trailing = remaining === 0 ? 0 : 7 - remaining
          return Array.from({ length: trailing }).map((_, i) => (
            <div key={`n${i}`} className="text-center py-[5px] text-[13px]" style={{ color: dimText, opacity: 0.5 }}>
              {i + 1}
            </div>
          ))
        })()}
      </div>
    </>
  )

  // ── From / To pills ──
  const pillsRow = (
    <div className="grid grid-cols-2 gap-1.5">
      <button
        type="button"
        onClick={() => setPicking('from')}
        className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[13px] font-medium transition-all"
        style={{
          background: picking === 'from' ? accent : getActiveBg(from),
          border: picking === 'from' ? 'none' : `1px solid ${getFromBorder(from)}`,
          minHeight: 32,
          color: picking === 'from' ? '#fff' : from ? textColor : dimText,
        }}
      >
        <CalendarDays size={12} style={{ opacity: from || picking === 'from' ? 1 : 0.4 }} />
        <span>{from ? formatDisplay(from) : 'From\u2026'}</span>
      </button>
      <button
        type="button"
        onClick={() => setPicking('to')}
        className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[13px] font-medium transition-all"
        style={{
          background: picking === 'to' ? accent : getActiveBg(to),
          border: picking === 'to' ? 'none' : `1px solid ${getToBorder(to)}`,
          minHeight: 32,
          color: picking === 'to' ? '#fff' : to ? textColor : dimText,
        }}
      >
        <CalendarDays size={12} style={{ opacity: to || picking === 'to' ? 1 : 0.4 }} />
        <span>{to ? formatDisplay(to) : 'To\u2026'}</span>
      </button>
    </div>
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // INLINE MODE — calendar always visible, no portal
  // ═══════════════════════════════════════════════════════════════════════════
  if (inline) {
    return (
      <div className={className}>
        {pillsRow}
        <div
          className="mt-2 rounded-xl overflow-hidden select-none"
          style={{
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            border: `1px solid ${panelBorder}`,
          }}
        >
          {calendarBody}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DROPDOWN MODE — original popup behavior
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className={className}>
      {/* ── Trigger: two pills side-by-side ── */}
      <div ref={triggerRef} className="grid grid-cols-2 gap-1.5 cursor-pointer" onClick={handleOpen}>
        <div
          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[13px] font-medium transition-all"
          style={{
            background: getActiveBg(from),
            border: `1px solid ${getFromBorder(from)}`,
            minHeight: 32,
            color: from ? textColor : dimText,
            outline: open && picking === 'from' ? `2px solid ${accent}` : 'none',
            outlineOffset: -1,
          }}
        >
          <CalendarDays size={12} style={{ color: from ? accent : undefined, opacity: from ? 1 : 0.4 }} />
          <span>{from ? formatDisplay(from) : 'FROM'}</span>
        </div>
        <div
          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[13px] font-medium transition-all"
          style={{
            background: getActiveBg(to),
            border: `1px solid ${getToBorder(to)}`,
            minHeight: 32,
            color: to ? textColor : dimText,
            outline: open && picking === 'to' ? `2px solid ${accent}` : 'none',
            outlineOffset: -1,
          }}
        >
          <CalendarDays size={12} style={{ color: to ? accent : undefined, opacity: to ? 1 : 0.4 }} />
          <span>{to ? formatDisplay(to) : 'TO'}</span>
        </div>
      </div>

      {/* ── Dropdown Calendar (portal) ── */}
      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] rounded-xl overflow-hidden select-none"
            style={{
              width: 296,
              top: pos.top,
              left: pos.left,
              background: panelBg,
              border: `1px solid ${panelBorder}`,
              backdropFilter: 'blur(20px)',
              boxShadow: isDark
                ? '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)'
                : '0 8px 32px rgba(96,97,112,0.14), 0 2px 8px rgba(96,97,112,0.08)',
            }}
          >
            {/* Picking indicator */}
            <div className="px-4 pt-3 pb-1">
              <span className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
                {picking === 'from' ? 'Select start date' : 'Select end date'}
              </span>
            </div>

            {calendarBody}

            {/* Footer */}
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ borderTop: `1px solid ${panelBorder}` }}
            >
              <button
                type="button"
                onClick={handleClear}
                className="text-[13px] font-medium transition-colors"
                style={{ color: mutedText }}
                onMouseEnter={(e) => (e.currentTarget.style.color = textColor)}
                onMouseLeave={(e) => (e.currentTarget.style.color = mutedText)}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  const t = toISO(today.year, today.month, today.day)
                  if (picking === 'from') {
                    onChangeFrom(t)
                    setPicking('to')
                  } else {
                    onChangeTo(t)
                    setOpen(false)
                  }
                }}
                className="text-[13px] font-medium transition-colors"
                style={{ color: accent }}
              >
                Today
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
