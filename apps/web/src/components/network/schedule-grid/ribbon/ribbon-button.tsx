'use client'

import type { LucideIcon } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { Tooltip } from '@/components/ui/tooltip'

interface RibbonButtonProps {
  icon: LucideIcon
  label: string
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  shortcut?: string
  small?: boolean
}

export function RibbonButton({ icon: Icon, label, onClick, disabled, active, shortcut, small }: RibbonButtonProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const hoverBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
  const activeBg = isDark ? 'rgba(62,123,250,0.20)' : 'rgba(30,64,175,0.12)'
  const tip = shortcut ? `${label} (${shortcut})` : label

  if (small) {
    return (
      <Tooltip content={tip}>
        <button
          onClick={onClick}
          disabled={disabled}
          className={`flex items-center justify-center rounded transition-all duration-150 ${
            disabled ? 'opacity-30 pointer-events-none' : ''
          }`}
          style={{
            width: 40,
            height: 40,
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
          <Icon size={20} strokeWidth={1.6} />
        </button>
      </Tooltip>
    )
  }

  return (
    <Tooltip content={tip}>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`flex flex-col items-center justify-center gap-1 rounded-lg transition-all duration-150 ${
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
    </Tooltip>
  )
}
