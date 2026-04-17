'use client'

import { HelpCircle } from 'lucide-react'
import { Tooltip } from '@/components/ui/tooltip'
import { useHelp } from './help-provider'

interface HelpButtonProps {
  code?: string
  title?: string
  subtitle?: string
  tooltip?: string
  size?: 'sm' | 'md'
  noTooltip?: boolean
  className?: string
}

export function HelpButton({
  code,
  title,
  subtitle,
  tooltip = 'Help (F1)',
  size = 'md',
  noTooltip,
  className,
}: HelpButtonProps) {
  const { openHelp } = useHelp()
  const dim = size === 'sm' ? 28 : 32
  const iconSize = size === 'sm' ? 14 : 16

  const btn = (
    <button
      type="button"
      aria-label={tooltip}
      onClick={() => openHelp({ code, title, subtitle })}
      style={{ width: dim, height: dim }}
      className={[
        'shrink-0 rounded-lg',
        'flex items-center justify-center',
        'text-hz-text-secondary hover:text-module-accent',
        'hover:bg-black/5 dark:hover:bg-white/5',
        'transition-colors cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-module-accent focus:ring-offset-0',
        className ?? '',
      ].join(' ')}
    >
      <HelpCircle size={iconSize} strokeWidth={2} />
    </button>
  )

  if (noTooltip) return btn
  return <Tooltip content={tooltip}>{btn}</Tooltip>
}
