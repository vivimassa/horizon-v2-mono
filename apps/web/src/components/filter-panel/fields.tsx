'use client'

import { useRef, useState, useEffect, type ReactNode } from 'react'
import { ChevronDown, Check, Loader2, Search } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Dropdown } from '@/components/ui/dropdown'
import { collapseDock } from '@/lib/dock-store'
import { useFilterPanelControl } from './panel'

/* ─────────────────────────────────────────────────────────────
 * FilterSection — labeled wrapper for a single field.
 * ───────────────────────────────────────────────────────────── */
export function FilterSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary block">{label}</label>
      {children}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * PeriodField — DateRangePicker wrapped with consistent sizing.
 * ───────────────────────────────────────────────────────────── */
interface PeriodFieldProps {
  from: string
  to: string
  onChangeFrom: (value: string) => void
  onChangeTo: (value: string) => void
}
export function PeriodField({ from, to, onChangeFrom, onChangeTo }: PeriodFieldProps) {
  return <DateRangePicker from={from} to={to} onChangeFrom={onChangeFrom} onChangeTo={onChangeTo} inline />
}

/* ─────────────────────────────────────────────────────────────
 * RollingPeriodField — slider for live-ops windows. Off = fixed
 * period picked via PeriodField; any other stop = N-day window
 * that re-anchors to today on each refresh. Caller disables
 * PeriodField when the slider is active. Pass `stops` to override
 * the default (Off · 3D · 4D · 5D · 6D · 7D).
 * ───────────────────────────────────────────────────────────── */
export type RollingStop = { label: string; value: number | null }

const DEFAULT_ROLLING_STOPS: RollingStop[] = [
  { label: 'Off', value: null },
  { label: '3D', value: 3 },
  { label: '4D', value: 4 },
  { label: '5D', value: 5 },
  { label: '6D', value: 6 },
  { label: '7D', value: 7 },
]

