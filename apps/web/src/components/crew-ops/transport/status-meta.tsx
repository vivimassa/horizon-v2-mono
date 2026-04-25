'use client'

import {
  CircleDashed,
  Clock,
  Send,
  CircleCheck,
  Truck,
  LogIn,
  CheckCircle2,
  CircleAlert,
  type LucideIcon,
} from 'lucide-react'
import type { TripStatus } from './types'

interface StatusMeta {
  label: string
  icon: LucideIcon
  bg: string
  text: string
  border: string
}

const META: Record<TripStatus, StatusMeta> = {
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
    label: 'Awaiting Vendor',
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
  dispatched: {
    label: 'Dispatched',
    icon: Truck,
    bg: 'bg-module-accent/12',
    text: 'text-module-accent',
    border: 'border-module-accent/30',
  },
  'crew-pickedup': {
    label: 'Picked up',
    icon: LogIn,
    bg: 'bg-module-accent/12',
    text: 'text-module-accent',
    border: 'border-module-accent/30',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    bg: 'bg-[#06C270]/12',
    text: 'text-[#06C270]',
    border: 'border-[#06C270]/30',
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
  status: TripStatus
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

export function fmtTime(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  const d = new Date(ms)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}Z`
}

export function fmtDate(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  return new Date(ms).toISOString().slice(0, 10)
}

const TRIP_TYPE_LABELS: Record<string, string> = {
  'home-airport': 'Home → Airport',
  'airport-home': 'Airport → Home',
  'hub-airport': 'Hub → Airport',
  'airport-hub': 'Airport → Hub',
  'hotel-airport': 'Hotel → Airport',
  'airport-hotel': 'Airport → Hotel',
  'inter-terminal': 'Inter-terminal',
}

export function tripTypeLabel(type: string): string {
  return TRIP_TYPE_LABELS[type] ?? type
}

export function tripDirectionGroup(type: string): 'outbound' | 'inbound' {
  if (type === 'airport-home' || type === 'airport-hub' || type === 'airport-hotel') return 'inbound'
  return 'outbound'
}
