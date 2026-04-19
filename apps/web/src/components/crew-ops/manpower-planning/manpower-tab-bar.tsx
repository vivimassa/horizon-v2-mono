'use client'

import { BarChart3, Plane, CalendarDays, TrendingDown, type LucideIcon } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { crewAccent } from '@/components/crew-ops/crew-profile/common/draft-helpers'

export type ManpowerTabKey = 'headcount' | 'fleet-plan' | 'events' | 'gap-analysis'

export interface ManpowerTabDef {
  key: ManpowerTabKey
  label: string
  icon: LucideIcon
  badge?: number
}

interface Props {
  active: ManpowerTabKey
  onChange: (key: ManpowerTabKey) => void
  badges: Partial<Record<ManpowerTabKey, number>>
}

/**
 * Big tab bar for Manpower Planning — noticeably larger than V1 per the
 * user's explicit request. 56 px tall, 15 px SemiBold label, generous
 * horizontal padding, 3 px accent bar on the active tab.
 */
export function ManpowerTabBar({ active, onChange, badges }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const accent = crewAccent(isDark)
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const tabs: ManpowerTabDef[] = [
    { key: 'headcount', label: 'Headcount', icon: BarChart3, badge: badges.headcount },
    { key: 'fleet-plan', label: 'Fleet Plan', icon: Plane, badge: badges['fleet-plan'] },
    { key: 'events', label: 'Events', icon: CalendarDays, badge: badges.events },
    { key: 'gap-analysis', label: 'Gap Analysis', icon: TrendingDown, badge: badges['gap-analysis'] },
  ]

  return (
    <nav
      className="flex border-b"
      style={{
        borderColor: border,
        background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
      }}
    >
      {tabs.map((t) => {
        const isActive = t.key === active
        const Icon = t.icon
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className="relative flex-1 min-w-[200px] h-14 px-5 flex items-center justify-center gap-2.5 text-[15px] font-semibold transition-colors"
            style={{
              color: isActive ? accent : palette.textSecondary,
            }}
          >
            <Icon size={18} style={{ color: isActive ? accent : palette.textSecondary }} />
            <span>{t.label}</span>
            {typeof t.badge === 'number' && t.badge > 0 && (
              <span
                className="text-[13px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: isActive ? `${accent}22` : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  color: isActive ? accent : palette.textSecondary,
                }}
              >
                {t.badge}
              </span>
            )}
            {isActive && (
              <span className="absolute left-0 right-0 bottom-0 h-[3px] rounded-t-sm" style={{ background: accent }} />
            )}
          </button>
        )
      })}
    </nav>
  )
}
