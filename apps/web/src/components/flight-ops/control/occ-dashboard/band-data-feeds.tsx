'use client'

import type { ReactNode } from 'react'
import { Radio, Send, Mail, CloudSun } from 'lucide-react'
import type { FeedState, FeedStatus } from '@skyhub/api'
import { BandHead } from './lib/occ-helpers'

type FeedTone = 'accent' | 'ok' | 'warn' | 'err'

interface FeedTileProps {
  icon: ReactNode
  label: string
  shortLabel: string
  description: string
  value: string
  tone?: FeedTone
  state: FeedState
  lastSeenAtUtc: string | null
  source?: string | null
}

const TONE_BG: Record<FeedTone, string> = {
  accent: 'bg-[var(--occ-accent-tint)] text-[var(--occ-accent)]',
  ok: 'bg-[rgba(6,194,112,0.14)] text-[#06C270]',
  warn: 'bg-[rgba(255,136,0,0.14)] text-[#FF8800]',
  err: 'bg-[rgba(255,59,59,0.14)] text-[#FF3B3B]',
}

const STATE_COLOR: Record<FeedState, { dot: string; glow: string; label: string; text: string }> = {
  online: {
    dot: '#06C270',
    glow: '0 0 8px rgba(6,194,112,0.7)',
    label: 'ONLINE',
    text: 'text-[#06C270]',
  },
  stale: {
    dot: '#FF8800',
    glow: '0 0 8px rgba(255,136,0,0.6)',
    label: 'STALE',
    text: 'text-[#FF8800]',
  },
  offline: {
    dot: '#FF3B3B',
    glow: '0 0 8px rgba(255,59,59,0.6)',
    label: 'OFFLINE',
    text: 'text-[#FF3B3B]',
  },
  unconfigured: {
    dot: '#8F90A6',
    glow: 'none',
    label: 'NOT CONFIGURED',
    text: 'text-[#8F90A6]',
  },
}

interface BandDataFeedsProps {
  acarsCount: number
  mvtCount: number
  mvtFailures: number
  outboxPending: number
  feedStatus?: FeedStatus
}

export function BandDataFeeds({ acarsCount, mvtCount, mvtFailures, outboxPending, feedStatus }: BandDataFeedsProps) {
  return (
    <section aria-label="Communication & Data Feeds" className="h-full flex flex-col">
      <BandHead tag="Communication & Data Feeds · 6.1" />
      <div className="grid grid-cols-2 grid-rows-2 gap-2 flex-1">
        <FeedTile
          icon={<Radio size={22} />}
          label="ACARS · Inbound"
          shortLabel="ACARS"
          description={`${acarsCount.toLocaleString()} messages received today`}
          value={acarsCount.toLocaleString()}
          state={feedStatus?.acars.state ?? 'unconfigured'}
          lastSeenAtUtc={feedStatus?.acars.lastHeartbeatAtUtc ?? null}
          source={feedStatus?.acars.source}
        />
        <FeedTile
          icon={<Send size={22} />}
          label="MVT Transmission"
          shortLabel="MVT"
          description={
            mvtFailures > 0
              ? `${mvtCount.toLocaleString()} sent · ${mvtFailures} failures today`
              : `${mvtCount.toLocaleString()} sent · 0 failures today`
          }
          tone={mvtFailures > 0 ? 'warn' : 'ok'}
          value={mvtCount.toLocaleString()}
          state={feedStatus?.mvt.state ?? 'unconfigured'}
          lastSeenAtUtc={feedStatus?.mvt.lastHeartbeatAtUtc ?? null}
          source={feedStatus?.mvt.source}
        />
        <FeedTile
          icon={<CloudSun size={22} />}
          label="Weather Watch"
          shortLabel="WX"
          description="NOAA METAR poll · every 15 min"
          tone="warn"
          value="—"
          state={feedStatus?.wx.state ?? 'offline'}
          lastSeenAtUtc={feedStatus?.wx.lastPollAtUtc ?? null}
        />
        <FeedTile
          icon={<Mail size={22} />}
          label="ASM/SSM Outbox"
          shortLabel="ASM/SSM"
          description={`${outboxPending.toLocaleString()} pending releases`}
          tone={outboxPending > 0 ? 'warn' : 'ok'}
          value={outboxPending.toLocaleString()}
          state={feedStatus?.asmSsm.state ?? 'unconfigured'}
          lastSeenAtUtc={feedStatus?.asmSsm.lastHeartbeatAtUtc ?? null}
          source={feedStatus?.asmSsm.source}
        />
      </div>
    </section>
  )
}

function FeedTile({
  icon,
  label,
  shortLabel,
  description,
  value,
  tone = 'accent',
  state,
  lastSeenAtUtc,
  source,
}: FeedTileProps) {
  const stateStyle = STATE_COLOR[state]
  const ago = lastSeenAtUtc ? formatAgo(lastSeenAtUtc) : null
  const lastSeenText = lastSeenAtUtc
    ? `Last ping ${ago}`
    : state === 'unconfigured'
      ? 'No gateway has pinged this feed yet'
      : 'No signal received'

  return (
    <div
      className="group relative flex flex-col items-start gap-1.5 p-3.5 border border-[rgba(17,17,24,0.08)] dark:border-white/10 rounded-xl bg-white/80 dark:bg-[#191921]/80 shadow-[0_1px_2px_rgba(96,97,112,0.08)] hover:bg-white dark:hover:bg-[#191921] hover:shadow-[0_2px_8px_rgba(96,97,112,0.14)] transition-all cursor-default"
      aria-label={`${label} · ${stateStyle.label} — ${lastSeenText}`}
    >
      <span
        className="pointer-events-none absolute top-2.5 right-2.5 w-[9px] h-[9px] rounded-full"
        style={{ background: stateStyle.dot, boxShadow: stateStyle.glow }}
        aria-label={stateStyle.label}
      />

      <div className="flex items-center gap-3 w-full">
        <span className={`w-11 h-11 rounded-xl grid place-items-center shrink-0 ${TONE_BG[tone]}`} aria-hidden>
          {icon}
        </span>
        <div className="text-[26px] font-bold leading-none font-mono tabular-nums tracking-[-0.02em] text-[var(--occ-text)]">
          {value}
        </div>
      </div>

      <div className="text-[11px] uppercase tracking-[.1em] font-semibold text-[var(--occ-text-2)]">{shortLabel}</div>

      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 rounded-lg bg-[#1C1C28] dark:bg-[#2A2A35] text-white text-[12px] shadow-[0_6px_20px_rgba(0,0,0,0.35)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150 z-50 border border-white/10 w-[220px]">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="font-semibold text-[12.5px]">{label}</div>
          <div
            className={`inline-flex items-center gap-1.5 ${stateStyle.text} text-[10.5px] font-bold tracking-[0.08em]`}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: stateStyle.dot }} />
            {stateStyle.label}
          </div>
        </div>
        <div className="text-[11px] text-white/70 leading-snug">{description}</div>
        <div className="text-[10.5px] text-white/50 mt-1 font-mono">{lastSeenText}</div>
        {source && <div className="text-[10.5px] text-white/40 mt-0.5 font-mono truncate">{source}</div>}
        <span
          className="absolute top-1/2 -translate-y-1/2 -left-[5px] w-[10px] h-[10px] rotate-45 bg-[#1C1C28] dark:bg-[#2A2A35] border-l border-b border-white/10"
          aria-hidden
        />
      </div>
    </div>
  )
}

function formatAgo(iso: string): string {
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return '—'
  const sec = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 48) return `${hr}h ago`
  const day = Math.round(hr / 24)
  return `${day}d ago`
}
