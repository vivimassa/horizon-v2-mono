'use client'

import { useMemo } from 'react'
import type { GanttFlight } from '@/lib/gantt/types'
import { OccCard } from '../occ-card'
import { CodeChip, OccEmpty, Sev, StatStrip, Td, Th } from '../lib/occ-helpers'

const D30_MS = 30 * 60 * 1000

interface ExceptionIropsCardProps {
  flights: GanttFlight[]
  delayStandardLabel: string
}

export function ExceptionIropsCard({ flights, delayStandardLabel }: ExceptionIropsCardProps) {
  const irops = useMemo(() => computeIrops(flights), [flights])

  return (
    <OccCard
      title="Irregular Operations"
      tone="err"
      edge
      moduleCode="2.1.3"
      footLeft={<span>{irops.total} open exceptions</span>}
      footRight={{ label: 'Disruption Center →', href: '/flight-ops/control/disruption-center' }}
    >
      <StatStrip
        tight
        cells={[
          { label: 'Delay>30', value: irops.stats.delayOver30, tone: 'err' },
          { label: 'Cancel', value: irops.stats.cancelled, tone: 'err' },
          { label: 'Divert', value: irops.stats.divert, tone: 'warn' },
          { label: 'RTG/AIR', value: irops.stats.rtg, tone: 'warn' },
        ]}
      />
      {irops.rows.length === 0 ? (
        <OccEmpty message="All clear · no exceptions in window" />
      ) : (
        <table className="w-full border-collapse text-[12px] mt-2">
          <thead>
            <tr>
              <Th>Flight</Th>
              <Th>Route</Th>
              <Th>Kind</Th>
              <Th>Code</Th>
              <Th align="right">Min</Th>
            </tr>
          </thead>
          <tbody>
            {irops.rows.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-[rgba(17,17,24,0.03)] dark:hover:bg-white/[0.04]">
                <Td>
                  <span className="font-mono font-semibold">{r.flightNumber}</span>
                  <Sev tone={r.severity as 'high' | 'med' | 'low'}>{r.kind}</Sev>
                </Td>
                <Td mono>
                  {r.depStation}·{r.arrStation}
                </Td>
                <Td>{r.kind}</Td>
                <Td>{r.code ? <CodeChip>{r.code}</CodeChip> : <span className="text-[var(--occ-text-3)]">—</span>}</Td>
                <Td
                  align="right"
                  mono
                  className={
                    r.delayMin > 60
                      ? 'text-[#FF3B3B] font-semibold'
                      : r.delayMin > 30
                        ? 'text-[#FF8800] font-semibold'
                        : ''
                  }
                >
                  {r.kind === 'CNL' ? '—' : `+${r.delayMin}`}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-2 text-[11px] text-[var(--occ-text-3)]">Delay standard · {delayStandardLabel}</div>
    </OccCard>
  )
}

function computeIrops(flights: GanttFlight[]) {
  const rows = flights
    .map((f) => {
      const delay = Math.max(0, (f.etdUtc ?? f.atdUtc ?? f.stdUtc) - f.stdUtc)
      const disruption = f.disruptionKind && f.disruptionKind !== 'none' ? f.disruptionKind : null
      const cancelled = f.status === 'cancelled'
      const delayMin = Math.round(delay / 60_000)
      const topDelay = f.delays?.[0]
      const isException = cancelled || disruption || delay > D30_MS
      return {
        id: f.id,
        flightNumber: f.flightNumber,
        depStation: f.depStation,
        arrStation: f.arrStation,
        delayMin,
        kind: cancelled
          ? 'CNL'
          : disruption === 'divert'
            ? 'DIV'
            : disruption === 'airReturn'
              ? 'AIR'
              : disruption === 'rampReturn'
                ? 'RTG'
                : 'DEL',
        severity: cancelled || delayMin > 60 ? 'high' : delayMin > 30 ? 'med' : 'low',
        code: topDelay?.code ?? null,
        category: topDelay?.category ?? null,
        isException,
      }
    })
    .filter((r) => r.isException)
    .sort((a, b) => b.delayMin - a.delayMin)

  const stats = {
    delayOver30: rows.filter((r) => r.kind === 'DEL' && r.delayMin > 30).length,
    cancelled: rows.filter((r) => r.kind === 'CNL').length,
    divert: rows.filter((r) => r.kind === 'DIV').length,
    rtg: rows.filter((r) => r.kind === 'RTG' || r.kind === 'AIR').length,
  }
  return { rows: rows.slice(0, 6), stats, total: rows.length }
}
