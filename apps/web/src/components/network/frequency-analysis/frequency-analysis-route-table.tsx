'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, Route as RouteIcon } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { fmtHM, freqFromDow } from './compute-frequency'
import type { DetailRoute, FrequencyFlightRow } from './frequency-analysis-types'

interface FrequencyAnalysisRouteTableProps {
  routes: DetailRoute[]
  acTypeColors: Map<string, string>
}

const ROUTES_VISIBLE_INITIAL = 20

export function FrequencyAnalysisRouteTable({ routes, acTypeColors }: FrequencyAnalysisRouteTableProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)

  const visible = showAll ? routes : routes.slice(0, ROUTES_VISIBLE_INITIAL)
  const hiddenCount = routes.length - visible.length

  const cardBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.92)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const rowHover = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)'
  const rowBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const subRowBg = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'

  const toggle = (route: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(route)) next.delete(route)
      else next.add(route)
      return next
    })
  }

  return (
    <section
      className="rounded-2xl p-4"
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: '0 2px 10px rgba(96,97,112,0.06)',
      }}
    >
      <Header
        title="Route Frequency Detail"
        subtitle={`${routes.length} routes · expand a row to view flight definitions`}
      />

      <div className="mt-3 rounded-xl overflow-hidden" style={{ border: `1px solid ${rowBorder}` }}>
        {/* Header row */}
        <div
          className="grid grid-cols-[1.6fr_0.7fr_0.8fr_1.4fr_0.8fr_0.8fr_0.8fr] items-center px-3 py-2 text-[13px] font-medium uppercase tracking-wide text-hz-text-tertiary text-center"
          style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
        >
          <span>Route</span>
          <span>Flights</span>
          <span>Freq/wk</span>
          <span>DOW</span>
          <span>Types</span>
          <span>Total Deps</span>
          <span>Weekly Hrs</span>
        </div>

        {visible.length === 0 ? (
          <div className="px-3 py-6 text-center text-[13px] text-hz-text-tertiary">
            No routes match the current filters.
          </div>
        ) : (
          visible.map((r, idx) => {
            const isOpen = expanded.has(r.route)
            const rowStriped = idx % 2 === 1
            return (
              <div
                key={r.route}
                className="border-t"
                style={{ borderColor: rowBorder, background: rowStriped ? rowHover : 'transparent' }}
              >
                <button
                  type="button"
                  onClick={() => toggle(r.route)}
                  className="w-full grid grid-cols-[1.6fr_0.7fr_0.8fr_1.4fr_0.8fr_0.8fr_0.8fr] items-center px-3 py-2.5 text-[13px] text-center hover:bg-hz-border/20 transition-colors"
                  style={{ minHeight: 44 }}
                >
                  <div className="flex items-center justify-center gap-2 min-w-0">
                    <ChevronRight
                      size={14}
                      className={`shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      style={{ color: 'var(--module-accent, #1e40af)' }}
                    />
                    <span className="font-semibold text-hz-text truncate">{r.route}</span>
                  </div>
                  <span className="font-medium tabular-nums">{r.flights.length}</span>
                  <span className="font-bold tabular-nums" style={{ color: 'var(--module-accent, #1e40af)' }}>
                    {r.weeklyFreq}
                  </span>
                  <div className="flex justify-center">
                    <DowPills dow={combineDow(r.flights)} />
                  </div>
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    {r.types.map((t) => (
                      <TypePill key={t} label={t} color={acTypeColors.get(t)} />
                    ))}
                  </div>
                  <span className="font-medium tabular-nums">{r.totalDeps}</span>
                  <span className="font-medium tabular-nums">{fmtHM(r.weeklyBlockMin)}</span>
                </button>

                {isOpen && (
                  <div style={{ background: subRowBg, borderTop: `1px solid ${rowBorder}` }}>
                    <div className="grid grid-cols-[1fr_0.9fr_0.9fr_0.7fr_0.7fr_1.4fr_0.7fr_0.7fr_0.9fr] items-center px-3 py-2 text-[13px] font-medium uppercase tracking-wide text-hz-text-tertiary text-center">
                      <span>Flight</span>
                      <span>STD</span>
                      <span>STA</span>
                      <span>Type</span>
                      <span>Svc</span>
                      <span>DOW</span>
                      <span>Freq</span>
                      <span>Block</span>
                      <span>Weekly</span>
                    </div>
                    {r.flights.map((f) => (
                      <div
                        key={f.id}
                        className="grid grid-cols-[1fr_0.9fr_0.9fr_0.7fr_0.7fr_1.4fr_0.7fr_0.7fr_0.9fr] items-center px-3 py-2 text-[13px] text-hz-text text-center"
                        style={{ borderTop: `1px solid ${rowBorder}` }}
                      >
                        <span className="font-semibold truncate">{f.flightNumber}</span>
                        <span className="tabular-nums">{f.stdUtc}</span>
                        <span className="tabular-nums">{f.staUtc}</span>
                        <div className="flex justify-center">
                          <TypePill label={f.icaoType} color={acTypeColors.get(f.icaoType)} />
                        </div>
                        <span className="font-medium">{f.serviceType}</span>
                        <div className="flex justify-center">
                          <DowPills dow={f.daysOfOperation} />
                        </div>
                        <span className="font-medium tabular-nums">{freqFromDow(f.daysOfOperation)}</span>
                        <span className="font-medium tabular-nums">{fmtHM(f.blockMinutes)}</span>
                        <span className="font-medium tabular-nums">
                          {fmtHM(freqFromDow(f.daysOfOperation) * f.blockMinutes)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="w-full px-3 py-2.5 text-[13px] font-semibold hover:bg-hz-border/20 transition-colors"
            style={{ borderTop: `1px solid ${rowBorder}`, color: 'var(--module-accent, #1e40af)' }}
          >
            Show all {routes.length} routes ({hiddenCount} more)
          </button>
        )}
      </div>
    </section>
  )
}

/* ── Sub-components ──────────────────────────────────────── */

function combineDow(flights: FrequencyFlightRow[]): string {
  const set = new Set<string>()
  for (const f of flights) for (const c of f.daysOfOperation) if (c >= '1' && c <= '7') set.add(c)
  return [...set].sort().join('')
}

function DowPills({ dow }: { dow: string }) {
  const set = useMemo(() => new Set(dow.split('')), [dow])
  const days = ['1', '2', '3', '4', '5', '6', '7']
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  return (
    <div className="flex items-center gap-[3px]">
      {days.map((d, i) => {
        const active = set.has(d)
        return (
          <span
            key={d}
            className="w-5 h-5 rounded-sm flex items-center justify-center text-[13px] font-semibold"
            style={{
              background: active ? 'var(--module-accent, #1e40af)' : 'rgba(125,125,140,0.15)',
              color: active ? '#fff' : 'var(--hz-text-tertiary)',
              opacity: active ? 1 : 0.5,
            }}
          >
            {labels[i]}
          </span>
        )
      })}
    </div>
  )
}

function TypePill({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className="inline-flex items-center h-5 px-1.5 rounded-md text-[13px] font-semibold text-white"
      style={{ background: color ?? 'var(--module-accent, #1e40af)' }}
    >
      {label}
    </span>
  )
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="flex items-center gap-2.5">
      <span
        className="shrink-0"
        style={{ width: 3, height: 16, borderRadius: 2, background: 'var(--module-accent, #1e40af)' }}
      />
      <RouteIcon size={14} className="text-module-accent shrink-0" />
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold text-hz-text truncate">{title}</h2>
        {subtitle ? <p className="text-[13px] text-hz-text-tertiary mt-0.5 truncate">{subtitle}</p> : null}
      </div>
    </header>
  )
}
