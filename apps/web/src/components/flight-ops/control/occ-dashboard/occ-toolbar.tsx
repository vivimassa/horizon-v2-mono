'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { OccWindow } from './use-occ-flights'

interface OccToolbarProps {
  timezone: string
  window: OccWindow
  onWindowChange: (w: OccWindow) => void
  isFetching: boolean
  /** Optional manual refresh trigger. */
  onRefresh?: () => void
}

export function OccToolbar({ timezone, window, onWindowChange, isFetching, onRefresh }: OccToolbarProps) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const utc = fmtUtc(now)
  const local = fmtLocal(now, timezone)

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 px-5 py-3 bg-[rgba(11,11,18,0.0)] dark:bg-[rgba(11,11,18,0.72)] backdrop-blur-xl border-b border-[rgba(17,17,24,0.08)] dark:border-white/10">
      <h1 className="m-0 text-[22px] font-bold tracking-[-0.01em] text-[var(--occ-text)]">
        Operation Control Center Dashboard
      </h1>

      <div className="ml-auto flex items-center gap-2 flex-wrap">
        <div className="inline-flex border border-[rgba(17,17,24,0.08)] dark:border-white/10 rounded-xl overflow-hidden bg-white/70 dark:bg-[#191921]/70 shadow-[0_1px_2px_rgba(96,97,112,0.08)]">
          <ClockCell label="UTC" value={utc} />
          <span className="w-px bg-[rgba(17,17,24,0.08)] dark:bg-white/10" />
          <ClockCell label="LOCAL" value={local} />
        </div>

        <div className="inline-flex bg-white/70 dark:bg-[#191921]/70 border border-[rgba(17,17,24,0.08)] dark:border-white/10 rounded-xl p-1 gap-0.5 shadow-[0_1px_2px_rgba(96,97,112,0.08)]">
          {(['today', '6h', '24h'] as OccWindow[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onWindowChange(w)}
              className={`px-3.5 h-8 text-[13px] font-medium rounded-lg transition-colors ${
                window === w
                  ? 'bg-[var(--occ-accent-tint)] text-[var(--occ-accent)] font-semibold shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--occ-accent)_30%,transparent)]'
                  : 'text-[var(--occ-text-2)] hover:text-[var(--occ-text)] hover:bg-[rgba(17,17,24,0.04)] dark:hover:bg-white/5'
              }`}
            >
              {w === 'today' ? 'Today' : w === '6h' ? 'Last 6h' : 'Last 24h'}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          title="Auto-refresh every 30s"
          className={`inline-flex items-center gap-2 h-10 px-3.5 border border-[rgba(17,17,24,0.08)] dark:border-white/10 rounded-xl bg-white/70 dark:bg-[#191921]/70 text-[13px] font-medium shadow-[0_1px_2px_rgba(96,97,112,0.08)] hover:bg-white/90 dark:hover:bg-[#191921]/90 transition-colors ${
            isFetching ? 'text-[#FF8800]' : 'text-[var(--occ-text-2)]'
          }`}
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          <span className="font-mono">{isFetching ? 'syncing' : 'live · 30s'}</span>
        </button>
      </div>
    </header>
  )
}

function ClockCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 h-10 text-[13px]">
      <span className="text-[11px] font-semibold tracking-[.08em] uppercase text-[var(--occ-text-3)]">{label}</span>
      <span className="font-mono font-bold text-[var(--occ-text)] tabular-nums tracking-[-0.01em]">{value}</span>
    </div>
  )
}

function fmtUtc(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`
}

function fmtLocal(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
      hour12: false,
      timeZoneName: 'short',
    }).format(d)
  } catch {
    return d.toLocaleTimeString()
  }
}
