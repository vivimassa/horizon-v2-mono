'use client'

import { Send, MessageSquare } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import type { FlightDetail } from '@/lib/gantt/flight-detail-types'

export function MessagesTab({ data }: { data: FlightDetail }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const muted = isDark ? '#8F90A6' : '#555770'
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const accent = 'var(--module-accent, #1e40af)'

  return (
    <div className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
      {/* Compose bar */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-bold uppercase tracking-[0.15em]" style={{ color: `${accent}99` }}>
          Messages
        </h3>
        <button
          disabled
          className="flex items-center gap-1.5 rounded-xl text-[13px] font-medium h-8 px-3.5 opacity-40 cursor-default"
          style={{ background: cardBg, border: `1px solid ${cardBorder}`, color: muted }}
        >
          <Send size={14} /> Compose
        </button>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-12 opacity-50">
        <MessageSquare size={28} style={{ color: muted }} className="mb-3" />
        <span className="text-[13px] font-medium" style={{ color: muted }}>
          No messages
        </span>
        <span className="text-[11px] mt-1" style={{ color: `${muted}80` }}>
          MVT, LDM, and ACARS messages will appear here
        </span>
      </div>
    </div>
  )
}
