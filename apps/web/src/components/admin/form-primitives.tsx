'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { api } from '@skyhub/api'
import { accentTint, type Palette as PaletteType } from '@skyhub/ui/theme'
import { Dropdown } from '@/components/ui/dropdown'

// Accent token — resolves to the active module accent via CSS var. For runtime
// tints (rgba overlays) we still need a hex; #1e40af is the fallback when no
// module accent is set. Inside Flight Ops this becomes #F59E0B automatically.
const ACCENT_VAR = 'var(--module-accent, #1e40af)'
const ACCENT_FALLBACK = '#1e40af'

// ── Shared form primitives for admin pages ──
// Extracted from apps/web/src/app/settings/admin/operator-config/page.tsx so
// the Non-Crew Directory, Disruption dialog, and operator-config can all share.

export function FormField({
  label,
  value,
  fieldKey,
  onChange,
  palette,
  isDark,
  required,
  hint,
  maxLength,
  uppercase,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string | number | null | undefined
  fieldKey: string
  onChange: (key: string, value: string | null) => void
  palette: PaletteType
  isDark: boolean
  required?: boolean
  hint?: string
  maxLength?: number
  uppercase?: boolean
  type?: 'text' | 'email' | 'tel' | 'date' | 'number'
  placeholder?: string
}) {
  return (
    <div>
      <label
        className="text-[12px] uppercase tracking-wider font-semibold mb-1.5 block"
        style={{ color: palette.textSecondary }}
      >
        {label}
        {required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      <input
        type={type}
        value={value ?? ''}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => {
          const v = uppercase ? e.target.value.toUpperCase() : e.target.value
          onChange(fieldKey, v === '' ? null : v)
        }}
        className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none transition-all"
        style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          color: palette.text,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = accentTint(ACCENT_FALLBACK, isDark ? 0.5 : 0.3)
          e.currentTarget.style.boxShadow = `0 0 0 3px ${accentTint(ACCENT_FALLBACK, isDark ? 0.15 : 0.08)}`
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      />
      {hint && (
        <p className="text-[11px] mt-1" style={{ color: palette.textTertiary }}>
          {hint}
        </p>
      )}
    </div>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  palette,
  isDark: _isDark,
  required,
  hint,
}: {
  label: string
  value: T | null | undefined
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  palette: PaletteType
  isDark: boolean
  required?: boolean
  hint?: string
}) {
  return (
    <div>
      <label
        className="text-[12px] uppercase tracking-wider font-semibold mb-1.5 block"
        style={{ color: palette.textSecondary }}
      >
        {label}
        {required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      <Dropdown
        options={options.map((o) => ({ value: o.value, label: o.label }))}
        value={value ?? null}
        onChange={(v) => onChange(v as T)}
        placeholder="Select…"
      />
      {hint && (
        <p className="text-[11px] mt-1" style={{ color: palette.textTertiary }}>
          {hint}
        </p>
      )}
    </div>
  )
}

export function AirportSelectField({
  label,
  value,
  onChange,
  palette,
  isDark,
  required,
  hint,
}: {
  label: string
  value: string | null
  onChange: (v: string | null) => void
  palette: PaletteType
  isDark: boolean
  required?: boolean
  hint?: string
}) {
  const [airports, setAirports] = useState<
    Array<{ iataCode: string | null; icaoCode: string; name: string; city: string | null }>
  >([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api
      .getAirports()
      .then((data) => {
        setAirports(data.map((a) => ({ iataCode: a.iataCode, icaoCode: a.icaoCode, name: a.name, city: a.city })))
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = value ? airports.find((a) => a.icaoCode === value || a.iataCode === value) : null
  const displayLabel = selected
    ? `${selected.iataCode ?? selected.icaoCode} — ${selected.name}${selected.city ? `, ${selected.city}` : ''}`
    : (value ?? '')

  const q = search.toLowerCase()
  const filtered = q
    ? airports
        .filter(
          (a) =>
            a.iataCode?.toLowerCase().includes(q) ||
            a.icaoCode.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            a.city?.toLowerCase().includes(q),
        )
        .slice(0, 30)
    : airports.slice(0, 30)

  return (
    <div ref={containerRef} className="relative">
      <label
        className="text-[12px] uppercase tracking-wider font-semibold mb-1.5 block"
        style={{ color: palette.textSecondary }}
      >
        {label}
        {required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2.5 rounded-xl text-[14px] text-left outline-none transition-all flex items-center justify-between"
        style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
          border: `1px solid ${open ? accentTint(ACCENT_FALLBACK, isDark ? 0.5 : 0.3) : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          color: value ? palette.text : palette.textTertiary,
          boxShadow: open ? `0 0 0 3px ${accentTint(ACCENT_FALLBACK, isDark ? 0.15 : 0.08)}` : 'none',
        }}
      >
        <span className="truncate">{value ? displayLabel : 'Select airport…'}</span>
        <ChevronRight
          size={14}
          color={palette.textTertiary}
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}
        />
      </button>

      {open && (
        <div
          className="absolute z-30 left-0 right-0 mt-1.5 rounded-xl overflow-hidden"
          style={{
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            background: isDark ? '#18181b' : '#ffffff',
            boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.4)' : '0 8px 30px rgba(0,0,0,0.12)',
          }}
        >
          <input
            type="text"
            value={search}
            placeholder="Search IATA, ICAO, name, city…"
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full px-3 py-2.5 text-[13px] outline-none"
            style={{
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              background: 'transparent',
              color: palette.text,
            }}
          />
          <div className="max-h-[240px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-[13px]" style={{ color: palette.textTertiary }}>
                No airports found
              </div>
            ) : (
              filtered.map((a) => {
                const isCurrent = a.icaoCode === value
                return (
                  <button
                    key={a.icaoCode}
                    type="button"
                    className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2 transition-colors"
                    style={{
                      background: isCurrent ? accentTint(ACCENT_FALLBACK, isDark ? 0.1 : 0.06) : 'transparent',
                      color: isCurrent ? ACCENT_VAR : palette.text,
                    }}
                    onClick={() => {
                      onChange(a.icaoCode)
                      setOpen(false)
                      setSearch('')
                    }}
                    onMouseEnter={(e) => {
                      if (!isCurrent)
                        e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isCurrent) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <span className="font-bold w-10 shrink-0">{a.iataCode ?? '—'}</span>
                    <span className="flex-1 truncate">{a.name}</span>
                    <span className="text-[11px] shrink-0" style={{ color: palette.textTertiary }}>
                      {a.city}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
      {hint && (
        <p className="text-[11px] mt-1" style={{ color: palette.textTertiary }}>
          {hint}
        </p>
      )}
    </div>
  )
}
