// SkyHub — Icon wrapper
// ALL icon usage goes through this wrapper. No screen file ever imports
// from lucide-react-native directly.
import React from 'react'
import { useTheme } from '../hooks/useTheme'
import type { LucideIcon } from '../theme/icons'

const sizeMap = { sm: 16, md: 20, lg: 24, xl: 32 } as const

interface IconProps {
  icon: LucideIcon
  size?: keyof typeof sizeMap
  color?: string
  accentActive?: boolean
  className?: string
}

export function Icon({
  icon: IconComponent,
  size = 'md',
  color,
  accentActive = false,
  className,
}: IconProps) {
  const { palette, accentColor } = useTheme()

  const resolvedColor = accentActive
    ? accentColor
    : color ?? palette.textSecondary

  return (
    <IconComponent
      size={sizeMap[size]}
      color={resolvedColor}
      strokeWidth={1.75}
      className={className}
    />
  )
}
