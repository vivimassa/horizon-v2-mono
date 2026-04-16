'use client'

import { useEffect, useMemo, useState } from 'react'
import { Cloud, CloudDrizzle, CloudLightning } from 'lucide-react'
import { api, type WeatherAlertsResponse, type WeatherFlightCategory } from '@skyhub/api'

const FLIGHT_CATEGORY_COLOR: Record<WeatherFlightCategory, string> = {
  VFR: '#22c55e',
  MVFR: '#3b82f6',
  IFR: '#ef4444',
  LIFR: '#a855f7',
}

function formatUtc(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const hh = d.getUTCHours().toString().padStart(2, '0')
  const mm = d.getUTCMinutes().toString().padStart(2, '0')
  return `${hh}:${mm} UTC`
}

/**
 * Card 4 — live weather posture for monitored stations. Shows worst-
 * station alert + warn/caution/IFR counts + last update. Empty-state
 * guides admin to enable weatherMonitored on airports.
 */
export function WeatherOpsCard() {
  const [data, setData] = useState<WeatherAlertsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    api
      .listWeatherAlerts()
      .then((res) => {
        if (alive) setData(res)
      })
      .catch(() => {
        if (alive) setData(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const lastUpdate = useMemo(() => {
    if (!data || data.observations.length === 0) return null
    const latest = data.observations.reduce<string | null>(
      (max, o) => (max === null || o.observedAt > max ? o.observedAt : max),
      null,
    )
    return latest
  }, [data])

  if (loading) {
    return (
      <div className="flex flex-col gap-3 min-w-0">
        <span className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary">Weather</span>
        <div className="text-[13px] text-hz-text-tertiary">Loading…</div>
      </div>
    )
  }

  if (!data || data.stationsMonitored === 0) {
    return (
      <div className="flex flex-col gap-2 min-w-0">
        <span className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary">Weather</span>
        <div className="text-[13px] text-hz-text-secondary leading-relaxed">
          Weather monitoring disabled. Enable <span className="font-medium">weatherMonitored</span> on airports in
          master data to poll METAR.
        </div>
      </div>
    )
  }

  const worstColor = data.worst ? FLIGHT_CATEGORY_COLOR[data.worst.flightCategory] : '#8F90A6'

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary">Weather</span>
        {data.worst ? (
          <span
            className="text-[13px] font-semibold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: `${worstColor}18`, color: worstColor }}
          >
            {data.worst.icao} · {data.worst.flightCategory}
          </span>
        ) : (
          <span className="text-[13px] text-hz-text-tertiary">All VFR</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat
          icon={<CloudLightning className="h-3.5 w-3.5" style={{ color: '#ef4444' }} />}
          label="Warn"
          value={data.counts.warn}
          color="#ef4444"
        />
        <Stat
          icon={<CloudDrizzle className="h-3.5 w-3.5" style={{ color: '#f59e0b' }} />}
          label="Caution"
          value={data.counts.caution}
          color="#f59e0b"
        />
        <Stat
          icon={<Cloud className="h-3.5 w-3.5" style={{ color: FLIGHT_CATEGORY_COLOR.IFR }} />}
          label="IFR/LIFR"
          value={data.ifrCount}
          color={FLIGHT_CATEGORY_COLOR.IFR}
        />
      </div>

      <div className="text-[13px] text-hz-text-tertiary">
        {data.stationsReporting}/{data.stationsMonitored} stations · last update {formatUtc(lastUpdate)}
      </div>
    </div>
  )
}

function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="flex items-center gap-1 text-[13px] font-medium text-hz-text-tertiary">
        {icon}
        {label}
      </span>
      <span className="text-[18px] font-bold leading-tight" style={{ color }}>
        {value}
      </span>
    </div>
  )
}
