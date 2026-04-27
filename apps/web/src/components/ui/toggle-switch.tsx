'use client'

import type { CSSProperties } from 'react'

export type ToggleSwitchSize = 'sm' | 'md' | 'lg'

interface ToggleSwitchProps {
  checked: boolean
  onChange: (v: boolean) => void
  size?: ToggleSwitchSize
  /** Override the default iOS-green track when on. Use for module-accent toggles. */
  accent?: string
  /** Use orange `#FF8800` track when on for destructive-action toggles. */
  danger?: boolean
  disabled?: boolean
  ariaLabel?: string
  className?: string
}

const SIZES: Record<ToggleSwitchSize, { w: number; h: number; thumb: number; pad: number }> = {
  sm: { w: 36, h: 20, thumb: 16, pad: 2 },
  md: { w: 40, h: 24, thumb: 20, pad: 2 },
  lg: { w: 50, h: 30, thumb: 26, pad: 2 },
}

const IOS_GREEN = '#34C759'
const DANGER_ORANGE = '#FF8800'
const OFF_TRACK = 'rgba(125,125,140,0.35)'

export function ToggleSwitch({
  checked,
  onChange,
  size = 'md',
  accent,
  danger,
  disabled,
  ariaLabel,
  className,
}: ToggleSwitchProps) {
  const { w, h, thumb, pad } = SIZES[size]
  const travel = w - thumb - pad * 2
  const onColor = danger ? DANGER_ORANGE : (accent ?? IOS_GREEN)

  const trackStyle: CSSProperties = {
    width: w,
    height: h,
    background: checked ? onColor : OFF_TRACK,
    opacity: disabled ? 0.5 : 1,
  }

  const thumbStyle: CSSProperties = {
    top: pad,
    left: pad,
    width: thumb,
    height: thumb,
    transform: checked ? `translateX(${travel}px)` : 'translateX(0)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!disabled) onChange(!checked)
      }}
      className={`relative shrink-0 rounded-full transition-colors duration-200 ${
        disabled ? 'cursor-not-allowed' : 'cursor-pointer'
      } ${className ?? ''}`}
      style={trackStyle}
    >
      <span className="absolute bg-white rounded-full transition-transform duration-200" style={thumbStyle} />
    </button>
  )
}
