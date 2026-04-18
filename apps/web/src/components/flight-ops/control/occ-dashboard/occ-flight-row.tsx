'use client'

import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'

export type RowTagTone = 'crew' | 'swap' | 'fuel' | 'wx' | 'gate' | 'delay' | 'info'

const TONE: Record<RowTagTone, string> = {
  crew: 'bg-[rgba(255,136,0,0.14)] text-[#FF8800]',
  swap: 'bg-[rgba(0,99,247,0.15)] text-[#5AA1FF]',
  fuel: 'bg-[rgba(172,93,217,0.18)] text-[#AC5DD9]',
  wx: 'bg-[rgba(0,207,222,0.14)] text-[#00CFDE]',
  gate: 'bg-[rgba(255,59,59,0.12)] text-[#FF3B3B]',
  delay: 'bg-[rgba(255,136,0,0.14)] text-[#FF8800]',
  info: 'bg-[rgba(0,99,247,0.12)] text-[#5AA1FF]',
}

export function OccTag({ tone, children }: { tone: RowTagTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-[7px] py-[2px] rounded-full text-[11px] font-semibold ${TONE[tone]}`}
    >
      {children}
    </span>
  )
}

interface OccFlightRowProps {
  flightNumber: string
  depStation: string
  arrStation: string
  meta?: ReactNode
  rightLabel?: ReactNode
  rightTone?: 'ok' | 'warn' | 'err' | 'muted'
  onClick?: () => void
  tags?: ReactNode
}

const RIGHT_COLOR: Record<'ok' | 'warn' | 'err' | 'muted', string> = {
  ok: 'text-[#06C270]',
  warn: 'text-[#FF8800]',
  err: 'text-[#FF3B3B]',
  muted: 'text-[var(--occ-text-2)]',
}

export function OccFlightRow({
  flightNumber,
  depStation,
  arrStation,
  meta,
  rightLabel,
  rightTone = 'muted',
  onClick,
  tags,
}: OccFlightRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid grid-cols-[62px_1fr_auto] items-center gap-2 px-1 h-[34px] rounded-md hover:bg-[rgba(17,17,24,0.04)] dark:hover:bg-white/[0.04] text-[12.5px] text-left w-full"
    >
      <span className="font-mono font-semibold text-[var(--occ-text)]">{flightNumber}</span>
      <span className="flex items-center gap-2 min-w-0">
        <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-[var(--occ-text-2)]">
          {depStation}
          <ArrowRight size={10} className="opacity-55" />
          {arrStation}
        </span>
        {meta ? <span className="text-[var(--occ-text-3)] text-[11.5px] truncate">{meta}</span> : null}
        {tags}
      </span>
      <span className={`font-mono text-[12px] tabular-nums ${RIGHT_COLOR[rightTone]}`}>{rightLabel}</span>
    </button>
  )
}
