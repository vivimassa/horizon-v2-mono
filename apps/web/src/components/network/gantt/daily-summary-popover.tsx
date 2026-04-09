"use client"

import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useGanttStore } from '@/stores/use-gantt-store'

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${days[d.getUTCDay()]}, ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export function DailySummaryPopover() {
  const pop = useGanttStore(s => s.dailySummaryPopover)
  const close = useGanttStore(s => s.closeDailySummary)
  const flights = useGanttStore(s => s.flights)
  const aircraft = useGanttStore(s => s.aircraft)
  const aircraftTypes = useGanttStore(s => s.aircraftTypes)
  const utilizationTargets = useGanttStore(s => s.utilizationTargets)
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!pop) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 100)
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler) }
  }, [pop, close])

  const stats = useMemo(() => {
    if (!pop) return null
    const dayFlights = flights.filter(f => f.operatingDate === pop.date)
    const totalFlights = dayFlights.length
    const totalBlockMin = dayFlights.reduce((s, f) => s + f.blockMinutes, 0)
    const totalBlockHrs = totalBlockMin / 60
    const assignedRegs = new Set(dayFlights.filter(f => f.aircraftReg).map(f => f.aircraftReg))
    const acInService = assignedRegs.size
    const fleetSize = aircraft.length

    // Activity by type
    const byType = new Map<string, { flights: number; blockMin: number; activeRegs: Set<string>; fleetCount: number }>()
    for (const f of dayFlights) {
      const type = f.aircraftTypeIcao ?? 'Unknown'
      const entry = byType.get(type) ?? { flights: 0, blockMin: 0, activeRegs: new Set<string>(), fleetCount: 0 }
      entry.flights++
      entry.blockMin += f.blockMinutes
      if (f.aircraftReg) entry.activeRegs.add(f.aircraftReg)
      byType.set(type, entry)
    }
    // Fleet count per type
    for (const ac of aircraft) {
      const type = ac.aircraftTypeIcao ?? 'Unknown'
      const entry = byType.get(type)
      if (entry) entry.fleetCount++
    }
    const activityByType = [...byType.entries()].map(([type, d]) => {
      const fleetAc = d.fleetCount || aircraft.filter(a => (a.aircraftTypeIcao ?? 'Unknown') === type).length
      const activeAc = d.activeRegs.size
      const blockHrs = d.blockMin / 60
      const acTypeInfo = aircraftTypes.find(t => t.icaoType === type)
      const color = acTypeInfo?.color ?? '#6B7280'
      return {
        type,
        flights: d.flights,
        blockHrs,
        activeAc,
        fleetAc,
        avgActive: activeAc > 0 ? blockHrs / activeAc : 0,
        avgFleet: fleetAc > 0 ? blockHrs / fleetAc : 0,
        target: utilizationTargets.get(type) ?? 10,
        color,
      }
    }).sort((a, b) => a.type.localeCompare(b.type))

    // Overnight stations
    const overnightMap = new Map<string, number>()
    for (const reg of assignedRegs) {
      const regFlights = dayFlights.filter(f => f.aircraftReg === reg).sort((a, b) => b.staUtc - a.staUtc)
      if (regFlights.length > 0) {
        const station = regFlights[0].arrStation
        overnightMap.set(station, (overnightMap.get(station) ?? 0) + 1)
      }
    }
    const overnightStations = [...overnightMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([station, count]) => ({ station, count, pct: acInService > 0 ? Math.round((count / acInService) * 100) : 0 }))

    return { totalFlights, totalBlockHrs, acInService, fleetSize, activityByType, overnightStations }
  }, [pop, flights, aircraft, aircraftTypes, utilizationTargets])

  if (!mounted || !pop) return null

  const bg = isDark ? 'rgba(244,244,245,0.95)' : 'rgba(24,24,27,0.92)'
  const border = isDark ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'
  const text = isDark ? '#18181b' : '#fafafa'
  const textSec = isDark ? 'rgba(24,24,27,0.70)' : 'rgba(250,250,250,0.70)'
  const textMuted = isDark ? 'rgba(24,24,27,0.50)' : 'rgba(250,250,250,0.50)'
  const accent = 'var(--module-accent, #1e40af)'
  const cardBg = isDark ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.08)'
  const cardBorder = isDark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'
  const donutColors = ['#3B82F6', '#06C270', '#F59E0B', '#8B5CF6', '#6B7280']

  const w = 400
  const vpW = window.innerWidth
  const vpH = window.innerHeight
  const left = pop.x + w > vpW ? vpW - w - 12 : pop.x
  const top = Math.min(pop.y, vpH - 520)

  return createPortal(
    <div
      data-gantt-overlay
      ref={ref}
      className="fixed z-[9998] rounded-xl overflow-x-hidden overflow-y-auto"
      style={{
        left, top: Math.min(top, window.innerHeight - 562), width: w, maxHeight: 550,
        background: bg, border: `1px solid ${border}`,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div>
          <div className="text-[15px] font-bold" style={{ color: text }}>{fmtDate(pop.date)}</div>
        </div>
        <button onClick={close} className="w-6 h-6 rounded-md flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
          style={{ background: cardBg }}>
          <X size={14} style={{ color: text }} />
        </button>
      </div>

      {/* Summary metrics — big numbers like V1 */}
      <div className="mx-4 mb-3 rounded-lg p-3" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <div className="text-[13px] font-bold uppercase tracking-wider mb-2" style={{ color: textMuted }}>Summary</div>
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <div className="text-[22px] font-bold" style={{ color: accent }}>{stats?.totalFlights ?? 0}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: textMuted }}>Flights</div>
          </div>
          <div className="text-center">
            <div className="text-[22px] font-bold" style={{ color: text }}>{(stats?.totalBlockHrs ?? 0).toFixed(1)}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: textMuted }}>Block Hrs</div>
          </div>
          <div className="text-center">
            <div className="text-[22px] font-bold" style={{ color: text }}>
              {stats?.acInService ?? 0}<span className="text-[14px] font-normal" style={{ color: textMuted }}>/{stats?.fleetSize ?? 0}</span>
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: textMuted }}>AC Used</div>
          </div>
        </div>
      </div>

      {/* Activity by type */}
      {stats && stats.activityByType.length > 0 && (
        <div className="mx-4 mb-3 rounded-lg p-3" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
          <div className="text-[13px] font-bold uppercase tracking-wider mb-2" style={{ color: textMuted }}>Activity by Type</div>
          {/* Header */}
          <div className="grid grid-cols-4 gap-2 mb-1">
            <span className="text-[13px] font-bold" style={{ color: textMuted }}>Type</span>
            <span className="text-[13px] font-bold text-center" style={{ color: textMuted }}>Flights</span>
            <span className="text-[13px] font-bold text-center" style={{ color: textMuted }}>Block</span>
            <span className="text-[13px] font-bold text-center" style={{ color: textMuted }}>AC</span>
          </div>
          {stats.activityByType.map(row => (
            <div key={row.type} className="grid grid-cols-4 gap-2 py-1" style={{ borderTop: `1px solid ${cardBorder}` }}>
              <span className="text-[13px] font-mono font-bold" style={{ color: text }}>{row.type}</span>
              <span className="text-[13px] font-mono text-center" style={{ color: text }}>{row.flights}</span>
              <span className="text-[13px] font-mono text-center" style={{ color: text }}>{row.blockHrs.toFixed(1)}h</span>
              <span className="text-[13px] font-mono text-center" style={{ color: textSec }}>{row.activeAc}/{row.fleetAc}</span>
            </div>
          ))}
        </div>
      )}

      {/* Utilization per type — V1-style with active/fleet averages + target line */}
      {stats && stats.activityByType.length > 0 && (
        <div className="mx-4 mb-3 rounded-lg p-3" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
          <div className="text-[13px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>Utilization</div>
          <div className="text-[11px] mb-3" style={{ color: textMuted }}>Average block hours per aircraft per day</div>
          {stats.activityByType.map(row => {
            const maxHrs = 20
            const activePct = Math.min(100, (row.avgActive / maxHrs) * 100)
            const fleetPct = Math.min(100, (row.avgFleet / maxHrs) * 100)
            const targetPct = Math.min(100, (row.target / maxHrs) * 100)
            return (
              <div key={row.type} className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: row.color }} />
                  <span className="text-[12px] font-bold w-[36px]" style={{ color: text }}>{row.type}</span>
                  <span className="text-[12px] font-semibold" style={{ color: '#06C270' }}>{row.avgActive.toFixed(1)}h</span>
                  <span className="text-[10px]" style={{ color: textMuted }}>active</span>
                  <span className="text-[12px] font-semibold ml-auto" style={{ color: textSec }}>{row.avgFleet.toFixed(1)}h</span>
                  <span className="text-[10px]" style={{ color: textMuted }}>fleet</span>
                </div>
                <div className="relative h-[6px] rounded-full" style={{ background: cardBorder }}>
                  {/* Fleet average (background, full width) */}
                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${fleetPct}%`, background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }} />
                  {/* Active average (foreground) */}
                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${activePct}%`, background: row.color }} />
                  {/* Target line */}
                  <div className="absolute" style={{ left: `${targetPct}%`, top: -3, bottom: -3, width: 2, background: '#06C270', borderRadius: 1 }} />
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: textMuted, marginLeft: `calc(${targetPct}% - 16px)` }}>{row.target}h target</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Overnight stations */}
      <div className="mx-4 mb-4 rounded-lg p-3" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <div className="text-[13px] font-bold uppercase tracking-wider mb-2" style={{ color: textMuted }}>Overnight Stations</div>
        {(!stats || stats.overnightStations.length === 0) ? (
          <span className="text-[13px]" style={{ color: textMuted }}>No data</span>
        ) : (
          <div className="flex gap-3">
            <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0">
              {(() => {
                const r = 22; const cx = 28; const circ = 2 * Math.PI * r
                let offset = 0
                return stats!.overnightStations.slice(0, 5).map((s, i) => {
                  const dash = (s.pct / 100) * circ
                  const el = (
                    <circle key={s.station} cx={cx} cy={cx} r={r} fill="none"
                      stroke={donutColors[i % donutColors.length]} strokeWidth="6"
                      strokeDasharray={`${dash} ${circ - dash}`}
                      strokeDashoffset={-offset}
                      transform={`rotate(-90 ${cx} ${cx})`} />
                  )
                  offset += dash
                  return el
                })
              })()}
              <text x="28" y="30" textAnchor="middle" className="text-[13px] font-bold" style={{ fill: text }}>
                {stats!.acInService}
              </text>
            </svg>
            <div className="flex-1 space-y-1">
              {stats!.overnightStations.slice(0, 5).map((s, i) => (
                <div key={s.station} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: donutColors[i % donutColors.length] }} />
                    <span className="text-[13px] font-mono font-bold" style={{ color: text }}>{s.station}</span>
                  </div>
                  <span className="text-[13px] font-mono" style={{ color: textSec }}>{s.count} ({s.pct}%)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

function Stat({ label, value, text, muted }: { label: string; value: string; text: string; muted: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px]" style={{ color: muted }}>{label}</span>
      <span className="text-[14px] font-mono font-bold" style={{ color: text }}>{value}</span>
    </div>
  )
}
