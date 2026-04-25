'use client'

import { CalendarDays, Sparkles, Mail, type LucideIcon } from 'lucide-react'
import { useHotacStore } from '@/stores/use-hotac-store'
import type { HotacTab } from '../types'

interface TabSpec {
  key: HotacTab
  label: string
  hint: string
  icon: LucideIcon
}

const TABS: TabSpec[] = [
  { key: 'planning', label: 'Planning', hint: 'Hotel demand projection', icon: Sparkles },
  { key: 'dayToDay', label: 'Day to Day', hint: '1–7 day operations', icon: CalendarDays },
  { key: 'communication', label: 'Communication', hint: 'Hotel email queue', icon: Mail },
]

export function HotacTabBar() {
  const activeTab = useHotacStore((s) => s.activeTab)
  const setActiveTab = useHotacStore((s) => s.setActiveTab)
  const disruptionsBadge = useHotacStore((s) => s.disruptionsSinceLastView)

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-hz-border">
      {TABS.map((tab) => {
        const Icon = tab.icon
        const active = activeTab === tab.key
        const showBadge = tab.key === 'dayToDay' && disruptionsBadge > 0
        return (
          <button
            type="button"
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-[13px] font-semibold ${
              active ? 'bg-module-accent/12 text-module-accent' : 'text-hz-text-secondary hover:bg-hz-border/30'
            }`}
            title={tab.hint}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
            {tab.label}
            {showBadge && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF3B3B] text-white text-[11px] font-bold">
                {disruptionsBadge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
