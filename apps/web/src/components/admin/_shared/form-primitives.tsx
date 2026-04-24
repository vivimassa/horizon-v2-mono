'use client'

/**
 * Shared form primitives for System Administration (7.x) config shells.
 *
 * Extracted from 7.1.5.2 ACARS/MVT/LDM Transmission so that 7.1.5.1 ASM/SSM
 * Transmission and any future admin config screens can match the exact same
 * visual language (toggle geometry, stepper heights, form-row spacing).
 *
 * These primitives follow the Horizon v2 design contract:
 *   - 13px minimum font, Medium for labels, Regular for descriptions
 *   - 40px input height, 8px radius
 *   - Accent passed in by caller (admin screens use MODULE_THEMES.sysadmin.accent)
 *   - No hardcoded hex in component styles (except semantic green/red alerts)
 */

import * as React from 'react'
import { useTheme } from '@/components/theme-provider'

/** Contextual help copy shown above a section body. */
export function HelpBlock({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-hz-text-secondary leading-relaxed max-w-2xl mb-5">{children}</p>
}

/**
 * Subtle card wrapper for splitting a section body into side-by-side columns
 * at wider breakpoints. Pair with `grid grid-cols-1 xl:grid-cols-2 gap-4` on
 * the parent to get the two-column layout on desktop while stacking on
 * tablet/mobile.
 *
 * The heading block (optional) sits above the children with a 1px divider,
 * mirroring the visual grammar of the page-level section header.
 */
export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title?: string
  subtitle?: string
  children: React.ReactNode
}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      {title && (
        <div className="mb-4 pb-3 border-b border-hz-border/40">
          <h3 className="text-[15px] font-bold text-hz-text leading-tight">{title}</h3>
          {subtitle && <p className="text-[13px] text-hz-text-secondary mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  )
}

/** A label/description/control row with a bottom divider.
 *
 * By default label and control sit side-by-side. Pass `stacked` to put the
 * control on a new row below the label — useful when the control is a wide
 * chip row, grid, or multi-select that shouldn't compete with label text
 * for horizontal space (especially inside narrow SectionCards). */
export function FormRow({
  label,
  description,
  children,
  indent,
  verticalAlign,
  stacked,
}: {
  label: string
  description: string
  children: React.ReactNode
  indent?: boolean
  verticalAlign?: boolean
  stacked?: boolean
}) {
  if (stacked) {
    return (
      <div className={`py-4 border-b border-hz-border/40 last:border-b-0 ${indent ? 'pl-8' : ''}`}>
        <div className="text-[13px] font-medium text-hz-text">{label}</div>
        <div className="text-[13px] text-hz-text-secondary mt-0.5 mb-3 leading-[18px]">{description}</div>
        {children}
      </div>
    )
  }

  return (
    <div
      className={`flex py-4 gap-6 border-b border-hz-border/40 last:border-b-0 ${indent ? 'pl-8' : ''} ${verticalAlign ? 'items-start' : 'items-center'}`}
    >
      <div className="flex-1 min-w-0 pr-4">
        <div className="text-[13px] font-medium text-hz-text">{label}</div>
        <div className="text-[13px] text-hz-text-secondary mt-0.5 leading-[18px]">{description}</div>
      </div>
      <div className={`shrink-0 ${verticalAlign ? '' : 'flex items-center'}`}>{children}</div>
    </div>
  )
}

/** Switch-style on/off toggle. Pass `danger` for destructive-action toggles. */
export function Toggle({
  checked,
  onChange,
  accent,
  danger,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  accent: string
  danger?: boolean
}) {
  const on = danger ? '#FF8800' : accent
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className="shrink-0 rounded-full relative transition-colors duration-200"
      style={{
        width: 40,
        height: 22,
        background: checked ? on : 'rgba(125,125,140,0.30)',
      }}
    >
      <div
        className="absolute top-[2px] rounded-full bg-white transition-all duration-200"
        style={{
          width: 18,
          height: 18,
          left: checked ? 20 : 2,
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  )
}

/** Slider with a live-read value badge. Step is always 1. */
export function RangeStepper({
  value,
  onChange,
  min,
  max,
  suffix,
  accent,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  suffix: string
  accent: string
}) {
  return (
    <div className="flex items-center gap-3 min-w-[220px]">
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="flex-1 h-1.5"
        style={{ accentColor: accent }}
      />
      <span className="text-[13px] font-mono font-semibold text-hz-text w-12 text-right">
        {value}
        {suffix}
      </span>
    </div>
  )
}

/** − / value / + stepper for numeric values. */
export function NumberStepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  suffix: string
}) {
  const btn =
    'w-10 h-10 flex items-center justify-center text-[15px] font-semibold text-hz-text-secondary hover:bg-hz-border/30 disabled:opacity-30 transition-colors'
  const [draft, setDraft] = React.useState<string>(String(value))
  const [focused, setFocused] = React.useState(false)
  React.useEffect(() => {
    if (!focused) setDraft(String(value))
  }, [value, focused])
  const commit = () => {
    const parsed = Number(draft)
    if (!Number.isFinite(parsed)) {
      setDraft(String(value))
      return
    }
    const clamped = Math.max(min, Math.min(max, Math.round(parsed / step) * step))
    if (clamped !== value) onChange(clamped)
    setDraft(String(clamped))
  }
  return (
    <div
      className="inline-flex items-center rounded-lg overflow-hidden w-fit"
      style={{ border: '1px solid var(--color-hz-border)' }}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
        className={`${btn} rounded-l-lg`}
      >
        −
      </button>
      <div className="h-10 w-[88px] px-2 flex items-center justify-center gap-1 text-[13px] font-mono font-medium text-hz-text border-x border-hz-border/60">
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9.\-]/g, ''))}
          onFocus={(e) => {
            setFocused(true)
            e.currentTarget.select()
          }}
          onBlur={() => {
            commit()
            setFocused(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur()
            } else if (e.key === 'Escape') {
              setDraft(String(value))
              e.currentTarget.blur()
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              onChange(Math.min(max, value + step))
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              onChange(Math.max(min, value - step))
            }
          }}
          className={`w-full bg-transparent outline-none text-[13px] font-mono font-medium text-hz-text ${suffix ? 'text-right' : 'text-center'}`}
        />
        {suffix ? <span className="text-hz-text-tertiary shrink-0">{suffix}</span> : null}
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
        className={`${btn} rounded-r-lg`}
      >
        +
      </button>
    </div>
  )
}
