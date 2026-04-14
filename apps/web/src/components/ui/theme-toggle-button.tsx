'use client'

import { useEffect, useState } from 'react'
import { useTheme } from '@/components/theme-provider'
import { AnimatedThemeIcon } from './animated-theme-icon'

interface ThemeToggleButtonProps {
  size?: number
  iconSize?: number
  className?: string
}

/**
 * Circular icon button that toggles light/dark and animates the sun/moon morph.
 * Ports the V1 "mySettings" Appearance toggle aesthetic.
 */
export function ThemeToggleButton({ size = 36, iconSize = 18, className = '' }: ThemeToggleButtonProps) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div style={{ width: size, height: size }} className="rounded-full" />
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`inline-flex items-center justify-center rounded-full transition-colors duration-200 cursor-pointer focus:outline-none ${className}`}
      style={{
        width: size,
        height: size,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)'}`,
        color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)',
        background: 'transparent',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <AnimatedThemeIcon isDark={isDark} size={iconSize} />
    </button>
  )
}
