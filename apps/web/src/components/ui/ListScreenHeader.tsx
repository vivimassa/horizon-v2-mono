'use client'

import type { ComponentType, ReactNode } from 'react'
import { ChevronLeft, Plus } from 'lucide-react'
import { Text } from './Text'

type IconComponent = ComponentType<any>

interface ListScreenHeaderProps {
  icon: IconComponent
  title: string
  count: number
  filteredCount?: number
  countLabel?: string
  onBack?: () => void
  onAdd?: () => void
  addLabel?: string
  rightAction?: ReactNode
}

export function ListScreenHeader({
  icon: Icon,
  title,
  count,
  filteredCount,
  countLabel = 'item',
  onBack,
  onAdd,
  addLabel = 'New',
  rightAction,
}: ListScreenHeaderProps) {
  const plural = count === 1 ? countLabel : `${countLabel}s`
  const subtitle =
    filteredCount !== undefined && filteredCount !== count
      ? `${filteredCount} of ${count} ${plural}`
      : `${count} ${plural}`

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      ) : null}

      <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-module-accent/10">
        <Icon className="h-[18px] w-[18px] text-module-accent" />
      </div>

      <div className="min-w-0 flex-1">
        <Text variant="pageTitle" as="div" className="truncate">
          {title}
        </Text>
        <Text variant="secondary" muted as="div" className="truncate">
          {subtitle}
        </Text>
      </div>

      {rightAction}

      {onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-module-accent text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          <Text variant="cardTitle" as="span" className="!text-white !font-semibold">
            {addLabel}
          </Text>
        </button>
      ) : null}
    </div>
  )
}
