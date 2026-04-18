'use client'

import { Wrench } from 'lucide-react'
import { OccCard } from '../occ-card'
import type { MaintenanceRollup } from '../lib/aog-from-maintenance'
import { CodeChip, OccEmpty, Sev, StatStrip, Td, Th, formatRelative } from '../lib/occ-helpers'

interface ExceptionMaintenanceCardProps {
  maintenance: MaintenanceRollup
}

export function ExceptionMaintenanceCard({ maintenance }: ExceptionMaintenanceCardProps) {
  return (
    <OccCard
      title="Maintenance Alerts"
      tone="warn"
      edge
      moduleCode="3.4.1"
      icon={<Wrench size={14} />}
      footLeft={<span>AMOS-tracked events</span>}
      footRight={{ label: 'Maintenance →', href: '/flight-ops/maintenance' }}
    >
      <StatStrip
        tight
        cells={[
          { label: 'AOG', value: maintenance.aogCount, tone: 'err' },
          { label: 'In progress', value: maintenance.inProgressCount, tone: 'warn' },
          { label: 'Due 48h', value: maintenance.checkDue48hCount, tone: 'warn' },
          { label: 'Deferred', value: maintenance.deferredCount, tone: 'info' },
        ]}
      />
      {maintenance.rows.length === 0 ? (
        <OccEmpty message="All clear · no open maintenance" />
      ) : (
        <table className="w-full border-collapse text-[12px] mt-2">
          <thead>
            <tr>
              <Th>Reg</Th>
              <Th>Type</Th>
              <Th>Check</Th>
              <Th>Start</Th>
              <Th>Stn</Th>
            </tr>
          </thead>
          <tbody>
            {maintenance.rows.slice(0, 6).map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-[rgba(17,17,24,0.03)] dark:hover:bg-white/[0.04]">
                <Td>
                  <span className="font-mono font-semibold">{r.registration}</span>
                  <Sev tone={r.urgency === 'aog' ? 'high' : r.urgency === 'deferred' ? 'low' : 'med'}>
                    {r.urgency === 'aog'
                      ? 'AOG'
                      : r.urgency === 'deferred'
                        ? 'DEF'
                        : r.urgency === 'in_progress'
                          ? 'WIP'
                          : 'DUE'}
                  </Sev>
                </Td>
                <Td mono>{r.icaoType}</Td>
                <Td>{r.checkCode}</Td>
                <Td>
                  <CodeChip>{r.urgency === 'aog' ? 'NOW' : formatRelative(r.plannedStart)}</CodeChip>
                </Td>
                <Td mono>{r.station}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </OccCard>
  )
}
