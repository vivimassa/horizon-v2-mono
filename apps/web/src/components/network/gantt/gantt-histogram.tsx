'use client'

import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'

export function GanttHistogram() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  return (
    <div
      className="h-10 shrink-0"
      style={{ borderTop: `1px solid ${palette.border}`, background: palette.backgroundSecondary }}
    />
  )
}
