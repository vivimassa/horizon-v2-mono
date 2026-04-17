'use client'

import { useMemo, useState } from 'react'
import { Plus, Minus, Equal, Route } from 'lucide-react'
import type { RouteStat, SsimComparisonReport } from '@skyhub/logic'
import { useTheme } from '@/components/theme-provider'
import { SectionFrame } from './section-frame'

type Filter = 'all' | 'only-a' | 'only-b' | 'both'

/**
 * Back-to-back bar chart for OD-pair frequency. Each route is a single
 * row; A extends leftwards from a centre divider, B extends rightwards.
 * Visual scan is instant — no number grid to parse.
 */
export function ByRouteTable({ report }: { report: SsimComparisonReport }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const rows = useMemo(() => mergeRoutes(report.a.byRoute, report.b.byRoute), [report])
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = rows.filter((r) => {
    if (filter === 'all') return true
    if (filter === 'only-a') return r.a != null && r.b == null
    if (filter === 'only-b') return r.b != null && r.a == null
    return r.a != null && r.b != null
  })
  const top = filtered.slice(0, 25)
  const maxFreq = Math.max(1, ...top.map((r) => Math.max(r.a?.frequency ?? 0, r.b?.frequency ?? 0)))

  const panel = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const shadow = isDark ? '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)' : '0 1px 3px rgba(96,97,112,0.10)'

  const counts = {
    both: rows.filter((r) => r.a && r.b).length,
    onlyB: rows.filter((r) => r.b && !r.a).length,
    onlyA: rows.filter((r) => r.a && !r.b).length,
  }

  return (
    <SectionFrame
      title="By OD pair"
      subtitle={`${rows.length} route${rows.length === 1 ? '' : 's'} total — showing top 25`}
      actions={
        <div className="flex gap-1">
          <Chip active={filter === 'all'} onClick={() => setFilter('all')} count={rows.length}>
            All
          </Chip>
          <Chip active={filter === 'both'} onClick={() => setFilter('both')} count={counts.both} color="#8F90A6">
            <Equal size={12} /> Both
          </Chip>
          <Chip active={filter === 'only-b'} onClick={() => setFilter('only-b')} count={counts.onlyB} color="#06C270">
            <Plus size={12} /> New in B
          </Chip>
          <Chip active={filter === 'only-a'} onClick={() => setFilter('only-a')} count={counts.onlyA} color="#FF3B3B">
            <Minus size={12} /> Dropped
          </Chip>
        </div>
      }
    >
      <div
        className="rounded-xl p-3"
        style={{ background: panel, border: `1px solid ${border}`, boxShadow: shadow, backdropFilter: 'blur(16px)' }}
      >
        {/* Axis header */}
        <div className="grid grid-cols-[140px_minmax(0,1fr)_70px] gap-3 items-center pb-2 border-b border-hz-border/40 mb-2">
          <div className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary">Route</div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary">
            <span className="text-right">← File A</span>
            <span className="px-3">freq</span>
            <span className="text-left">File B →</span>
          </div>
          <div className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary text-right">Δ</div>
        </div>

        {top.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-hz-text-tertiary">No routes match the current filter.</div>
        ) : (
          <div className="space-y-1">
            {top.map((r) => (
              <RouteBar key={`${r.dep}-${r.arr}`} row={r} maxFreq={maxFreq} />
            ))}
          </div>
        )}
      </div>
    </SectionFrame>
  )
}