interface RollingPeriodFieldProps {
  value: number | null
  onChange: (v: number | null) => void
  stops?: RollingStop[]
}
export function RollingPeriodField({ value, onChange, stops = DEFAULT_ROLLING_STOPS }: RollingPeriodFieldProps) {
  const idx = Math.max(
    0,
    stops.findIndex((s) => s.value === value),
  )
  const max = stops.length - 1
  const pct = (idx / max) * 100
  const accent = 'var(--module-accent, #1e40af)'
  return (
    <div className="select-none">
      <div className="relative h-9 flex items-center">
        <div className="absolute left-0 right-0 h-1 rounded-full" style={{ background: 'rgba(125,125,140,0.25)' }} />
        <div className="absolute left-0 h-1 rounded-full" style={{ width: `${pct}%`, background: accent }} />
        {stops.map((_s, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `calc(${(i / max) * 100}% - 3px)`,
              width: 6,
              height: 6,
              background: i <= idx ? accent : 'rgba(125,125,140,0.45)',
            }}
          />
        ))}
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={idx}
          onChange={(e) => onChange(stops[parseInt(e.target.value, 10)].value)}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          aria-label="Rolling period"
        />
        <div
          className="absolute rounded-full shadow-md pointer-events-none"
          style={{
            left: `calc(${pct}% - 8px)`,
            width: 16,
            height: 16,
            background: '#fff',
            border: `2px solid ${accent}`,
          }}
        />
      </div>
      <div className="flex justify-between mt-1">
        {stops.map((s, i) => (
          <span
            key={i}
            className="text-[13px] font-medium"
            style={{ color: i === idx ? accent : 'var(--hz-text-tertiary)' }}
          >
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * SegmentedField — row of mutually-exclusive pills (Sort Order,
 * Color Mode, view tabs). Active segment takes an accent tint.
 * ───────────────────────────────────────────────────────────── */
interface SegmentedOption<T extends string> {
  key: T
  label: string
}
interface SegmentedFieldProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (v: T) => void
}
export function SegmentedField<T extends string>({ options, value, onChange }: SegmentedFieldProps<T>) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const inputBorder = isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)'
  const activeBg = isDark ? 'rgba(62,123,250,0.15)' : 'rgba(30,64,175,0.10)'
  const activeColor = isDark ? '#5B8DEF' : '#1e40af'
  const inactiveColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'

  return (
    <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${inputBorder}` }}>
      {options.map((opt) => {
        const active = opt.key === value
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className="flex-1 py-2 text-[13px] font-semibold transition-colors duration-150"
            style={active ? { background: activeBg, color: activeColor } : { color: inactiveColor }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * MultiSelectField — dropdown with checkbox items. Options may
 * carry an optional color (used for colored swatches on things
 * like schedule status). `value` is an array of selected keys;
 * empty === nothing selected, value.length === options.length
 * === everything selected.
 * ───────────────────────────────────────────────────────────── */
export interface MultiSelectOption {
  key: string
  label: string
  color?: string
}
interface MultiSelectFieldProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (keys: string[]) => void
  /** Label shown when all options are selected (e.g. "All Types"). */
  allLabel?: string
  /** Label shown when no options are selected. */
  noneLabel?: string
  placeholder?: string
  /** Show a search input above the options list (useful for long lists). */
  searchable?: boolean
  searchPlaceholder?: string
  /** Which field to show in the summary line when a subset is selected.
   * Use 'key' for short codes (IATA, aircraft ICAO); defaults to 'label'. */
  summaryBy?: 'key' | 'label'
  /** Above this many selected items, the summary collapses to "N selected". */
  summaryMax?: number
}
export function MultiSelectField({
  options,
  value,
  onChange,
  allLabel,
  noneLabel = 'None',
  placeholder = 'Select…',
  searchable = false,
  searchPlaceholder = 'Search…',
  summaryBy = 'label',
  summaryMax = 4,
}: MultiSelectFieldProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)'
  const menuBg = isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.98)'
  const menuShadow = isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(96,97,112,0.12)'
  const accentColor = 'var(--module-accent, #1e40af)'

  const valueSet = new Set(value)
  const allSelected = value.length === options.length && options.length > 0
  const noneSelected = value.length === 0

  const displayLabel = (() => {
    if (allSelected && allLabel) return allLabel
    if (noneSelected) return noneLabel
    const selected = options.filter((o) => valueSet.has(o.key))
    if (selected.length > summaryMax) return `${selected.length} selected`
    return selected.map((o) => (summaryBy === 'key' ? o.key : o.label)).join(', ')
  })()

  function toggle(key: string) {
    const next = new Set(valueSet)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange(options.filter((o) => next.has(o.key)).map((o) => o.key))
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full h-9 flex items-center justify-between px-3 rounded-xl text-[13px] font-medium transition-colors"
        style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
      >
        <span className="truncate text-hz-text">{displayLabel || placeholder}</span>
        <ChevronDown
          size={14}
          className={`text-hz-text-tertiary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-xl overflow-hidden"
          style={{
            background: menuBg,
            border: `1px solid ${inputBorder}`,
            boxShadow: menuShadow,
          }}
        >
          {searchable && (
            <div className="px-2 pt-2 pb-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-7 px-2 rounded-lg text-[13px] outline-none text-hz-text placeholder:text-hz-text-tertiary"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  border: `1px solid ${inputBorder}`,
                }}
              />
            </div>
          )}
          <div className={searchable ? 'max-h-[220px] overflow-y-auto py-1' : 'py-1'}>
            {(() => {
              const q = search.trim().toLowerCase()
              const filtered = q
                ? options.filter((o) => o.key.toLowerCase().includes(q) || o.label.toLowerCase().includes(q))
                : options
              if (filtered.length === 0) {
                return <div className="px-3 py-2 text-[13px] text-hz-text-tertiary">No matches</div>
              }
              return filtered.map((opt) => {
                const checked = valueSet.has(opt.key)
                const swatch = opt.color ?? accentColor
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => toggle(opt.key)}
                    className="w-full flex items-center gap-2.5 h-8 px-3 hover:bg-hz-border/20 transition-colors"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0"
                      style={{
                        borderColor: checked ? swatch : isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)',
                        background: checked ? swatch : 'transparent',
                      }}
                    >
                      {checked && <Check size={10} strokeWidth={3} color="#fff" />}
                    </span>
                    <span className="text-[13px] font-medium text-hz-text truncate">{opt.label}</span>
                  </button>
                )
              })
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * SelectField — single-select dropdown. Thin wrapper over the
 * shared <Dropdown> with the kit's naming convention. Use the
 * empty-string convention for the "All / none picked" option.
 * ───────────────────────────────────────────────────────────── */
interface SelectFieldOption {
  value: string
  label: string
}
interface SelectFieldProps {
  options: SelectFieldOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
}
export function SelectField({ options, value, onChange, placeholder }: SelectFieldProps) {
  return <Dropdown value={value || null} options={options} onChange={onChange} placeholder={placeholder} />
}

/* ─────────────────────────────────────────────────────────────
 * FilterGoButton — primary CTA for the panel footer. Collapses
 * the bottom dock automatically before firing the caller's click.
 * ───────────────────────────────────────────────────────────── */
interface FilterGoButtonProps {
  onClick: () => void
  loading?: boolean
  disabled?: boolean
  label?: string
  loadingLabel?: string
  /** Small helper text shown below the button (e.g. a disabled-reason). */
  hint?: string
}
export function FilterGoButton({
  onClick,
  loading = false,
  disabled = false,
  label = 'Go',
  loadingLabel = 'Loading…',
  hint,
}: FilterGoButtonProps) {
  const panelControl = useFilterPanelControl()
  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (disabled || loading) return
          // Fold the bottom dock AND the filter panel so the workspace
          // gets full screen real estate the moment the load starts.
          collapseDock()
          panelControl?.setCollapsed(true)
          onClick()
        }}
        disabled={disabled || loading}
        className="w-full h-9 flex items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        {loading ? loadingLabel : label}
      </button>
      {hint && <p className="text-[13px] text-hz-text-secondary mt-1.5 text-center">{hint}</p>}
    </>
  )
}
