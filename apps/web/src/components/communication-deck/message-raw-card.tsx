'use client'

/**
 * Raw-telex message card. The full raw telex is displayed by default;
 * hovering the card shows a floating popover with decoded MVT, delays,
 * and supplementary info (SI).
 */

import { memo, useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { MovementMessageRef } from '@skyhub/api'
import {
  parseMessage,
  formatMvtTime,
  formatDelayDuration,
  getDelayCodeDescription,
  type ParsedMessage,
} from '@skyhub/logic/src/iata/index'
import { useTheme } from '@/components/theme-provider'

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  held: { bg: 'rgba(255,136,0,0.14)', fg: '#FF8800' },
  pending: { bg: 'rgba(253,221,72,0.18)', fg: '#C99400' },
  sent: { bg: 'rgba(0,99,247,0.14)', fg: '#0063F7' },
  applied: { bg: 'rgba(6,194,112,0.14)', fg: '#06C270' },
  failed: { bg: 'rgba(255,59,59,0.14)', fg: '#FF3B3B' },
  rejected: { bg: 'rgba(255,59,59,0.14)', fg: '#FF3B3B' },
  discarded: { bg: 'rgba(96,97,112,0.14)', fg: '#606170' },
}

interface Props {
  message: MovementMessageRef
  accentColor: string
  checkable?: boolean
  checked?: boolean
  onToggleCheck?: (id: string) => void
}

const POPOVER_WIDTH = 380
const POPOVER_MAX_H = 420
const CURSOR_GAP = 14

export const MessageRawCard = memo(function MessageRawCard({
  message,
  accentColor,
  checkable = false,
  checked = false,
  onToggleCheck,
}: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const cardRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const parsed = useMemo<ParsedMessage | null>(() => {
    if (!message.rawMessage) return null
    try {
      return parseMessage(message.rawMessage)
    } catch {
      return null
    }
  }, [message.rawMessage])

  const positionAtCursor = useCallback((clientX: number, clientY: number) => {
    const spaceRight = window.innerWidth - clientX
    const left =
      spaceRight >= POPOVER_WIDTH + CURSOR_GAP
        ? clientX + CURSOR_GAP
        : Math.max(8, clientX - POPOVER_WIDTH - CURSOR_GAP)
    const spaceBelow = window.innerHeight - clientY
    const top =
      spaceBelow >= POPOVER_MAX_H + CURSOR_GAP
        ? clientY + CURSOR_GAP
        : Math.max(8, clientY - POPOVER_MAX_H - CURSOR_GAP)
    setPos({ top, left })
  }, [])

  const handleEnter = useCallback(
    (e: React.MouseEvent) => {
      positionAtCursor(e.clientX, e.clientY)
      setHover(true)
    },
    [positionAtCursor],
  )

  const handleMove = useCallback(
    (e: React.MouseEvent) => {
      positionAtCursor(e.clientX, e.clientY)
    },
    [positionAtCursor],
  )

  const handleLeave = useCallback(() => setHover(false), [])

  useEffect(() => {
    if (!hover) return
    const onScroll = () => setHover(false)
    window.addEventListener('scroll', onScroll, true)
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [hover])

  // Derived display state: a discarded message with a `superseded_by:…` reason
  // is the system auto-retiring it because a newer message replaced it, which
  // is different from an operator-initiated discard. Badge it distinctly.
  const isSuperseded = message.status === 'discarded' && message.errorReason?.startsWith('superseded_by:')
  const statusLabel = isSuperseded ? 'Superseded' : message.status
  const statusClr = isSuperseded
    ? { bg: 'rgba(172,93,217,0.14)', fg: '#AC5DD9' }
    : (STATUS_COLORS[message.status] ?? { bg: 'rgba(96,97,112,0.12)', fg: '#606170' })
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const hoverBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,1)'
  const checkedRingColor = checked ? accentColor : 'transparent'

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleEnter}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="rounded-xl transition-colors"
      style={{
        background: hover || checked ? hoverBg : cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: checked ? `0 0 0 1px ${checkedRingColor}` : undefined,
      }}
    >
      {/* Header strip: status + route + flight + optional checkbox */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
        {checkable && (
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onToggleCheck?.(message._id)}
            aria-label={`Select ${message.flightNumber ?? 'message'}`}
            className="w-3.5 h-3.5 cursor-pointer shrink-0"
            style={{ accentColor }}
          />
        )}
        <span
          className="inline-flex px-2 py-0.5 rounded-md text-[13px] font-semibold capitalize"
          style={{ background: statusClr.bg, color: statusClr.fg }}
        >
          {statusLabel}
        </span>
        <span
          className="inline-flex px-2 py-0.5 rounded-md text-[13px] font-semibold"
          style={{ background: `${accentColor}1A`, color: accentColor }}
        >
          {message.messageType} · {message.actionCode}
        </span>
        <span className="text-[13px] font-semibold text-hz-text">{message.flightNumber ?? '—'}</span>
        <span className="text-[13px] font-mono text-hz-text-secondary">
          {message.depStation && message.arrStation
            ? `${message.depStation}-${message.arrStation}`
            : (message.depStation ?? message.arrStation ?? '')}
        </span>
        <span className="ml-auto text-[13px] font-mono text-hz-text-tertiary">
          {formatCreatedTime(message.createdAtUtc)}
        </span>
      </div>

      {/* Raw telex — shown in full; decoded view lives in the hover popover */}
      <pre className="text-[13px] font-mono whitespace-pre-wrap text-hz-text-secondary px-3 pb-2.5 pt-0 leading-snug">
        {message.rawMessage ?? '—'}
      </pre>

      {/* Hover popover */}
      {hover &&
        typeof window !== 'undefined' &&
        createPortal(
          <HoverPanel message={message} parsed={parsed} accentColor={accentColor} pos={pos} pageIsDark={isDark} />,
          document.body,
        )}
    </div>
  )
})

