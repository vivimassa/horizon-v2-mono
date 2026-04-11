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
  return d === 0 ? 6 : d - 1 // Monday = 0
}

function isSameDay(a: string, y: number, m: number, d: number) {
  return a === toISO(y, m, d)
}

// ─── Format for display ─────────────────────────────────────────────────────

function formatDisplay(iso: string): string {
  if (!iso) return ''
  const { year, month, day } = parseISO(iso)
  return `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`
}

// ─── Component ──────────────────────────────────────────────────────────────

interface DatePickerProps {
  value: string // ISO YYYY-MM-DD
  onChange: (iso: string) => void
  placeholder?: string
  /** Compact mode for filter panels */
  compact?: boolean
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  compact = false,
  className = '',
}: DatePickerProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  // Calendar view state — start at selected date or today
  const today = useMemo(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
  }, [])

  const initial = value ? parseISO(value) : today
  const [viewYear, setViewYear] = useState(initial.year)
  const [viewMonth, setViewMonth] = useState(initial.month)

  // Sync view when value changes externally
  useEffect(() => {
    if (value) {
      const p = parseISO(value)
      setViewYear(p.year)
      setViewMonth(p.month)
    }
  }, [value])

  // Position dropdown relative to trigger
  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const dropH = 340 // approximate dropdown height
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow < dropH ? rect.top - dropH - 4 : rect.bottom + 4
    setPos({ top, left: rect.left })
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
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
  }, [open])

  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1)
        return 11
      }
      return m - 1
    })
  }, [])

  const nextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1)
        return 0
      }
      return m + 1
    })
  }, [])

  const selectDate = useCallback(
    (day: number) => {
      onChange(toISO(viewYear, viewMonth, day))
      setOpen(false)
    },
    [viewYear, viewMonth, onChange],
  )

  const handleClear = useCallback(() => {
    onChange('')
    setOpen(false)
  }, [onChange])

  const handleToday = useCallback(() => {
    onChange(toISO(today.year, today.month, today.day))
    setOpen(false)
  }, [today, onChange])

  // Build calendar grid
  const totalDays = daysInMonth(viewYear, viewMonth)
  const offset = startDay(viewYear, viewMonth)
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
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const activeBorder = value ? 'rgba(62,123,250,0.40)' : inputBorder
  const activeInputBg = value ? (isDark ? 'rgba(62,123,250,0.10)' : 'rgba(62,123,250,0.05)') : inputBg

  return (
    <div className={`relative ${className}`}>
      {/* ── Trigger ── */}
      {compact ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[12px] font-mono font-medium transition-all cursor-pointer"
          style={{
            background: activeInputBg,
            border: `1px solid ${activeBorder}`,
            minHeight: 32,
            color: value ? textColor : dimText,
          }}
        >
          <CalendarDays size={12} style={{ color: value ? accent : undefined, opacity: value ? 1 : 0.4 }} />
          <span>{value ? formatDisplay(value) : placeholder}</span>
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] transition-all cursor-pointer"
          style={{
            background: activeInputBg,
            border: `1px solid ${activeBorder}`,
            minHeight: 40,
            color: value ? textColor : dimText,
          }}
        >
          <CalendarDays size={14} style={{ color: value ? accent : undefined, opacity: value ? 1 : 0.4 }} />
          <span className="flex-1 text-left">{value ? formatDisplay(value) : placeholder}</span>
        </button>
      )}

      {/* ── Dropdown Calendar (portal to body) ── */}
      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] rounded-xl overflow-hidden select-none"
            style={{
              width: 280,
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
            {/* Header: month/year + nav */}
            <div className="flex items-center justify-between px-4 py-3">
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
                <div key={d} className="text-center text-[11px] font-semibold py-1" style={{ color: dimText }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Date grid */}
            <div className="grid grid-cols-7 px-3 pb-2">
              {/* Previous month trailing days */}
              {Array.from({ length: offset }).map((_, i) => {
                const day = prevMonthDays - offset + 1 + i
                return (
                  <div
                    key={`p${i}`}
                    className="text-center py-[5px] text-[12px]"
                    style={{ color: dimText, opacity: 0.5 }}
                  >
                    {day}
                  </div>
                )
              })}
              {/* Current month */}
              {Array.from({ length: totalDays }).map((_, i) => {
                const day = i + 1
                const iso = toISO(viewYear, viewMonth, day)
                const isSelected = value === iso
                const isToday = iso === todayISO

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => selectDate(day)}
                    className="relative flex items-center justify-center py-[5px] text-[12px] font-medium rounded-md transition-all"
                    style={{
                      color: isSelected ? '#fff' : isToday ? accent : textColor,
                      background: isSelected ? accent : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = hoverBg
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    {day}
                    {/* Today dot */}
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
                const remaining = (offset + totalDays) % 7
                const trailing = remaining === 0 ? 0 : 7 - remaining
                return Array.from({ length: trailing }).map((_, i) => (
                  <div
                    key={`n${i}`}
                    className="text-center py-[5px] text-[12px]"
                    style={{ color: dimText, opacity: 0.5 }}
                  >
                    {i + 1}
                  </div>
                ))
              })()}
            </div>

            {/* Footer: Clear / Today */}
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ borderTop: `1px solid ${panelBorder}` }}
            >
              <button
                type="button"
                onClick={handleClear}
                className="text-[12px] font-medium transition-colors"
                style={{ color: mutedText }}
                onMouseEnter={(e) => (e.currentTarget.style.color = textColor)}
                onMouseLeave={(e) => (e.currentTarget.style.color = mutedText)}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleToday}
                className="text-[12px] font-medium transition-colors"
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