function RouteBar({ row, maxFreq }: { row: RouteRow; maxFreq: number }) {
  const freqA = row.a?.frequency ?? 0
  const freqB = row.b?.frequency ?? 0
  const delta = freqB - freqA
  const distance = row.b?.distanceKm ?? row.a?.distanceKm
  const aPct = (freqA / maxFreq) * 100
  const bPct = (freqB / maxFreq) * 100
  const deltaColor = delta > 0 ? '#06C270' : delta < 0 ? '#FF3B3B' : '#8F90A6'
  const deltaBg = `color-mix(in srgb, ${deltaColor} 14%, transparent)`

  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)_70px] gap-3 items-center py-1.5 group">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Route size={13} className="text-hz-text-tertiary shrink-0" />
          <span className="text-[13px] font-semibold text-hz-text tabular-nums">
            {row.dep} → {row.arr}
          </span>
        </div>
        {distance != null && (
          <div className="text-[13px] text-hz-text-tertiary tabular-nums ml-5">
            {Math.round(distance).toLocaleString()} km
          </div>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-0">
        {/* A side — extends leftward */}
        <div className="relative h-5 flex items-center justify-end" title={`A: ${freqA.toLocaleString()}`}>
          <div
            className="rounded-l-md flex items-center justify-end pr-1.5"
            style={{
              width: `${aPct}%`,
              height: 14,
              background: 'rgba(127,127,143,0.55)',
              minWidth: freqA > 0 ? 2 : 0,
            }}
          >
            {aPct > 22 && (
              <span className="text-[13px] font-semibold text-white tabular-nums drop-shadow-sm">
                {freqA.toLocaleString()}
              </span>
            )}
          </div>
          {aPct <= 22 && freqA > 0 && (
            <span className="ml-1 text-[13px] font-semibold text-hz-text-secondary tabular-nums">
              {freqA.toLocaleString()}
            </span>
          )}
        </div>

        {/* Centre divider */}
        <div className="w-px self-stretch" style={{ background: 'var(--color-hz-border, rgba(0,0,0,0.12))' }} />

        {/* B side — extends rightward */}
        <div className="relative h-5 flex items-center" title={`B: ${freqB.toLocaleString()}`}>
          <div
            className="rounded-r-md flex items-center pl-1.5"
            style={{
              width: `${bPct}%`,
              height: 14,
              background: 'var(--module-accent, #1e40af)',
              minWidth: freqB > 0 ? 2 : 0,
            }}
          >
            {bPct > 22 && (
              <span className="text-[13px] font-semibold text-white tabular-nums drop-shadow-sm">
                {freqB.toLocaleString()}
              </span>
            )}
          </div>
          {bPct <= 22 && freqB > 0 && (
            <span className="ml-1 text-[13px] font-semibold text-hz-text tabular-nums">{freqB.toLocaleString()}</span>
          )}
        </div>
      </div>

      <div className="text-right">
        <span
          className="inline-block rounded-full px-2 py-0.5 text-[13px] font-semibold tabular-nums"
          style={{ background: deltaBg, color: deltaColor }}
        >
          {delta > 0 ? '+' : ''}
          {delta.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  count,
  color,
  children,
}: {
  active: boolean
  onClick: () => void
  count: number
  color?: string
  children: React.ReactNode
}) {
  const effectiveColor = color ?? 'var(--module-accent, #1e40af)'
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-7 px-2.5 rounded-full text-[13px] font-medium flex items-center gap-1 transition-colors"
      style={{
        background: active ? `color-mix(in srgb, ${effectiveColor} 14%, transparent)` : 'transparent',
        color: active ? effectiveColor : 'var(--color-hz-text-secondary, #8F90A6)',
        border: '1px solid',
        borderColor: active
          ? `color-mix(in srgb, ${effectiveColor} 30%, transparent)`
          : 'var(--color-hz-border, rgba(0,0,0,0.08))',
      }}
    >
      {children}
      <span className="font-bold tabular-nums">{count.toLocaleString()}</span>
    </button>
  )
}

interface RouteRow {
  dep: string
  arr: string
  a: RouteStat | null
  b: RouteStat | null
}

function mergeRoutes(a: RouteStat[], b: RouteStat[]): RouteRow[] {
  const map = new Map<string, RouteRow>()
  const key = (r: RouteStat) => `${r.dep}-${r.arr}`
  for (const r of a) map.set(key(r), { dep: r.dep, arr: r.arr, a: r, b: null })
  for (const r of b) {
    const cur = map.get(key(r))
    if (cur) cur.b = r
    else map.set(key(r), { dep: r.dep, arr: r.arr, a: null, b: r })
  }
  return [...map.values()].sort((x, y) => {
    const xf = (x.a?.frequency ?? 0) + (x.b?.frequency ?? 0)
    const yf = (y.a?.frequency ?? 0) + (y.b?.frequency ?? 0)
    return yf - xf
  })
}