function formatCreatedTime(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(11, 16) + 'z'
  } catch {
    return '--:--'
  }
}

function HoverPanel({
  message,
  parsed,
  accentColor,
  pos,
  pageIsDark,
}: {
  message: MovementMessageRef
  parsed: ParsedMessage | null
  accentColor: string
  pos: { top: number; left: number }
  pageIsDark: boolean
}) {
  // Inverted palette: dark panel in light mode, light panel in dark mode —
  // matches the global <Tooltip> component so the hover feels consistent.
  const panelBg = pageIsDark ? 'rgba(244,244,245,0.95)' : 'rgba(24,24,27,0.92)'
  const panelText = pageIsDark ? '#18181b' : '#fafafa'
  const panelTextSecondary = pageIsDark ? 'rgba(24,24,27,0.72)' : 'rgba(250,250,250,0.78)'
  const panelTextTertiary = pageIsDark ? 'rgba(24,24,27,0.54)' : 'rgba(250,250,250,0.58)'
  const panelBorder = pageIsDark ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.12)'
  const softBorder = pageIsDark ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.10)'
  const monoBg = pageIsDark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'

  const mvt = parsed?.type === 'MVT' ? parsed : null

  return (
    <div
      className="fixed z-[10000] rounded-xl overflow-auto custom-scrollbar"
      style={{
        top: pos.top,
        left: pos.left,
        width: 380,
        maxHeight: 420,
        background: panelBg,
        color: panelText,
        border: `1px solid ${panelBorder}`,
        backdropFilter: 'blur(20px) saturate(1.6)',
        boxShadow: pageIsDark ? '0 8px 32px rgba(0,0,0,0.18)' : '0 8px 32px rgba(0,0,0,0.35)',
        pointerEvents: 'none',
        animation: 'bc-dropdown-in 120ms ease-out',
      }}
    >
      <div className="px-4 pt-3 pb-2 border-b" style={{ borderColor: softBorder }}>
        <div className="flex items-center gap-2">
          <div className="w-[3px] h-4 rounded-full" style={{ background: accentColor }} />
          <span className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: panelTextTertiary }}>
            {mvt ? 'Decoded MVT' : 'Message'}
          </span>
        </div>
      </div>

      {mvt ? (
        <div className="px-4 py-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 items-baseline">
          <Field
            label="Flight"
            value={`${mvt.flightId.airline}${mvt.flightId.flightNumber}`}
            mono
            labelColor={panelTextTertiary}
            valueColor={panelText}
          />
          <Field
            label="Day"
            value={mvt.flightId.dayOfMonth}
            mono
            labelColor={panelTextTertiary}
            valueColor={panelText}
          />
          <Field
            label="Reg"
            value={mvt.flightId.registration}
            mono
            labelColor={panelTextTertiary}
            valueColor={panelText}
          />
          <Field
            label="Station"
            value={mvt.flightId.station}
            mono
            labelColor={panelTextTertiary}
            valueColor={panelText}
          />
          <Field label="Action" value={mvt.actionCode} labelColor={panelTextTertiary} valueColor={panelText} />
          {mvt.offBlocks && (
            <Field
              label="Off blocks"
              value={formatMvtTime(mvt.offBlocks)}
              mono
              labelColor={panelTextTertiary}
              valueColor={panelText}
            />
          )}
          {mvt.airborne && (
            <Field
              label="Airborne"
              value={formatMvtTime(mvt.airborne)}
              mono
              labelColor={panelTextTertiary}
              valueColor={panelText}
            />
          )}
          {mvt.touchdown && (
            <Field
              label="Touchdown"
              value={formatMvtTime(mvt.touchdown)}
              mono
              labelColor={panelTextTertiary}
              valueColor={panelText}
            />
          )}
          {mvt.onBlocks && (
            <Field
              label="On blocks"
              value={formatMvtTime(mvt.onBlocks)}
              mono
              labelColor={panelTextTertiary}
              valueColor={panelText}
            />
          )}
          {mvt.estimatedDeparture && (
            <Field
              label="ETD"
              value={formatMvtTime(mvt.estimatedDeparture)}
              mono
              labelColor={panelTextTertiary}
              valueColor={panelText}
            />
          )}
          {mvt.nextInfoTime && (
            <Field
              label="Next info"
              value={formatMvtTime(mvt.nextInfoTime)}
              mono
              labelColor={panelTextTertiary}
              valueColor={panelText}
            />
          )}
          {mvt.returnTime && (
            <Field
              label="Return"
              value={formatMvtTime(mvt.returnTime)}
              mono
              labelColor={panelTextTertiary}
              valueColor={panelText}
            />
          )}
          {mvt.etas.map((eta, i) => (
            <Field
              key={i}
              label={i === 0 ? 'ETA' : ''}
              value={`${formatMvtTime(eta.time)} → ${eta.destination}`}
              mono
              labelColor={panelTextTertiary}
              valueColor={panelText}
            />
          ))}
          {mvt.passengers && (
            <Field
              label="PAX"
              value={`${mvt.passengers.total}${
                mvt.passengers.noSeatHolders ? ` + ${mvt.passengers.noSeatHolders} inf` : ''
              }`}
              mono
              labelColor={panelTextTertiary}
              valueColor={panelText}
            />
          )}
        </div>
      ) : (
        <div className="px-4 py-3 text-[13px]" style={{ color: panelTextSecondary }}>
          {message.summary ?? 'No decoded view available for this message.'}
        </div>
      )}

      {mvt && mvt.delays.length > 0 && (
        <div className="px-4 pb-3">
          <div className="text-[13px] font-semibold uppercase tracking-wider mb-2" style={{ color: panelTextTertiary }}>
            Delays ({message.delayStandard === 'ahm732' ? 'AHM 732 Triple-A' : 'AHM 730/731'})
          </div>
          <div className="space-y-1.5">
            {mvt.delays.map((d, i) => (
              <div
                key={i}
                className="flex items-baseline gap-2 px-2.5 py-1.5 rounded-lg"
                style={{ background: monoBg }}
              >
                <span className="text-[13px] font-mono font-semibold" style={{ color: panelText }}>
                  {d.code}
                </span>
                <span className="text-[13px] flex-1 truncate" style={{ color: panelTextSecondary }}>
                  {d.ahm732 ? `${d.ahm732.process} · ${d.ahm732.reason}` : getDelayCodeDescription(d.code) || '—'}
                </span>
                {d.duration && (
                  <span className="text-[13px] font-mono" style={{ color: accentColor }}>
                    {formatDelayDuration(d.duration)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {mvt && mvt.supplementaryInfo.length > 0 && (
        <div className="px-4 pb-3">
          <div className="text-[13px] font-semibold uppercase tracking-wider mb-2" style={{ color: panelTextTertiary }}>
            SI
          </div>
          {mvt.supplementaryInfo.map((si, i) => (
            <div key={i} className="text-[13px] font-mono" style={{ color: panelTextSecondary }}>
              {si}
            </div>
          ))}
        </div>
      )}

      {message.errorReason &&
        (() => {
          const info = humanizeReason(message.errorReason)
          const tint =
            info.tone === 'info'
              ? { bg: 'rgba(96,97,112,0.22)', fg: panelTextSecondary, border: 'rgba(96,97,112,0.32)' }
              : { bg: 'rgba(255,59,59,0.18)', fg: '#FF6B6B', border: 'rgba(255,59,59,0.32)' }
          return (
            <div
              className="mx-4 mb-3 rounded-lg px-3 py-2 text-[13px]"
              style={{ background: tint.bg, color: tint.fg, border: `1px solid ${tint.border}` }}
            >
              {info.label}
            </div>
          )
        })()}
    </div>
  )
}

function humanizeReason(raw: string): { label: string; tone: 'error' | 'info' } {
  if (raw.startsWith('superseded_by:')) {
    return { label: 'Superseded by a newer message', tone: 'info' }
  }
  if (raw === 'transmission_failed') {
    return { label: 'Transmission failed', tone: 'error' }
  }
  return { label: raw, tone: 'error' }
}

function Field({
  label,
  value,
  mono,
  labelColor,
  valueColor,
}: {
  label: string
  value: string
  mono?: boolean
  labelColor: string
  valueColor: string
}) {
  return (
    <>
      <span className="text-[13px] font-semibold uppercase tracking-wider text-left" style={{ color: labelColor }}>
        {label}
      </span>
      <span className={`text-[13px] text-right ${mono ? 'font-mono' : ''}`} style={{ color: valueColor }}>
        {value}
      </span>
    </>
  )
}
