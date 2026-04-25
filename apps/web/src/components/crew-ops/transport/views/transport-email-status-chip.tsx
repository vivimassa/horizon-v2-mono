'use client'

import type { TransportEmailStatus } from '@skyhub/api'
import { Pause, Send, CheckCircle, XCircle, Inbox, CircleDashed, AlertCircle, type LucideIcon } from 'lucide-react'

interface Meta {
  label: string
  icon: LucideIcon
  bg: string
  text: string
  border: string
}

const META: Record<TransportEmailStatus, Meta> = {
  draft: {
    label: 'Draft',
    icon: CircleDashed,
    bg: 'bg-hz-text-tertiary/10',
    text: 'text-hz-text-secondary',
    border: 'border-hz-border',
  },
  held: { label: 'Held', icon: Pause, bg: 'bg-[#FF8800]/12', text: 'text-[#FF8800]', border: 'border-[#FF8800]/30' },
  pending: {
    label: 'Sending',
    icon: Send,
    bg: 'bg-[#0063F7]/12',
    text: 'text-[#0063F7]',
    border: 'border-[#0063F7]/30',
  },
  sent: {
    label: 'Sent',
    icon: CheckCircle,
    bg: 'bg-[#06C270]/12',
    text: 'text-[#06C270]',
    border: 'border-[#06C270]/30',
  },
  partial: {
    label: 'Partial',
    icon: AlertCircle,
    bg: 'bg-[#FF8800]/12',
    text: 'text-[#FF8800]',
    border: 'border-[#FF8800]/30',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    bg: 'bg-[#FF3B3B]/12',
    text: 'text-[#FF3B3B]',
    border: 'border-[#FF3B3B]/30',
  },
  discarded: {
    label: 'Discarded',
    icon: XCircle,
    bg: 'bg-hz-text-tertiary/10',
    text: 'text-hz-text-tertiary',
    border: 'border-hz-border',
  },
  received: {
    label: 'Received',
    icon: Inbox,
    bg: 'bg-module-accent/12',
    text: 'text-module-accent',
    border: 'border-module-accent/30',
  },
}

export function TransportEmailStatusChip({ status }: { status: TransportEmailStatus }) {
  const m = META[status] ?? META.draft
  const Icon = m.icon
  return (
    <span
      className={`inline-flex items-center gap-1 text-[13px] px-2 py-[3px] rounded-md border ${m.bg} ${m.text} ${m.border} font-semibold whitespace-nowrap`}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {m.label}
    </span>
  )
}
