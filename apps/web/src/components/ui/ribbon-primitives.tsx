'use client'

import { forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Tooltip } from '@/components/ui/tooltip'

/** Ribbon section with label — matching 1.1.1 pattern */
export function RibbonSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center self-stretch justify-between pt-5 pb-3 px-3">
      <div className="flex items-center justify-center gap-2 flex-1">{children}</div>
      <div className="w-full text-center border-t border-hz-border/20 pt-1 mt-1">
        <span className="text-[11px] text-hz-text-tertiary/50 font-medium leading-none whitespace-nowrap">{label}</span>
      </div>
    </div>
  )
}

/** Ribbon button with icon + label */
export const RibbonBtn = forwardRef<
  HTMLButtonElement,
  {
    icon: LucideIcon
    label: string
    onClick?: () => void
    disabled?: boolean
    active?: boolean
    tooltip?: string
    isDark: boolean
    hoverBg: string
    activeBg: string
  }
>(({ icon: Icon, label, onClick, disabled, active, tooltip, isDark, hoverBg, activeBg }, ref) => {
  const btn = (
    <button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-lg transition-all duration-150 ${
        disabled ? 'opacity-30 pointer-events-none' : ''
      }`}
      style={{
        width: 72,
        height: 72,
        background: active ? activeBg : undefined,
        color: active ? (isDark ? '#5B8DEF' : '#1e40af') : undefined,
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled) e.currentTarget.style.background = hoverBg
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = active ? activeBg : 'transparent'
      }}
    >
      <Icon size={26} strokeWidth={1.4} />
      <span className="text-[12px] font-medium leading-none">{label}</span>
    </button>
  )

  if (tooltip) {
    return <Tooltip content={tooltip}>{btn}</Tooltip>
  }
  return btn
})

RibbonBtn.displayName = 'RibbonBtn'

/** Vertical divider between ribbon sections */
export function RibbonDivider({ isDark }: { isDark: boolean }) {
  return (
    <div className="shrink-0 flex items-center" style={{ height: 72, alignSelf: 'center' }}>
      <div style={{ width: 1, height: '100%', background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }} />
    </div>
  )
}
