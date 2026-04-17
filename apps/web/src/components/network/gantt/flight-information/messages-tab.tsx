'use client'

import { useState } from 'react'
import { Send, MessageSquare, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useTheme } from '@/components/theme-provider'
import { useOperatorStore } from '@/stores/use-operator-store'
import { useMovementMessagesByFlight } from '@skyhub/api/src/hooks'
import type { MovementMessageRef } from '@skyhub/api'
import type { FlightDetail } from '@/lib/gantt/flight-detail-types'
import { ComposeMvtPanel } from './compose-mvt-panel'

const TYPE_COLORS: Record<string, string> = {
  MVT: 'rgba(6,194,112,0.14)',
  LDM: 'rgba(0,99,247,0.14)',
}
const TYPE_FG: Record<string, string> = {
  MVT: '#06C270',
  LDM: '#0063F7',
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  held: { bg: 'rgba(255,136,0,0.14)', fg: '#FF8800' },
  pending: { bg: 'rgba(253,221,72,0.18)', fg: '#C99400' },
  sent: { bg: 'rgba(0,99,247,0.14)', fg: '#0063F7' },
  applied: { bg: 'rgba(6,194,112,0.14)', fg: '#06C270' },
  failed: { bg: 'rgba(255,59,59,0.14)', fg: '#FF3B3B' },
  rejected: { bg: 'rgba(255,59,59,0.14)', fg: '#FF3B3B' },
  discarded: { bg: 'rgba(96,97,112,0.14)', fg: '#606170' },
}

export function MessagesTab({ data }: { data: FlightDetail }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const operator = useOperatorStore((s) => s.operator)
  const [composeOpen, setComposeOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const messagesQuery = useMovementMessagesByFlight(operator?._id ?? '', data.id)
  const messages: MovementMessageRef[] = messagesQuery.data?.messages ?? []

  const muted = isDark ? '#8F90A6' : '#555770'
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const accent = operator?.accentColor ?? '#1e40af'

  return (
    <div>
      {composeOpen && (
        <ComposeMvtPanel
          data={data}
          onClose={() => setComposeOpen(false)}
          onSent={() => {
            messagesQuery.refetch()
          }}
        />
      )}

      <div className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-bold uppercase tracking-[0.15em]" style={{ color: `${accent}99` }}>
            Messages
            <span className="ml-2 font-normal text-[13px]" style={{ color: muted }}>
              {messages.length}
            </span>
          </h3>
          {!composeOpen && (
            <button
              onClick={() => setComposeOpen(true)}
              className="flex items-center gap-1.5 rounded-xl text-[13px] font-semibold h-8 px-3.5 transition-colors"
              style={{ background: accent, color: '#fff' }}
            >
              <Send size={14} /> Compose MVT
            </button>
          )}
        </div>

        {/* Messages list */}
        {messagesQuery.isLoading ? (
          <div className="text-center py-8 text-[13px]" style={{ color: muted }}>
            Loading…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 opacity-50">
            <MessageSquare size={28} style={{ color: muted }} className="mb-3" />
            <span className="text-[13px] font-medium" style={{ color: muted }}>
              No messages for this flight
            </span>
            <span className="text-[13px] mt-1" style={{ color: `${muted}80` }}>
              Compose an MVT above to start the history
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => {
              const isExpanded = expandedId === msg._id
              const statusC = STATUS_COLORS[msg.status] ?? { bg: cardBg, fg: muted }
              return (
                <div
                  key={msg._id}
                  className="rounded-xl overflow-hidden"
                  style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : msg._id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-hz-surface-hover transition-colors"
                  >
                    <div className="w-4 shrink-0">
                      {msg.rawMessage ? (
                        isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" style={{ color: muted }} />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" style={{ color: muted }} />
                        )
                      ) : null}
                    </div>

                    <span
                      className="inline-flex px-2 py-0.5 rounded-md text-[13px] font-mono font-bold shrink-0"
                      style={{
                        background: TYPE_COLORS[msg.messageType] ?? cardBg,
                        color: TYPE_FG[msg.messageType] ?? muted,
                      }}
                    >
                      {msg.messageType}
                    </span>

                    <span
                      className="inline-flex px-1.5 py-0.5 rounded-md text-[13px] font-bold uppercase shrink-0"
                      style={{
                        background: msg.direction === 'outbound' ? `${accent}1A` : 'rgba(0,99,247,0.14)',
                        color: msg.direction === 'outbound' ? accent : '#0063F7',
                      }}
                    >
                      {msg.direction === 'outbound' ? 'OUT' : 'IN'}
                    </span>

                    <span
                      className="inline-flex px-1.5 py-0.5 rounded-md text-[13px] font-mono shrink-0"
                      style={{ background: cardBg, color: muted, border: `1px solid ${cardBorder}` }}
                    >
                      {msg.actionCode}
                    </span>

                    <span className="flex-1 text-[13px] truncate" style={{ color: muted }}>
                      {msg.summary ?? '—'}
                    </span>

                    <span
                      className="inline-flex px-1.5 py-0.5 rounded-md text-[13px] font-semibold capitalize shrink-0"
                      style={{ background: statusC.bg, color: statusC.fg }}
                    >
                      {msg.status}
                    </span>

                    <span className="text-[13px] font-mono shrink-0" style={{ color: muted }}>
                      {new Date(msg.createdAtUtc).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </button>

                  {isExpanded && msg.rawMessage && (
                    <div className="px-5 pb-3">
                      <pre
                        className="text-[13px] font-mono whitespace-pre-wrap rounded-lg p-3 overflow-x-auto"
                        style={{
                          background: isDark ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.03)',
                          border: `1px solid ${cardBorder}`,
                          color: muted,
                        }}
                      >
                        {msg.rawMessage}
                      </pre>
                      <div className="mt-2 flex justify-end">
                        <Link
                          href={`/flight-ops/control/communication-deck`}
                          className="inline-flex items-center gap-1 text-[13px] hover:underline"
                          style={{ color: accent }}
                        >
                          View in Communication Deck
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
