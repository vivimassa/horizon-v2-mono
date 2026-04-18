'use client'

import { useTheme } from '@/components/theme-provider'
import { SectionHeader } from './section-header'
import type { FleetRow } from './schedule-summary-types'

interface Props {
  rows: FleetRow[]
}

export function FleetDeploymentCard({ rows }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const cardBg = isDark ? 'rgba(25,25,33,0.80)' : 'rgba(255,255,255,0.95)'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const rowBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
  const stripe = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'
  const footerBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'

  const totals = rows.reduce(
    (acc, r) => ({
      aircraft: acc.aircraft + r.aircraft,
      wkFlights: acc.wkFlights + r.wkFlights,
      wkHours: acc.wkHours + r.wkHours,
      wkSeats: acc.wkSeats + r.wkSeats,
    }),
    { aircraft: 0, wkFlights: 0, wkHours: 0, wkSeats: 0 },
  )

  return (
    <div className="flex flex-col">
      <SectionHeader title="Fleet Deployment" description="Capacity by aircraft type" />
      <div
        className="rounded-[12px] overflow-hidden flex-1"
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
              <Th align="left">Type</Th>
              <Th align="right">Aircraft</Th>
              <Th align="right">Wk Flights</Th>
              <Th align="right">Wk Hours</Th>
              <Th align="right">Wk Seats</Th>
              <Th align="right">% Capacity</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.icaoType}
                style={{
                  borderBottom: `1px solid ${rowBorder}`,
                  background: idx % 2 === 1 ? stripe : 'transparent',
                }}
              >
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2 text-[13px] font-medium text-hz-text">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: row.color }} />
                    {row.icaoType}
                  </span>
                </td>
                <Td>{row.aircraft.toLocaleString()}</Td>
                <Td>{row.wkFlights.toLocaleString()}</Td>
                <Td>{row.wkHours.toLocaleString()}</Td>
                <Td>{row.wkSeats.toLocaleString()}</Td>
                <Td accent>{row.capPct.toFixed(1)}%</Td>
              </tr>
            ))}
          </tbody>
          {rows.length > 1 && (
            <tfoot>
              <tr style={{ background: footerBg }}>
                <td className="px-3 py-2 text-[13px] font-semibold text-hz-text">Total</td>
                <Td bold>{totals.aircraft.toLocaleString()}</Td>
                <Td bold>{totals.wkFlights.toLocaleString()}</Td>
                <Td bold>{totals.wkHours.toLocaleString()}</Td>
                <Td bold>{totals.wkSeats.toLocaleString()}</Td>
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

function Td({ children, accent, bold }: { children: React.ReactNode; accent?: boolean; bold?: boolean }) {
  return (
    <td
      className="px-3 py-2 text-right tabular-nums text-[13px]"
      style={{
        color: accent ? 'var(--module-accent, #1e40af)' : 'var(--color-hz-text)',
        fontWeight: bold ? 600 : 400,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {children}
    </td>
  )
}
