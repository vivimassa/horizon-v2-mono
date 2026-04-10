"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Download, Upload, ArrowDown, ArrowUp, AlertCircle, CheckCircle } from 'lucide-react'
import { colors, accentTint } from '@skyhub/ui/theme'
import { MODULE_THEMES } from '@skyhub/constants'
import { api } from '@skyhub/api'
import type { SlotCoordinatedAirport, SlotMessageRef } from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'

interface MessagesTabProps {
  airport: SlotCoordinatedAirport
  seasonCode: string
  onImport: () => void
  onDataChanged: () => void
  isDark: boolean
}

const PARSE_STATUS_COLORS: Record<string, { color: string; label: string }> = {
  parsed: { color: '#06C270', label: 'Parsed' },
  error: { color: '#FF3B3B', label: 'Error' },
  partial: { color: '#FF8800', label: 'Partial' },
  pending: { color: '#8F90A6', label: 'Pending' },
}

export function MessagesTab({ airport, seasonCode, onImport, onDataChanged, isDark }: MessagesTabProps) {
  const palette = isDark ? colors.dark : colors.light
  const [messages, setMessages] = useState<SlotMessageRef[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadMessages = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getSlotMessages(getOperatorId(), {
        airportIata: airport.iataCode,
        seasonCode,
      })
      setMessages(data)
    } finally {
      setLoading(false)
    }
  }, [airport.iataCode, seasonCode])

  useEffect(() => { loadMessages() }, [loadMessages])

  const selected = useMemo(() => messages.find(m => m._id === selectedId) ?? null, [messages, selectedId])
  const glassBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'

  return (
    <div className="flex-1 flex overflow-hidden min-h-0">
      {/* Message list (left) */}
      <div className="w-[320px] shrink-0 flex flex-col overflow-hidden"
        style={{ borderRight: `1px solid ${glassBorder}` }}>
        <div className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: `1px solid ${glassBorder}` }}>
          <span className="text-[13px] font-medium" style={{ color: palette.text }}>
            {messages.length} message{messages.length !== 1 ? 's' : ''}
          </span>
          <button type="button" onClick={onImport}
            className="h-7 px-2.5 rounded-lg text-[13px] font-medium flex items-center gap-1 transition-colors"
            style={{ background: accentTint(MODULE_THEMES.network.accent, isDark ? 0.12 : 0.08), color: MODULE_THEMES.network.accent }}>
            <Download size={12} /> Import
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {messages.map(m => {
            const isSelected = selectedId === m._id
            const isInbound = m.direction === 'inbound'
            const parseInfo = PARSE_STATUS_COLORS[m.parseStatus] || PARSE_STATUS_COLORS.pending
            const date = m.createdAt ? new Date(m.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''

            return (
              <button key={m._id} type="button" onClick={() => setSelectedId(m._id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                style={{
                  background: isSelected ? accentTint(MODULE_THEMES.network.accent, isDark ? 0.12 : 0.08) : 'transparent',
                  borderBottom: `1px solid ${glassBorder}`,
                }}>
                {/* Direction icon */}
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: isInbound ? 'rgba(6,194,112,0.12)' : 'rgba(0,99,247,0.12)' }}>
                  {isInbound
                    ? <ArrowDown size={12} style={{ color: '#06C270' }} />
                    : <ArrowUp size={12} style={{ color: '#0063F7' }} />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-mono font-semibold" style={{ color: palette.text }}>
                      {m.messageType}
                    </span>
                    <span className="text-[13px] px-1.5 py-0.5 rounded"
                      style={{ background: `${parseInfo.color}15`, color: parseInfo.color }}>
                      {parseInfo.label}
                    </span>
                  </div>
                  <div className="text-[13px] mt-0.5" style={{ color: palette.textSecondary }}>
                    {date} {m.source ? `\u00b7 ${m.source}` : ''} {m.parsedSeriesCount > 0 ? `\u00b7 ${m.parsedSeriesCount} series` : ''}
                  </div>
                </div>
              </button>
            )
          })}

          {messages.length === 0 && !loading && (
            <div className="text-center py-12 text-[13px]" style={{ color: palette.textTertiary }}>
              No messages yet
            </div>
          )}
        </div>
      </div>

      {/* Message detail (right) */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {selected ? (
          <>
            <div className="px-5 py-3 shrink-0" style={{ borderBottom: `1px solid ${glassBorder}` }}>
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-mono font-bold" style={{ color: palette.text }}>
                  {selected.messageType}
                </span>
                <span className="text-[13px]" style={{ color: palette.textSecondary }}>
                  {selected.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                </span>
                {selected.reference && (
                  <span className="text-[13px] font-mono px-2 py-0.5 rounded-md"
                    style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: palette.textSecondary }}>
                    Ref: {selected.reference}
                  </span>
                )}
              </div>
              <div className="text-[13px] mt-1" style={{ color: palette.textSecondary }}>
                {selected.parsedSeriesCount} series parsed
                {selected.parseErrors?.length ? ` \u00b7 ${selected.parseErrors.length} error(s)` : ''}
              </div>
            </div>

            <div className="flex-1 overflow-auto p-5">
              <pre className="text-[13px] font-mono whitespace-pre-wrap rounded-xl p-4"
                style={{
                  background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
                  color: palette.text,
                  border: `1px solid ${glassBorder}`,
                }}>
                {selected.rawText}
              </pre>

              {selected.parseErrors && selected.parseErrors.length > 0 && (
                <div className="mt-4 space-y-1">
                  {selected.parseErrors.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-[13px]">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: '#FF3B3B' }} />
                      <span style={{ color: palette.textSecondary }}>
                        Line {e.line}: {e.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-[13px]" style={{ color: palette.textTertiary }}>
              Select a message to view details
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
