'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { getApiBaseUrl } from '@skyhub/api'
import { authedFetch } from '@/lib/authed-fetch'
import { useGanttStore } from '@/stores/use-gantt-store'
import { useOperatorStore } from '@/stores/use-operator-store'

interface AircraftDetail {
  registration: string
  aircraftTypeIcao: string | null
  aircraftTypeName: string | null
  lopa: {
    configName: string
    totalSeats: number
    cabins: { classCode: string; seats: number; color: string | null; sortOrder: number }[]
  } | null
}

// Fallback colors if DB color is null
const FALLBACK_COLORS: Record<string, string> = {
  F: '#8B5CF6',
  J: '#3B82F6',
  C: '#3B82F6',
  W: '#14B8A6',
  Y: '#06C270',
}

function getCabinColor(classCode: string, dbColor: string | null): string {
  return dbColor ?? FALLBACK_COLORS[classCode] ?? '#6B7280'
}

export function AircraftPopover() {
  const pop = useGanttStore((s) => s.aircraftPopover)
  const close = useGanttStore((s) => s.closeAircraftPopover)
  const flights = useGanttStore((s) => s.flights)
  const utilizationTargets = useGanttStore((s) => s.utilizationTargets)
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [detail, setDetail] = useState<AircraftDetail | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!pop) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    // Delay to avoid closing on the same click that opened it
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 100)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', handler)
    }
  }, [pop, close])

  // Fetch aircraft detail
  useEffect(() => {
    if (!pop) {
      setDetail(null)
      return
    }
    const operatorId = useOperatorStore.getState().operator?._id ?? ''
    authedFetch(
      `${getApiBaseUrl()}/gantt/aircraft-detail?operatorId=${operatorId}&registration=${encodeURIComponent(pop.registration)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then(setDetail)
      .catch(() => {})
  }, [pop])

  // ── Compute period stats from store flights ──
  const stats = useMemo(() => {
    if (!pop) return null
    const acFlights = flights
      .filter(
        (f) => f.aircraftReg === pop.registration || (!f.aircraftReg && f.aircraftTypeIcao === pop.aircraftTypeIcao),
      )
      .filter((f) => f.aircraftReg === pop.registration) // only truly assigned

    const totalFlights = acFlights.length
    const totalBlockMin = acFlights.reduce((s, f) => s + f.blockMinutes, 0)
    const totalBlockHrs = totalBlockMin / 60
    const dates = new Set(acFlights.map((f) => f.operatingDate))
    const daysActive = dates.size
    const avgUtilPerDay = daysActive > 0 ? totalBlockHrs / daysActive : 0

    // Overnight stations: last arrival per date
    const overnightMap = new Map<string, number>()
    for (const date of dates) {
      const dayFlights = acFlights.filter((f) => f.operatingDate === date).sort((a, b) => b.staUtc - a.staUtc)
      if (dayFlights.length > 0) {
        const station = dayFlights[0].arrStation
        overnightMap.set(station, (overnightMap.get(station) ?? 0) + 1)
      }
    }
    const overnightStations = [...overnightMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([station, count]) => ({ station, count, pct: daysActive > 0 ? Math.round((count / daysActive) * 100) : 0 }))

    return { totalFlights, totalBlockHrs, daysActive, avgUtilPerDay, overnightStations }
  }, [pop, flights])

  if (!mounted || !pop) return null

  // Theme
  const bg = isDark ? 'rgba(244,244,245,0.95)' : 'rgba(24,24,27,0.92)'
  const border = isDark ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'
  const text = isDark ? '#18181b' : '#fafafa'
  const textMuted = isDark ? 'rgba(24,24,27,0.50)' : 'rgba(250,250,250,0.50)'
  const textSec = isDark ? 'rgba(24,24,27,0.70)' : 'rgba(250,250,250,0.70)'
  const accent = 'var(--module-accent, #1e40af)'
  const cardBg = isDark ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.08)'
  const cardBorder = isDark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'

  // Position: clamp to viewport
  const w = 400
  const h = 460
  const vpW = window.innerWidth
  const vpH = window.innerHeight
  const left = pop.x + w > vpW ? vpW - w - 12 : pop.x
  const top = pop.y + h > vpH ? vpH - h - 12 : pop.y

  const icao = pop.aircraftTypeIcao || detail?.aircraftTypeIcao || ''
  const fuselageSrc = icao ? `/assets/aircraft/${icao}/fuselage.png` : null
  const lopa = detail?.lopa

  // Overnight donut
  const oStations = stats?.overnightStations ?? []
  const donutColors = ['#3B82F6', '#06C270', '#F59E0B', '#8B5CF6', '#6B7280']

  const content = (
    <div
      data-gantt-overlay
      ref={ref}
      className="fixed z-[9998] rounded-xl overflow-hidden"
      style={{
        left,
        top,
        width: w,
        background: bg,
        border: `1px solid ${border}`,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div>
          <span className="text-[16px] font-mono font-bold" style={{ color: text }}>
            {pop.registration}
          </span>
          <span className="text-[13px] ml-2" style={{ color: textSec }}>
            {detail?.aircraftTypeName ?? icao}
            {lopa ? ` (${lopa.totalSeats} seats)` : ''}
          </span>
        </div>
        <button
          onClick={close}
          className="w-6 h-6 rounded-md flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
          style={{ background: cardBg }}
        >
          <X size={14} style={{ color: text }} />
        </button>
      </div>

      {/* Fuselage image with cabin class blocks overlaid */}
      {fuselageSrc && (
        <div
          className="relative mx-4 mb-1 overflow-hidden rounded-lg flex items-center justify-center"
          style={{ height: 80 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fuselageSrc}
            alt=""
            className="select-none"
            style={{
              height: '160%',
              transform: 'translateX(17px)',
              opacity: isDark ? 0.25 : 0.2,
              filter: isDark ? 'invert(1) brightness(0.8)' : 'none',
            }}
            draggable={false}
          />
          {/* Seat blocks inside fuselage body — centered overlay */}
          {lopa && lopa.totalSeats > 0 && (
            <div
              className="absolute flex items-center overflow-hidden"
              style={{ top: '30%', bottom: '30%', left: '19%', right: '19%' }}
            >
              {lopa.cabins.map((c, i) => {
                const pct = (c.seats / lopa.totalSeats) * 100
                const color = getCabinColor(c.classCode, c.color)
                return (
                  <div
                    key={c.classCode}
                    className="h-full flex items-center justify-center"
                    style={{
                      width: `${pct}%`,
                      background: color,
                      opacity: 0.6,
                      borderRight:
                        i < lopa.cabins.length - 1
                          ? `1px solid ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.4)'}`
                          : 'none',
                    }}
                  >
                    <span
                      className="text-[11px] font-mono font-bold text-white"
                      style={{ opacity: 1, textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}
                    >
                      {c.classCode}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Cabin class labels — centered below fuselage */}
      {lopa && (
        <div className="flex items-center justify-center gap-3 mx-4 mb-3">
          {lopa.cabins.map((c) => (
            <span key={c.classCode} className="text-[13px] font-mono font-bold" style={{ color: textSec }}>
              {c.classCode}: {c.seats}
            </span>
          ))}
        </div>
      )}

      {/* Period Summary */}
      <div className="mx-4 mb-3 rounded-lg p-3" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <div className="text-[13px] font-bold uppercase tracking-wider mb-2" style={{ color: textMuted }}>
          Period Summary
        </div>
        <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
          <StatRow label="Flights" value={String(stats?.totalFlights ?? 0)} text={text} muted={textSec} />
          <StatRow
            label="Block Hours"
            value={`${(stats?.totalBlockHrs ?? 0).toFixed(1)}h`}
            text={text}
            muted={textSec}
          />
          <StatRow label="Days Active" value={String(stats?.daysActive ?? 0)} text={text} muted={textSec} />
          <StatRow label="Avg/Day" value={`${(stats?.avgUtilPerDay ?? 0).toFixed(1)}h`} text={text} muted={textSec} />
        </div>
        {/* Utilization bar — against target, not 24h */}
        {stats &&
          stats.daysActive > 0 &&
          (() => {
            const targetHrs = utilizationTargets.get(pop.aircraftTypeIcao) ?? 10
            const utilPct = (stats.avgUtilPerDay / targetHrs) * 100
            const utilColor = utilPct >= 85 ? '#06C270' : utilPct >= 60 ? '#F59E0B' : '#E63535'
            return (
              <div className="mt-2">
                <div className="flex justify-between mb-1">
                  <span className="text-[13px]" style={{ color: textSec }}>
                    Utilization
                  </span>
                  <span className="text-[13px] font-mono font-bold" style={{ color: utilColor }}>
                    {utilPct.toFixed(0)}%
                  </span>
                </div>
                <div className="relative h-[6px] rounded-full" style={{ background: cardBorder }}>
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${Math.min(100, utilPct)}%`,
                      background: utilColor,
                    }}
                  />
                  <div
                    className="absolute"
                    style={{
                      left: `${Math.min(100, (targetHrs / 20) * 100)}%`,
                      top: -3,
                      bottom: -3,
                      width: 2,
                      background: '#06C270',
                      borderRadius: 1,
                    }}
                  />
                </div>
              </div>
            )
          })()}
      </div>

      {/* Overnight Stations */}
      <div className="mx-4 mb-4 rounded-lg p-3" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <div className="text-[13px] font-bold uppercase tracking-wider mb-2" style={{ color: textMuted }}>
          Overnight Stations
        </div>
        {oStations.length === 0 ? (
          <span className="text-[13px]" style={{ color: textMuted }}>
            No data
          </span>
        ) : (
          <div className="flex gap-3">
            {/* Mini donut */}
            <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0">
              {(() => {
                const r = 22
                const cx = 28
                const circ = 2 * Math.PI * r
                let offset = 0
                return oStations.slice(0, 5).map((s, i) => {
                  const pct = s.pct / 100
                  const dash = pct * circ
                  const el = (
                    <circle
                      key={s.station}
                      cx={cx}
                      cy={cx}
                      r={r}
                      fill="none"
                      stroke={donutColors[i % donutColors.length]}
                      strokeWidth="6"
                      strokeDasharray={`${dash} ${circ - dash}`}
                      strokeDashoffset={-offset}
                      transform={`rotate(-90 ${cx} ${cx})`}
                    />
                  )
                  offset += dash
                  return el
                })
              })()}
              <text x="28" y="30" textAnchor="middle" className="text-[13px] font-bold" style={{ fill: text }}>
                {stats?.daysActive ?? 0}
              </text>
            </svg>
            {/* Legend */}
            <div className="flex-1 space-y-1">
              {oStations.slice(0, 5).map((s, i) => (
                <div key={s.station} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: donutColors[i % donutColors.length] }}
                    />
                    <span className="text-[13px] font-mono font-bold" style={{ color: text }}>
                      {s.station}
                    </span>
                  </div>
                  <span className="text-[13px] font-mono" style={{ color: textSec }}>
                    {s.count} ({s.pct}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

function StatRow({ label, value, text, muted }: { label: string; value: string; text: string; muted: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px]" style={{ color: muted }}>
        {label}
      </span>
      <span className="text-[14px] font-mono font-bold" style={{ color: text }}>
        {value}
      </span>
    </div>
  )
}
