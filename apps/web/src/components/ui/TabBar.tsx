'use client'

import type { ComponentType } from 'react'
import { Text } from './Text'

type IconComponent = ComponentType<any>

export interface TabBarItem {
  key: string
  label: string
  icon?: IconComponent
}

interface TabBarProps {
  tabs: TabBarItem[]
  activeTab: string
  onTabChange: (key: string) => void
  /** Stretch tabs evenly across the full width (no scroll) */
  stretch?: boolean
}

export function TabBar({ tabs, activeTab, onTabChange, stretch = false }: TabBarProps) {
  return (
    <div className={`flex gap-1 border-b border-hz-border ${stretch ? '' : 'overflow-x-auto'}`} role="tablist">
      {tabs.map((tab) => {
        const active = tab.key === activeTab
        const Icon = tab.icon
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onTabChange(tab.key)}
            className={`shrink-0 ${stretch ? 'flex-1' : ''} inline-flex items-center justify-center gap-1.5 px-4 py-2.5 border-b-2 -mb-px transition-colors ${
              active ? 'border-module-accent bg-module-accent/5' : 'border-transparent hover:bg-hz-border/30'
            }`}
          >
            {Icon ? <Icon className={`h-4 w-4 ${active ? 'text-module-accent' : 'text-hz-text-secondary'}`} /> : null}
            <Text
              variant="panelHeader"
              className={active ? '!text-module-accent !font-bold' : '!text-hz-text-secondary !font-medium'}
            >
              {tab.label}
            </Text>
          </button>
        )
      })}
    </div>
  )
}
