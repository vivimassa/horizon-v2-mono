"use client"

import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useGanttStore } from '@/stores/use-gantt-store'

function fmtUtc(epochMs: number): string {
  const d = new Date(epochMs)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[d.getUTCDay()]}, ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function fmtGap(ms: number): string {
  const min = Math.round(ms / 60_000)
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, '0') + 'm' : ''}` : `${m}m`
}

function statusColor(s: string): string {
  switch (s) {
    case 'active': return '#06C270'
    case 'draft': return '#3B82F6'
    case 'suspended': return '#FF8800'
    case 'cancelled': return '#FF3B3B'
    default: return '#6B7280'
  }
}

function statusLabel(s: string): string {
  switch (s) {
    case 'active': return 'Active'
    case 'draft': return 'Draft'
    case 'suspended': return 'Suspended'
    case 'cancelled': return 'Cancelled'
    default: return s
  }
}

export function RotationPopover() {
  const pop = useGanttStore(s => s.rotationPopover)
  const close = useGanttStore(s => s.closeRotationPopover)
  const flights = useGanttStore(s => s.flights)
  const aircraftTypes = useGanttStore(s => s.aircraftTypes)
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

  const data = useMemo(() => {
    if (!pop) return null

    // Get flights for this aircraft on this date
    const dayFlights = flights
      .filter(f => f.aircraftReg === pop.registration && f.operatingDate === pop.date)
      .sort((a, b) => a.stdUtc - b.stdUtc)

    const totalBlockMin = dayFlights.reduce((s, f) => s + f.blockMinutes, 0)
    const totalBlockHrs = totalBlockMin / 60
    const utilPct = (totalBlockHrs / 24) * 100

    // TAT default from aircraft type
    const acType = aircraftTypes.find(t => t.icaoType === pop.aircraftTypeIcao)
    const defaultTatMin = acType?.tatDefaultMinutes ?? 30

    // Compute TAT gaps + conflicts
    const gaps: { gapMs: number; gapMin: number; stationMatch: boolean; tatOk: boolean; overlap: boolean }[] = []
    for (let i = 0; i < dayFlights.length - 1; i++) {
      const curr = dayFlights[i]
      const next = dayFlights[i + 1]
      const gapMs = next.stdUtc - curr.staUtc
      const gapMin = Math.round(gapMs / 60_000)
      const stationMatch = curr.arrStation === next.depStation
      const overlap = gapMs < 0
      const tatOk = !overlap && gapMin >= defaultTatMin
      gaps.push({ gapMs, gapMin, stationMatch, tatOk, overlap })
    }

    const conflicts = gaps.filter(g => g.overlap || !g.stationMatch || !g.tatOk).length

    return { dayFlights, totalBlockHrs, utilPct, gaps, conflicts, defaultTatMin }
  }, [pop, flights, aircraftTypes])

  if (!mounted || !pop) return null

  const bg = isDark ? 'rgba(244,244,245,0.95)' : 'rgba(24,24,27,0.92)'
  const border = isDark ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'
  const text = isDark ? '#18181b' : '#fafafa'
  const textSec = isDark ? 'rgba(24,24,27,0.70)' : 'rgba(250,250,250,0.70)'
  const textMuted = isDark ? 'rgba(24,24,27,0.50)' : 'rgba(250,250,250,0.50)'
  const accent = 'var(--module-accent, #1e40af)'
  const cardBg = isDark ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.08)'
  const cardBorder = isDark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'

  const w = 400
  const vpW = window.innerWidth
  const vpH = window.innerHeight
  const left = pop.x + w > vpW ? vpW - w - 12 : pop.x
  const top = Math.min(pop.y, vpH - 500)

  const utilColor = (data?.utilPct ?? 0) >= 85 ? '#06C270' : (data?.utilPct ?? 0) >= 60 ? '#F59E0B' : '#E63535'

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[9998] rounded-xl overflow-hidden"
      style={{
        left, top, width: w,
        background: bg, border: `1px solid ${border}`,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
        maxHeight: 'calc(100vh - 24px)', overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div>
          <span className="text-[16px] font-mono font-bold" style={{ color: text }}>{pop.registration}</span>
          <span className="text-[13px] ml-2" style={{ color: textSec }}>{pop.aircraftTypeIcao}</span>
        </div>
        <button onClick={close} className="w-6 h-6 rounded-md flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
          style={{ background: cardBg }}>
          <X size={14} style={{ color: text }} />
        </button>
      </div>
      <div className="px-4 pb-3 text-[13px]" style={{ color: textSec }}>{fmtDate(pop.date)}</div>

      {/* Daily utilization */}
      <div className="mx-4 mb-3 rounded-lg p-3" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <div className="text-[13px] font-bold uppercase tracking-wider mb-2" style={{ color: textMuted }}>Daily Utilization</div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="text-center">
            <div className="text-[18px] font-mono font-bold" style={{ color: text }}>{data?.dayFlights.length ?? 0}</div>
            <div className="text-[13px]" style={{ color: textMuted }}>Flights</div>
          </div>
          <div className="text-center">
            <div className="text-[18px] font-mono font-bold" style={{ color: text }}>{(data?.totalBlockHrs ?? 0).toFixed(1)}h</div>
            <div className="text-[13px]" style={{ color: textMuted }}>Block</div>
          </div>
          <div className="text-center">
            <div className="text-[18px] font-mono font-bold" style={{ color: utilColor }}>{(data?.utilPct ?? 0).toFixed(0)}%</div>
            <div className="text-[13px]" style={{ color: textMuted }}>Util</div>
          </div>
        </div>
        <div className="h-[6px] rounded-full overflow-hidden" style={{ background: cardBorder }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, data?.utilPct ?? 0)}%`, background: utilColor }} />
        </div>
      </div>

      {/* Flight sequence */}
      <div className="mx-4 mb-4 rounded-lg p-3" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>Flight Sequence</span>
          {data && data.conflicts > 0 && (
            <span className="text-[13px] font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(230,53,53,0.15)', color: '#E63535' }}>
              {data.conflicts} issue{data.conflicts > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {(!data || data.dayFlights.length === 0) ? (
          <div className="py-4 text-center text-[13px]" style={{ color: textMuted }}>No flights on this date</div>
        ) : (
          <div>
            {data.dayFlights.map((f, i) => {
              const sColor = statusColor(f.status)
              const gap = i < data.gaps.length ? data.gaps[i] : null

              return (
                <div key={f.id}>
                  {/* Flight row */}
                  <div className="flex items-center gap-2 py-2">
                    <span className="text-[14px] font-mono font-bold w-[60px] shrink-0" style={{ color: text }}>
                      {f.flightNumber.replace(/^[A-Z]{2}\s?-?/, '')}
                    </span>
                    <span className="text-[13px] font-mono" style={{ color: text }}>
                      {f.depStation} → {f.arrStation}
                    </span>
                    <span className="text-[13px] font-mono flex-1 text-right" style={{ color: textSec }}>
                      {fmtUtc(f.stdUtc)}—{fmtUtc(f.staUtc)}
                    </span>
                    <span className="text-[13px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: `${sColor}15`, color: sColor, fontSize: 11 }}>
                      {statusLabel(f.status)}
                    </span>
                  </div>

                  {/* TAT indicator between flights */}
                  {gap && (
                    <div className="flex items-center gap-2 py-1.5 pl-8" style={{ borderTop: `1px dashed ${cardBorder}`, borderBottom: `1px dashed ${cardBorder}` }}>
                      {gap.overlap ? (
                        <>
                          <XCircle size={14} style={{ color: '#E63535' }} />
                          <span className="text-[13px] font-mono font-bold" style={{ color: '#E63535' }}>OVERLAP {fmtGap(Math.abs(gap.gapMs))}</span>
                        </>
                      ) : !gap.stationMatch ? (
                        <>
                          <AlertTriangle size={14} style={{ color: '#F59E0B' }} />
                          <span className="text-[13px] font-mono" style={{ color: '#F59E0B' }}>
                            STATION MISMATCH: {data.dayFlights[i].arrStation} ≠ {data.dayFlights[i + 1].depStation}
                          </span>
                        </>
                      ) : !gap.tatOk ? (
                        <>
                          <AlertTriangle size={14} style={{ color: '#E63535' }} />
                          <span className="text-[13px] font-mono" style={{ color: '#E63535' }}>
                            TAT: {fmtGap(gap.gapMs)} (min: {data.defaultTatMin}m)
                          </span>
                        </>
                      ) : (
                        <>
                          <CheckCircle size={14} style={{ color: '#06C270' }} />
                          <span className="text-[13px] font-mono" style={{ color: textSec }}>TAT: {fmtGap(gap.gapMs)}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
