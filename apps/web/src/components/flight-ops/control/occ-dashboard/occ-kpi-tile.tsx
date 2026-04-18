'use client'

import type { ReactNode } from 'react'
import { OccSparkline } from './occ-sparkline'

type DeltaTone = 'up' | 'down' | 'flat'

interface OccKpiTileProps {
  icon?: ReactNode
  label: string
  moduleCode?: string
  value: string
  unit?: string
  unitTone?: 'default' | 'warn'
  sub?: ReactNode
  sparkline?: number[]
  sparkColor?: string
  delta?: { tone: DeltaTone; text: string }
  children?: ReactNode
}

const DELTA_CLASSES: Record<DeltaTone, string> = {
  up: 'bg-[rgba(6,194,112,0.14)] text-[#06C270]',
  down: 'bg-[rgba(255,59,59,0.14)] text-[#FF3B3B]',
  flat: 'bg-white/10 dark:bg-white/5 text-[var(--occ-text-2)]',
}

export function OccKpiTile({
  icon,
  label,
  moduleCode,
  value,
  unit,
  unitTone = 'default',
  sub,
  sparkline,
  sparkColor,
  delta,
  children,
}: OccKpiTileProps) {
  return (
    <div className="relative flex flex-col gap-2.5 px-5 py-4 border-r last:border-r-0 border-[rgba(17,17,24,0.08)] dark:border-white/10 min-h-[124px]">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.12em] text-[var(--occ-text-2)]">
        {icon}
        <span>{label}</span>
        {moduleCode && (
          <span className="ml-auto font-mono text-[10px] text-[var(--occ-text-3)] px-1 py-px border border-[rgba(17,17,24,0.08)] dark:border-white/10 rounded">
            {moduleCode}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2 leading-none tabular-nums tracking-[-0.02em]">
        <span className="text-[34px] font-bold text-[var(--occ-text)]">{value}</span>
        {unit && (
          <span
            className={`text-[15px] font-semibold ${
              unitTone === 'warn' ? 'text-[#FF8800]' : 'text-[var(--occ-text-2)]'
            }`}
          >
            {unit}
          </span>
        )}
      </div>
      {sparkline && sparkline.length > 1 && <OccSparkline data={sparkline} color={sparkColor} className="w-full h-8" />}
      {children}
      {(delta || sub) && (
        <div className="flex items-center gap-2.5 text-[12px] text-[var(--occ-text-2)] flex-wrap">
          {delta && (
            <span
              className={`inline-flex items-center gap-[3px] px-[7px] py-[2px] rounded-md text-[11.5px] font-semibold ${
                DELTA_CLASSES[delta.tone]
              }`}
            >
              {delta.text}
            </span>
          )}
          {sub && <span className="text-[var(--occ-text-3)]">{sub}</span>}
        </div>
      )}
    </div>
  )
}
