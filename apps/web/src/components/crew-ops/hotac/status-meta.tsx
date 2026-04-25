'use client'

import { CircleDashed, Clock, Send, CircleCheck, BedDouble, CircleAlert, Plane, type LucideIcon } from 'lucide-react'
import type { BookingStatus } from './types'

// XD semantic palette (CLAUDE.md §2)
//   #06C270  success
//   #0063F7  info
//   #FF8800  warning
//   #FF3B3B  danger

interface StatusMeta {
  label: string
  icon: LucideIcon
  bg: string
  text: string
  border: string
}

const META: Record<BookingStatus, StatusMeta> = {
  demand: {
    label: 'Demand',
    icon: CircleDashed,
    bg: 'bg-hz-text-tertiary/10',
    text: 'text-hz-text-secondary',
    border: 'border-hz-border',
  },
  forecast: {
    label: 'Forecast',
    icon: CircleDashed,
    bg: 'bg-hz-text-tertiary/10',
    text: 'text-hz-text-secondary',
    border: 'border-hz-border',
  },
  pending: {
    label: 'Pending Send',
    icon: Clock,
    bg: 'bg-[#FF8800]/12',
    text: 'text-[#FF8800]',
    border: 'border-[#FF8800]/30',
  },
  sent: {
    label: 'Awaiting Hotel',
    icon: Send,
    bg: 'bg-[#0063F7]/12',
    text: 'text-[#0063F7]',
    border: 'border-[#0063F7]/30',
  },
  confirmed: {
    label: 'Confirmed',
    icon: CircleCheck,
    bg: 'bg-[#06C270]/12',
    text: 'text-[#06C270]',
    border: 'border-[#06C270]/30',
  },
  'in-house': {
    label: 'In House',
    icon: BedDouble,
    bg: 'bg-module-accent/12',
    text: 'text-module-accent',
    border: 'border-module-accent/30',
  },
  departed: {
    label: 'Departed',
    icon: Plane,
    bg: 'bg-hz-text-tertiary/10',
    text: 'text-hz-text-secondary',
    border: 'border-hz-border',
  },
  cancelled: {
    label: 'Cancelled',
    icon: CircleAlert,
    bg: 'bg-[#FF3B3B]/12',
    text: 'text-[#FF3B3B]',
    border: 'border-[#FF3B3B]/30',
  },
  'no-show': {
    label: 'No-show',
    icon: CircleAlert,
    bg: 'bg-[#FF3B3B]/12',
    text: 'text-[#FF3B3B]',
    border: 'border-[#FF3B3B]/30',
  },
}

interface StatusChipProps {
  status: BookingStatus
  size?: 'sm' | 'md'
}

export function StatusChip({ status, size = 'md' }: StatusChipProps) {
  const m = META[status] ?? META.demand
  const Icon = m.icon
  const sz = size === 'sm' ? 'text-[13px] px-2 py-[3px] gap-1' : 'text-[13px] px-2.5 py-1 gap-1.5'

  return (
    <span
      className={`inline-flex items-center ${sz} rounded-md border ${m.bg} ${m.text} ${m.border} font-semibold whitespace-nowrap`}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={2.5} />
      {m.label}
    </span>
  )
}

export function fmtMoney(amt: number, ccy: string): string {
  if (!Number.isFinite(amt)) return '—'
  if (ccy === 'VND') return new Intl.NumberFormat('vi-VN').format(Math.round(amt)) + ' ₫'
  if (ccy === 'AUD') return 'A$' + Math.round(amt).toLocaleString()
  if (ccy === 'GBP') return '£' + Math.round(amt).toLocaleString()
  if (ccy === 'EUR') return '€' + Math.round(amt).toLocaleString()
  return '$' + Math.round(amt).toLocaleString()
}

/** Approximate cross-currency conversion to USD. Used for headline cost
 *  totals only — real cost reconciliation happens against the booking's own
 *  currency. */
export function approxUsd(amt: number, ccy: string): number {
  if (ccy === 'VND') return amt / 25_400
  if (ccy === 'AUD') return amt * 0.66
  if (ccy === 'GBP') return amt * 1.27
  if (ccy === 'EUR') return amt * 1.08
  return amt
}
