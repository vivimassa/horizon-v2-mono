'use client'

import { useMemo } from 'react'
import { Search } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { SectionHeader } from './section-header'
import { useScheduleSummaryStore } from '@/stores/use-schedule-summary-store'
import type { RouteRow } from './schedule-summary-types'
import { formatBlockTime, formatLargeNumber } from './compute-schedule-summary'

interface Props {
  rows: RouteRow[]
  acTypeColors: Map<string, string>
}

export function RouteSummaryCard({ rows, acTypeColors }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const routeSearch = useScheduleSummaryStore((s) => s.routeSearch)
  const setRouteSearch = useScheduleSummaryStore((s) => s.setRouteSearch)
  const showAll = useScheduleSummaryStore((s) => s.showAllRoutes)
  const setShowAll = useScheduleSummaryStore((s) => s.setShowAllRoutes)

  const displayed = useMemo(() => {
    const q = routeSearch.trim().toUpperCase()
    const filtered = q
      ? rows.filter((r) => r.route.toUpperCase().includes(q) || r.depIata.includes(q) || r.arrIata.includes(q))
      : rows
    if (q) return filtered
    return showAll ? filtered : filtered.slice(0, 10)
  }, [rows, routeSearch, showAll])

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          freq: acc.freq + r.weeklyFreq,
          seats: acc.seats + r.weeklySeats,
          ask: acc.ask + r.weeklyAsk,
          hrs: Math.round((acc.hrs + r.weeklyBlockHrs) * 10) / 10,
        }),
        { freq: 0, seats: 0, ask: 0, hrs: 0 },
      ),
    [rows],
  )

  const cardBg = isDark ? 'rgba(25,25,33,0.80)' : 'rgba(255,255,255,0.95)'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const rowBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
  const stripe = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'
  const footerBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'

  return (
    <div className="mb-6">
      <SectionHeader
        title="Route Summary"
        description={`${rows.length} routes \u00B7 ${showAll || routeSearch ? 'All' : 'Top 10'} by weekly seats`}
        right={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-hz-text-secondary pointer-events-none"
              />
              <input
                type="text"
                value={routeSearch}
                onChange={(e) => setRouteSearch(e.target.value)}
                placeholder="Search route or station..."
                className="h-9 pl-8 pr-3 rounded-[8px] text-[13px] outline-none text-hz-text placeholder:text-hz-text-secondary"
                style={{
                  width: 220,
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="h-9 px-3 rounded-[8px] text-[13px] font-medium text-hz-text hover:bg-hz-border/30 transition-colors"
              style={{ border: `1px solid ${inputBorder}`, background: inputBg }}
            >
              {showAll ? 'Top 10' : 'Show All'}
            </button>
          </div>
        }
      />

      <div
        className="rounded-[12px] overflow-hidden"
        style={{
          background: cardBg,
          border: `1px solid ${border}`,
          boxShadow: isDark
            ? '0 1px 2px rgba(0,0,0,0.30), 0 1px 3px rgba(0,0,0,0.18)'
            : '0 1px 2px rgba(96,97,112,0.06), 0 1px 3px rgba(96,97,112,0.04)',
        }}
      >
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${rowBorder}` }}>
              <Th align="left">Route</Th>
              <Th align="right">Dist (km)</Th>
              <Th align="right">Block</Th>
              <Th align="right">Freq/wk</Th>
              <Th align="left">Types</Th>
              <Th align="right">Seats/wk</Th>
              <Th align="right">ASK/wk</Th>
              <Th align="right">Hrs/wk</Th>
              <Th align="right">Share</Th>
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-[13px] text-hz-text-secondary">
                  No routes match your search.
                </td>
              </tr>
            ) : (
              displayed.map((r, idx) => (
                <tr
                  key={r.route}
                  style={{
                    borderBottom: `1px solid ${rowBorder}`,
                    background: idx % 2 === 1 ? stripe : 'transparent',
                  }}
                >
                  <td className="px-3 py-2.5 text-[13px] font-semibold text-hz-text">{r.route}</td>
                  <Td secondary>{r.distanceKm > 0 ? r.distanceKm.toLocaleString() : '\u2014'}</Td>
                  <Td>{formatBlockTime(r.blockMinutes)}</Td>
                  <Td>{r.weeklyFreq.toLocaleString()}</Td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5 flex-wrap">
                      {r.types.map((t) => (
                        <span
                          key={t}
                          className="text-[13px] font-semibold tabular-nums"
                          style={{ color: acTypeColors.get(t) ?? 'var(--color-hz-text)' }}
                        >
                          {t}
                        </span>
                      ))}
                    </span>
                  </td>
                  <Td>{r.weeklySeats.toLocaleString()}</Td>
                  <Td>{formatLargeNumber(r.weeklyAsk)}</Td>
                  <Td>{r.weeklyBlockHrs.toFixed(1)}</Td>
                  <Td accent>{r.sharePct}%</Td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ background: footerBg }}>
                <td className="px-3 py-2.5 text-[13px] font-semibold text-hz-text">Total</td>
                <td />
                <td />
                <Td bold>{totals.freq.toLocaleString()}</Td>
                <td />
                <Td bold>{totals.seats.toLocaleString()}</Td>
                <Td bold>{formatLargeNumber(totals.ask)}</Td>
                <Td bold>{totals.hrs.toFixed(1)}</Td>
                <Td bold>100%</Td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

function Th({ children, align }: { children: React.ReactNode; align: 'left' | 'right' }) {
  return (
    <th
      className={`px-3 py-2.5 ${align === 'right' ? 'text-right' : 'text-left'}`}
      style={{
        fontSize: 12,
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.6px',
        color: 'var(--color-hz-text-secondary)',
      }}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  accent,
  bold,
  secondary,
}: {
  children: React.ReactNode
  accent?: boolean
  bold?: boolean
  secondary?: boolean
}) {
  return (
    <td
      className="px-3 py-2.5 text-right tabular-nums text-[13px]"
      style={{
        color: accent
          ? 'var(--module-accent, #1e40af)'
          : secondary
            ? 'var(--color-hz-text-secondary)'
            : 'var(--color-hz-text)',
        fontWeight: bold ? 600 : 400,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {children}
    </td>
  )
}
