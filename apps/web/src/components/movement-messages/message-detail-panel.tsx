'use client'

import { useMemo, useState } from 'react'
import { Copy, Send, Trash2, Loader2, Check } from 'lucide-react'
import type { MovementMessageRef } from '@skyhub/api'
import {
  parseMessage,
  formatMvtTime,
  formatDelayDuration,
  getDelayCodeDescription,
  type ParsedMessage,
} from '@skyhub/logic/src/iata/index'
import { useTransmitMovementMessage, useDiscardMovementMessages } from '@skyhub/api/src/hooks'
import { useTheme } from '@/components/theme-provider'

interface Props {
  message: MovementMessageRef
  accentColor: string
  onChanged: () => void
}

export function MessageDetailPanel({ message, accentColor, onChanged }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const softBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const monoBg = isDark ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.03)'
  const [copied, setCopied] = useState(false)

  const transmit = useTransmitMovementMessage()
  const discard = useDiscardMovementMessages()

  const parsed = useMemo<ParsedMessage | null>(() => {
    if (!message.rawMessage) return null
    return parseMessage(message.rawMessage)
  }, [message.rawMessage])

  const canRelease = message.status === 'held' || message.status === 'pending' || message.status === 'failed'
  const canDiscard = message.status === 'held'

  const handleCopy = async () => {
    if (!message.rawMessage) return
    await navigator.clipboard.writeText(message.rawMessage)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  const handleRelease = async () => {
    await transmit.mutateAsync(message._id)
    onChanged()
  }

  const handleDiscard = async () => {
    await discard.mutateAsync([message._id])
    onChanged()
  }

  return (
    <aside
      className="w-[420px] shrink-0 flex flex-col border-l overflow-y-auto custom-scrollbar"
      style={{ borderColor: border }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: softBorder }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-[3px] h-5 rounded-full" style={{ background: accentColor }} />
          <span className="text-[15px] font-semibold text-hz-text">
            {message.messageType} · {message.actionCode}
          </span>
          <span className="ml-auto text-[13px] text-hz-text-tertiary font-mono uppercase">{message.status}</span>
        </div>
        <div className="text-[13px] text-hz-text-secondary">
          {message.flightNumber ?? '—'}
          {message.flightDate ? ` · ${message.flightDate}` : ''}
          {message.registration ? ` · ${message.registration}` : ''}
        </div>
        {message.errorReason && (
          <div
            className="mt-2 rounded-lg px-3 py-2 text-[13px]"
            style={{ background: 'rgba(255,59,59,0.10)', color: '#FF3B3B', border: '1px solid rgba(255,59,59,0.28)' }}
          >
            {message.errorReason}
          </div>
        )}
      </div>

      {/* Decoded */}
      {parsed && parsed.type === 'MVT' && (
        <section className="px-5 py-4 border-b" style={{ borderColor: softBorder }}>
          <SectionTitle accentColor={accentColor}>Decoded MVT</SectionTitle>
          <div className="mt-3 space-y-0">
            <Field label="Flight" value={`${parsed.flightId.airline}${parsed.flightId.flightNumber}`} mono />
            <Field label="Day" value={parsed.flightId.dayOfMonth} mono />
            <Field label="Reg" value={parsed.flightId.registration} mono />
            <Field label="Station" value={parsed.flightId.station} mono />
            <Field label="Action" value={parsed.actionCode} />
            {parsed.offBlocks && <Field label="Off blocks" value={formatMvtTime(parsed.offBlocks)} mono />}
            {parsed.airborne && <Field label="Airborne" value={formatMvtTime(parsed.airborne)} mono />}
            {parsed.touchdown && <Field label="Touchdown" value={formatMvtTime(parsed.touchdown)} mono />}
            {parsed.onBlocks && <Field label="On blocks" value={formatMvtTime(parsed.onBlocks)} mono />}
            {parsed.estimatedDeparture && <Field label="ETD" value={formatMvtTime(parsed.estimatedDeparture)} mono />}
            {parsed.nextInfoTime && <Field label="Next info" value={formatMvtTime(parsed.nextInfoTime)} mono />}
            {parsed.returnTime && <Field label="Return" value={formatMvtTime(parsed.returnTime)} mono />}
            {parsed.etas.map((eta, i) => (
              <Field
                key={i}
                label={i === 0 ? 'ETA' : ''}
                value={`${formatMvtTime(eta.time)} → ${eta.destination}`}
                mono
              />
            ))}
            {parsed.passengers && (
              <Field
                label="PAX"
                value={`${parsed.passengers.total}${parsed.passengers.noSeatHolders ? ` + ${parsed.passengers.noSeatHolders} inf` : ''}`}
                mono
              />
            )}
          </div>

          {parsed.delays.length > 0 && (
            <div className="mt-4">
              <div className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary mb-2">
                Delays ({message.delayStandard === 'ahm732' ? 'AHM 732 Triple-A' : 'AHM 730/731'})
              </div>
              <div className="space-y-1.5">
                {parsed.delays.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-baseline gap-3 px-3 py-2 rounded-lg"
                    style={{ background: monoBg }}
                  >
                    <span className="text-[13px] font-mono font-semibold text-hz-text">{d.code}</span>
                    {d.ahm732 && (
                      <span className="text-[13px] text-hz-text-tertiary">
                        {d.ahm732.process} · {d.ahm732.reason} · {d.ahm732.stakeholder}
                      </span>
                    )}
                    <span className="text-[13px] text-hz-text-secondary flex-1">
                      {getDelayCodeDescription(d.code) || '—'}
                    </span>
                    {d.duration && (
                      <span className="text-[13px] font-mono text-hz-text" style={{ color: accentColor }}>
                        {formatDelayDuration(d.duration)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {parsed.supplementaryInfo.length > 0 && (
            <div className="mt-4">
              <div className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary mb-2">SI</div>
              {parsed.supplementaryInfo.map((si, i) => (
                <div key={i} className="text-[13px] font-mono text-hz-text-secondary">
                  {si}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Raw telex */}
      <section className="px-5 py-4 border-b flex-1 min-h-0" style={{ borderColor: softBorder }}>
        <div className="flex items-center justify-between mb-2">
          <SectionTitle accentColor={accentColor}>Raw telex</SectionTitle>
          <button
            onClick={handleCopy}
            className="h-7 px-2 rounded-lg text-[13px] flex items-center gap-1.5 hover:bg-hz-surface-hover transition-colors text-hz-text-secondary"
          >
            {copied ? <Check className="w-3.5 h-3.5" style={{ color: '#06C270' }} /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre
          className="text-[13px] font-mono whitespace-pre-wrap rounded-lg p-3 text-hz-text-secondary overflow-auto"
          style={{ background: monoBg, border: `1px solid ${softBorder}` }}
        >
          {message.rawMessage ?? '—'}
        </pre>
      </section>

      {/* Actions */}
      <div className="px-5 py-4 flex items-center gap-2 shrink-0">
        {canRelease && (
          <button
            onClick={handleRelease}
            disabled={transmit.isPending}
            className="h-9 px-4 rounded-xl text-[13px] font-semibold flex items-center gap-2 transition-opacity"
            style={{ background: accentColor, color: '#fff', opacity: transmit.isPending ? 0.6 : 1 }}
          >
            {transmit.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {message.status === 'failed' ? 'Retry transmit' : 'Release & send'}
          </button>
        )}
        {canDiscard && (
          <button
            onClick={handleDiscard}
            disabled={discard.isPending}
            className="h-9 px-4 rounded-xl text-[13px] font-semibold flex items-center gap-2 transition-opacity"
            style={{ background: 'rgba(255,59,59,0.14)', color: '#FF3B3B' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Discard
          </button>
        )}
        {!canRelease && !canDiscard && (
          <div className="text-[13px] text-hz-text-tertiary">
            No actions available for status <span className="font-mono">{message.status}</span>
          </div>
        )}
      </div>
    </aside>
  )
}

function SectionTitle({ children, accentColor }: { children: React.ReactNode; accentColor: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-[3px] h-4 rounded-full" style={{ background: accentColor }} />
      <span className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary">{children}</span>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 py-1">
      <span className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary w-[96px] shrink-0">
        {label}
      </span>
      <span className={`text-[13px] text-hz-text ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}
