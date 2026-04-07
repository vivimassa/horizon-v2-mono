"use client"

import { useTheme } from '@/components/theme-provider'

export function GanttHistogram() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const bg = isDark ? '#0E0E14' : '#f5f5f7'
  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  return (
    <div
      className="h-10 shrink-0"
      style={{ borderTop: `1px solid ${borderColor}`, background: bg }}
    />
  )
}
