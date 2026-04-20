'use client'

import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import type { PairingLegalityStatus } from '../types'

interface PairingStatusBadgeProps {
  status: PairingLegalityStatus
  size?: 'sm' | 'md' | 'lg'
  /** Pill (default) or compact dot-only */
  variant?: 'pill' | 'dot'
}

const STATUS_CONFIG: Record<PairingLegalityStatus, { label: string; color: string; bg: string }> = {
  legal: { label: 'Legal', color: '#06C270', bg: 'rgba(6, 194, 112, 0.14)' },
  warning: { label: 'Warning', color: '#FF8800', bg: 'rgba(255, 136, 0, 0.14)' },
  violation: { label: 'Violation', color: '#FF3B3B', bg: 'rgba(255, 59, 59, 0.14)' },
}

/**
 * Tri-state legality badge for pairing rows / inspector headers.
 * Follows Stitch aesthetic — semi-transparent tinted pill with matching icon.
 */
export function PairingStatusBadge({ status, size = 'md', variant = 'pill' }: PairingStatusBadgeProps) {
  const { label, color, bg } = STATUS_CONFIG[status]
  const Icon = status === 'legal' ? CheckCircle2 : status === 'warning' ? AlertTriangle : XCircle

  if (variant === 'dot') {
    return (
      <span
        className="inline-block rounded-full shrink-0"
        style={{
          width: size === 'sm' ? 6 : size === 'lg' ? 10 : 8,
          height: size === 'sm' ? 6 : size === 'lg' ? 10 : 8,
          background: color,
          boxShadow: `0 0 6px ${color}88`,
        }}
        aria-label={label}
      />
    )
  }

  const iconSize = size === 'sm' ? 11 : size === 'lg' ? 14 : 12
  const heightCls = size === 'sm' ? 'h-5' : size === 'lg' ? 'h-7' : 'h-6'
  // 13px floor per SkyHub min-text rule — 'sm' stays at 12px only for in-row pills
  // where the row itself already clamps line-height.
  const fontCls = size === 'sm' ? 'text-[12px]' : size === 'lg' ? 'text-[13px]' : 'text-[13px]'

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 rounded-full font-semibold ${heightCls} ${fontCls}`}
      style={{
        background: bg,
        color,
        border: `1px solid ${color}33`,
      }}
    >
      <Icon size={iconSize} strokeWidth={2.2} />
      {label}
    </span>
  )
}
