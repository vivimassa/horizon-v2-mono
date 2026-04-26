'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

/**
 * Single-date variant of DateRangePicker. Same trigger pill + portal calendar
 * look, but only picks one date. Used by 4.1.7.1 Crew Check-In/Out where the
 * controller works one operational day at a time.
 */

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

interface SingleDatePickerProps {
  value: string
  onChange: (iso: string) => void
  className?: string
  /** Trigger placeholder when value is empty (rarely used since we default to today). */
  placeholder?: string
}

export function SingleDatePicker({
  value,
  onChange,
  className = '',
  placeholder = 'PICK A DATE',
}: SingleDatePickerProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  const today = useMemo(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
  }, [])

  const initial = value ? parseISO(value) : today
  const [viewYear, setViewYear] = useState(initial.year)
  const [viewMonth, setViewMonth] = useState(initial.month)

  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const dropH = 360
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow < dropH ? rect.top - dropH - 4 : rect.bottom + 4
    setPos({ top, left: rect.left, width: rect.width })
  }, [open])

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

  const handleOpen = useCallback(() => {
    setOpen(true)
    if (value) {
      const p = parseISO(value)
      setViewYear(p.year)
      setViewMonth(p.month)
    }
  }, [value])

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth((m) => m - 1)
    }
  }, [viewMonth])
  const nextMonth = useCallback(() => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth((m) => m + 1)
    }
  }, [viewMonth])

  const selectDate = useCallback(
    (day: number) => {
      onChange(toISO(viewYear, viewMonth, day))
      setOpen(false)
    },
    [viewYear, viewMonth, onChange],
  )

  const totalDays = daysInMonth(viewYear, viewMonth)
  const calOffset = startDay(viewYear, viewMonth)
  const prevMonthDays = daysInMonth(viewMonth === 0 ? viewYear - 1 : viewYear, viewMonth === 0 ? 11 : viewMonth - 1)
  const todayISO = toISO(today.year, today.month, today.day)

  // Theme tokens (match DateRangePicker exactly)
  const panelBg = isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.98)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const mutedText = isDark ? '#8F90A6' : '#555770'
  const dimText = isDark ? '#555770' : '#8F90A6'
  const textColor = isDark ? '#F5F2FD' : '#1C1C28'
  const accent = 'var(--module-accent, #1e40af)'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  return (
    <div className={className}>
      <div ref={triggerRef} className="cursor-pointer" onClick={handleOpen}>
        <div
          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[13px] font-medium transition-all"
          style={{
            background: value ? (isDark ? 'rgba(62,123,250,0.10)' : 'rgba(62,123,250,0.05)') : inputBg,
            border: `1px solid ${value ? 'rgba(62,123,250,0.40)' : inputBorder}`,
            minHeight: 36,
            color: value ? textColor : dimText,
            outline: open ? `2px solid ${accent}` : 'none',
            outlineOffset: -1,
          }}
        >
          <CalendarDays size={13} style={{ color: value ? accent : undefined, opacity: value ? 1 : 0.5 }} />
          <span>{value ? formatDisplay(value) : placeholder}</span>
        </div>
      </div>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] rounded-xl overflow-hidden select-none"
            style={{
              width: Math.max(296, pos.width),
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
            <div className="px-4 pt-3 pb-1">
              <span className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
                Select date
              </span>
            </div>

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

            <div className="grid grid-cols-7 px-3">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-[13px] font-semibold py-1" style={{ color: dimText }}>
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 px-3 pb-2">
              {Array.from({ length: calOffset }).map((_, i) => {
                const day = prevMonthDays - calOffset + 1 + i
                return (
                  <div
                    key={`p${i}`}
                    className="text-center py-[5px] text-[13px]"
                    style={{ color: dimText, opacity: 0.5 }}
                  >
                    {day}
                  </div>
                )
              })}
              {Array.from({ length: totalDays }).map((_, i) => {
                const day = i + 1
                const iso = toISO(viewYear, viewMonth, day)
                const isSelected = iso === value
                const isToday = iso === todayISO
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => selectDate(day)}
                    className="relative flex items-center justify-center py-[5px] text-[13px] font-medium rounded-md transition-all"
                    style={{
                      color: isSelected ? '#fff' : isToday ? accent : textColor,
                      background: isSelected ? accent : 'transparent',
                    }}
                    onMouseOver={(e) => {
                      if (!isSelected) e.currentTarget.style.background = hoverBg
                    }}
                    onMouseOut={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent'
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
              {(() => {
                const remaining = (calOffset + totalDays) % 7
                const trailing = remaining === 0 ? 0 : 7 - remaining
                return Array.from({ length: trailing }).map((_, i) => (
                  <div
                    key={`n${i}`}
                    className="text-center py-[5px] text-[13px]"
                    style={{ color: dimText, opacity: 0.5 }}
                  >
                    {i + 1}
                  </div>
                ))
              })()}
            </div>

            <div
              className="flex items-center justify-end px-4 py-2.5"
              style={{ borderTop: `1px solid ${panelBorder}` }}
            >
              <button
                type="button"
                onClick={() => {
                  onChange(toISO(today.year, today.month, today.day))
                  setOpen(false)
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
