'use client'

import { RefreshCw, Inbox, Send, FileText, BarChart3 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useScheduleMessagingStore } from '@/stores/use-schedule-messaging-store'
import { Tooltip } from '@/components/ui/tooltip'

interface MessagingToolbarProps {
  onRefresh: () => void
}

type Section = 'receive' | 'send' | 'log'

const SECTIONS: { key: Section; label: string; icon: typeof Inbox }[] = [
  { key: 'receive', label: 'Receive', icon: Inbox },
  { key: 'send', label: 'Send', icon: Send },
  { key: 'log', label: 'Message Log', icon: FileText },
]

export function MessagingToolbar({ onRefresh }: MessagingToolbarProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const activeSection = useScheduleMessagingStore((s) => s.activeSection)
  const setActiveSection = useScheduleMessagingStore((s) => s.setActiveSection)
  const stats = useScheduleMessagingStore((s) => s.stats)
  const statsLoading = useScheduleMessagingStore((s) => s.statsLoading)

  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const activeBg = isDark ? 'rgba(62,123,250,0.20)' : 'rgba(30,64,175,0.12)'
  const activeColor = isDark ? '#5B8DEF' : '#1e40af'
  const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  return (
    <div className="flex items-center gap-0 px-2" style={{ height: 48 }}>
      {/* Section tabs */}
      <div className="flex items-center gap-1">
        {SECTIONS.map((s) => {
          const active = activeSection === s.key
          const Icon = s.icon
          return (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className="h-9 px-3.5 rounded-lg flex items-center gap-2 text-[13px] font-semibold transition-colors"
              style={{
                background: active ? activeBg : undefined,
                color: active ? activeColor : undefined,
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = hoverBg
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = active ? activeBg : 'transparent'
              }}
            >
              <Icon size={15} strokeWidth={active ? 2 : 1.6} />
              {s.label}
            </button>
          )
        })}
      </div>

      {/* Divider */}
      <div className="mx-3 h-6 w-px" style={{ background: dividerColor }} />

      {/* Stats strip */}
      {stats && !statsLoading && (
        <div className="flex items-center gap-4">
          <StatPill label="Held" value={stats.held} color="#FF8800" />
          <StatPill label="Pending" value={stats.pending} color="#0063F7" />
          <StatPill label="Sent" value={stats.sent} color="#06C270" />
          <StatPill label="Applied" value={stats.applied} color="#06C270" />
          <StatPill label="Rejected" value={stats.rejected} color="#FF3B3B" />
          <StatPill label="This Week" value={stats.thisWeek} color={activeColor} />
        </div>
      )}

      <div className="flex-1" />

      {/* Refresh */}
      <Tooltip content="Refresh data">
        <button
          onClick={onRefresh}
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = hoverBg
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <RefreshCw size={15} strokeWidth={1.6} className="text-hz-text-secondary" />
        </button>
      </Tooltip>
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  if (value === 0) return null
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[13px] text-hz-text-tertiary font-medium">{label}</span>
      <span className="text-[13px] font-bold" style={{ color }}>
        {value}
      </span>
    </div>
  )
}
