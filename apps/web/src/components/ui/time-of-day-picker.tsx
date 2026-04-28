'use client'

import { useMemo } from 'react'
import { Dropdown } from './dropdown'

/**
 * SkyHub time-of-day picker.
 *
 * Two side-by-side SkyHub Dropdowns (hour + minute). Replaces the native
 * `<input type="time">` browser widget which renders inconsistently across
 * platforms and ignores the design tokens.
 *
 * Designed to be the canonical primitive for any cron / schedule UI in
 * Horizon — Task Scheduler 7.1.6 today, future ASM/SSM auto-transmit
 * windows, hotel email send times, etc.
 *
 * @example
 *   <TimeOfDayPicker value={schedule.time} onChange={setTime} />
 *   <TimeOfDayPicker value="00:30" minuteStep={1} onChange={setTime} />
 */
export interface TimeOfDayPickerProps {
  /** "HH:mm" 24h. */
  value: string
  onChange: (value: string) => void
  /** Minute granularity. Default 5. Use 1 when exact minute matters. */
  minuteStep?: 1 | 5 | 10 | 15 | 30
  disabled?: boolean
  /** Override hour-dropdown width. Default 76. */
  hourWidth?: number
  /** Override minute-dropdown width. Default 76. */
  minuteWidth?: number
}

const HOUR_OPTS = Array.from({ length: 24 }, (_, h) => ({
  value: String(h).padStart(2, '0'),
  label: String(h).padStart(2, '0'),
}))

export function TimeOfDayPicker({
  value,
  onChange,
  minuteStep = 5,
  disabled,
  hourWidth = 76,
  minuteWidth = 76,
}: TimeOfDayPickerProps) {
  const minuteOpts = useMemo(
    () =>
      Array.from({ length: Math.floor(60 / minuteStep) }, (_, i) => ({
        value: String(i * minuteStep).padStart(2, '0'),
        label: String(i * minuteStep).padStart(2, '0'),
      })),
    [minuteStep],
  )

  const [h, m] = (value ?? '00:00').split(':')
  const hour = HOUR_OPTS.some((o) => o.value === h) ? (h as string) : '00'
  // Snap arbitrary minute to the nearest valid step so a custom-minuteStep
  // picker still shows a value when the underlying string is off-grid.
  const minute = (() => {
    if (minuteOpts.some((o) => o.value === m)) return m as string
    const mm = parseInt(m ?? '0', 10) || 0
    const snapped = Math.round(mm / minuteStep) * minuteStep
    return String(Math.min(60 - minuteStep, snapped)).padStart(2, '0')
  })()

  return (
    <div className="flex items-center gap-2">
      <div style={{ width: hourWidth }}>
        <Dropdown
          options={HOUR_OPTS}
          value={hour}
          onChange={(v) => onChange(`${v}:${minute}`)}
          disabled={disabled}
          maxVisible={8}
        />
      </div>
      <span className="text-hz-text-secondary text-[14px] font-semibold">:</span>
      <div style={{ width: minuteWidth }}>
        <Dropdown
          options={minuteOpts}
          value={minute}
          onChange={(v) => onChange(`${hour}:${v}`)}
          disabled={disabled}
          maxVisible={8}
        />
      </div>
    </div>
  )
}
