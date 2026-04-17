'use client'

/**
 * Armed-state banner shown on the Communication Deck whenever the
 * operator's auto-transmit scheduler is enabled. Polls
 * /movement-messages/auto-transmit/status every 15 s and exposes a
 * one-click pause that flips the persisted config.
 *
 * Visual is intentionally loud — orange `#FF8800` left bar + tinted
 * background, no glass. Glass blends into the background; armed state
 * should never be ambiguous.
 */

import { useCallback, useEffect, useState } from 'react'
import { Radio, Loader2, Pause } from 'lucide-react'
import { api, type AutoTransmitStatus } from '@skyhub/api'

interface Props {
  operatorId: string
  onDisarmed?: () => void
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00'
  const s = Math.round(ms / 1000)
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export function AutoTransmitBanner({ operatorId, onDisarmed }: Props) {
  const [status, setStatus] = useState<AutoTransmitStatus | null>(null)
  const [now, setNow] = useState(Date.now())
  const [disarming, setDisarming] = useState(false)

  // Poll status every 15 s
  useEffect(() => {
    if (!operatorId) return
    let cancelled = false
    const fetchStatus = () => {
      api
        .getAutoTransmitStatus()
        .then((s) => !cancelled && setStatus(s))
        .catch(() => {})
    }
    fetchStatus()
    const t = setInterval(fetchStatus, 15_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [operatorId])

  // Local countdown tick
  useEffect(() => {
    if (!status?.enabled) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [status?.enabled])

  const handleDisarm = useCallback(async () => {
    if (!operatorId || disarming) return
    setDisarming(true)
    try {
      await api.upsertOperatorMessagingConfig({
        operatorId,
        autoTransmit: { enabled: false },
      })
      setStatus((prev) => (prev ? { ...prev, enabled: false } : prev))
      onDisarmed?.()
    } finally {
      setDisarming(false)
    }
  }, [operatorId, disarming, onDisarmed])

  if (!status?.enabled) return null

  const countdown = status.nextRunAtUtc ? formatCountdown(status.nextRunAtUtc - now) : '—'

  return (
    <div
      className="shrink-0 rounded-2xl flex items-center gap-3 pl-4 pr-2 h-12 overflow-hidden"
      style={{
        background: 'rgba(255,136,0,0.10)',
        border: '1px solid rgba(255,136,0,0.32)',
        borderLeft: '3px solid #FF8800',
      }}
    >
      <Radio size={16} style={{ color: '#FF8800' }} />
      <span className="text-[13px] font-semibold" style={{ color: '#FF8800' }}>
        Auto-transmit ON
      </span>
      <span className="text-[13px] text-hz-text-secondary">·</span>
      <span className="text-[13px] text-hz-text-secondary font-mono">next in {countdown}</span>
      <span className="text-[13px] text-hz-text-secondary">·</span>
      <span className="text-[13px] text-hz-text-secondary">
        {status.lastSent} sent · {status.lastFailed} failed this tick
      </span>

      <div className="flex-1" />

      <button
        onClick={handleDisarm}
        disabled={disarming}
        className="h-8 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition-opacity"
        style={{
          background: 'rgba(255,136,0,0.18)',
          color: '#FF8800',
          border: '1px solid rgba(255,136,0,0.40)',
          opacity: disarming ? 0.6 : 1,
        }}
        title="Disable the auto-transmit scheduler"
      >
        {disarming ? <Loader2 size={14} className="animate-spin" /> : <Pause size={14} />}
        Pause
      </button>
    </div>
  )
}
