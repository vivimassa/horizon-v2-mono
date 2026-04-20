'use client'

import type { Copy } from 'lucide-react'
import { Users, UserPlus, Users2, Sparkles, Timer } from 'lucide-react'
import type { PairingFlight, LegalityResult } from '../types'

export const ACCENT = '#7c3aed' // Crew Ops workforce accent (MODULE_THEMES.workforce)

/* ── Section header w/ accent bar ─────────────────────────────── */
export function SectionHeader({ title, isDark }: { title: string; isDark: boolean }) {
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(71,85,105,0.75)'
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="w-0.5 h-3.5 rounded-full" style={{ background: ACCENT }} />
      <h4 className="text-[11px] font-bold tracking-[0.14em] uppercase" style={{ color: textSecondary }}>
        {title}
      </h4>
    </div>
  )
}

/* ── Complement selector (Standard / Aug1 / Aug2 / Custom) ────── */
export function ComplementSelector({
  value,
  onChange,
  isDark,
}: {
  value: 'standard' | 'aug1' | 'aug2' | 'custom'
  onChange: (v: 'standard' | 'aug1' | 'aug2' | 'custom') => void
  isDark: boolean
}) {
  const options: Array<{
    key: 'standard' | 'aug1' | 'aug2' | 'custom'
    label: string
    Icon: typeof Users
    sub: string
  }> = [
    { key: 'standard', label: 'Standard', Icon: Users, sub: '2 pilots' },
    { key: 'aug1', label: 'Aug 1', Icon: UserPlus, sub: '3 pilots' },
    { key: 'aug2', label: 'Aug 2', Icon: Users2, sub: '4 pilots' },
    { key: 'custom', label: 'Custom', Icon: Sparkles, sub: 'manual' },
  ]
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'
  return (
    <div className="grid grid-cols-4 gap-1">
      {options.map((o) => {
        const active = o.key === value
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg transition-all hover:brightness-105"
            style={{
              background: active ? ACCENT : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
              border: active ? `1px solid ${ACCENT}` : `1px solid ${divider}`,
              color: active ? '#fff' : isDark ? 'rgba(255,255,255,0.85)' : 'rgba(15,23,42,0.85)',
            }}
          >
            <o.Icon size={14} strokeWidth={2} />
            <span className="text-[11px] font-bold">{o.label}</span>
            <span className="text-[11px] opacity-75 tracking-wide">{o.sub}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ── One row in the selected-flights list ─────────────────────── */
export function SelectedLegRow({ index, flight, isDark }: { index: number; flight: PairingFlight; isDark: boolean }) {
  const textPrimary = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)'
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(71,85,105,0.75)'
  const textTertiary = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(100,116,139,0.65)'
  const divider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md"
      style={{
        background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
        border: `1px solid ${divider}`,
      }}
    >
      <span
        className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold tabular-nums shrink-0"
        style={{ background: `${ACCENT}22`, color: ACCENT }}
      >
        {index + 1}
      </span>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-[12px] font-bold tabular-nums" style={{ color: textPrimary }}>
          {flight.flightNumber}
        </span>
        <span className="text-[12px] font-medium tabular-nums" style={{ color: textSecondary }}>
          {flight.departureAirport} → {flight.arrivalAirport}
        </span>
      </div>
      <span className="text-[11px] tabular-nums" style={{ color: textTertiary }}>
        {flight.stdUtc.slice(11, 16)}
      </span>
    </div>
  )
}

/* ── Ground-time row shown between two consecutive legs ──────── */
export function GroundTimeRow({ minutes, station, isDark }: { minutes: number; station: string; isDark: boolean }) {
  const textMuted = isDark ? 'rgba(255,255,255,0.48)' : 'rgba(71,85,105,0.70)'
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'
  // Mild color cues: tight turnarounds < 30m hint orange, otherwise neutral.
  const color = minutes < 30 ? '#FF8800' : textMuted
  return (
    <div className="flex items-center gap-2 pl-6 pr-2 py-0.5">
      <div className="w-px h-3 ml-[0.4rem]" style={{ background: divider }} />
      <Timer size={10} strokeWidth={2.2} style={{ color }} />
      <span className="text-[10px] font-semibold tabular-nums tracking-[0.04em]" style={{ color }}>
        {formatGroundTime(minutes)} ground · {station}
      </span>
    </div>
  )
}

function formatGroundTime(mins: number): string {
  if (mins <= 0) return '0m'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/* ── FDTL legality checks list ─────────────────────────────────── */
export function LegalityChecks({ result, isDark }: { result: LegalityResult; isDark: boolean }) {
  const textPrimary = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)'
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(71,85,105,0.75)'
  const textTertiary = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(100,116,139,0.65)'
  const divider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'

  return (
    <div className="space-y-1">
      {result.checks.map((c, i) => {
        const color =
          c.status === 'violation'
            ? '#FF3B3B'
            : c.status === 'warning'
              ? '#FF8800'
              : c.status === 'pass'
                ? '#06C270'
                : '#0063F7'
        return (
          <div
            key={i}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md"
            style={{
              background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
              border: `1px solid ${divider}`,
            }}
          >
            <span className="w-1 h-4 rounded-full" style={{ background: color }} />
            <span className="text-[12px] font-semibold" style={{ color: textPrimary }}>
              {c.label}
            </span>
            <span className="ml-auto text-[12px] tabular-nums" style={{ color: textSecondary }}>
              {c.actual}
            </span>
            <span className="text-[11px] tabular-nums" style={{ color: textTertiary }}>
              / {c.limit}
            </span>
          </div>
        )
      })}
      {result.tableRef && (
        <p className="text-[10px] italic pt-1" style={{ color: textTertiary }}>
          Ref: {result.tableRef}
        </p>
      )}
    </div>
  )
}

/* ── Reusable action button for the inspector footer ──────────── */
export function ActionButton({
  icon: Icon,
  label,
  isDark,
  destructive,
  primary,
  onClick,
  disabled,
}: {
  icon: typeof Copy
  label: string
  isDark: boolean
  destructive?: boolean
  primary?: boolean
  onClick?: () => void
  disabled?: boolean
}) {
  const textPrimary = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)'
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'

  const bg = destructive
    ? 'rgba(230,53,53,0.12)'
    : primary
      ? ACCENT
      : isDark
        ? 'rgba(255,255,255,0.04)'
        : 'rgba(15,23,42,0.04)'
  const color = destructive ? '#E63535' : primary ? '#fff' : textPrimary
  const border = destructive
    ? '1px solid rgba(230,53,53,0.35)'
    : primary
      ? `1px solid ${ACCENT}`
      : `1px solid ${divider}`

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
      style={{ background: bg, color, border }}
    >
      <Icon size={13} strokeWidth={2.2} />
      {label}
    </button>
  )
}

export function complementLabel(key: string): string {
  switch (key) {
    case 'standard':
      return 'Standard'
    case 'aug1':
      return 'Augmented 1'
    case 'aug2':
      return 'Augmented 2'
    case 'custom':
      return 'Custom'
    default:
      return key
  }
}
