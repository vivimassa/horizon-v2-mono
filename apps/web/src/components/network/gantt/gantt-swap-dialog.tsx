"use client"

import { useMemo, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeftRight, AlertTriangle, X, Loader2, Shuffle, Clock, Timer } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useGanttStore } from '@/stores/use-gantt-store'

interface ValidationWarning {
  aircraft: string
  type: 'station_mismatch' | 'time_overlap' | 'tat_violation' | 'type_mismatch'
  message: string
}

export function GanttSwapDialog() {
  const swapMode = useGanttStore(s => s.swapMode)
  const swapDialog = useGanttStore(s => s.swapDialog)
  const closeSwapDialog = useGanttStore(s => s.closeSwapDialog)
  const exitSwapMode = useGanttStore(s => s.exitSwapMode)
  const executeSwap = useGanttStore(s => s.executeSwap)
  const flights = useGanttStore(s => s.flights)
  const aircraft = useGanttStore(s => s.aircraft)
  const aircraftTypes = useGanttStore(s => s.aircraftTypes)
  const barLabelMode = useGanttStore(s => s.barLabelMode)
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [executing, setExecuting] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!swapDialog) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeSwapDialog(); exitSwapMode() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [swapDialog, closeSwapDialog, exitSwapMode])

  const analysis = useMemo(() => {
    if (!swapMode || !swapDialog) return null

    const sourceReg = swapMode.sourceReg
    const targetReg = swapDialog.targetReg
    const sourceDates = swapMode.sourceDates

    // Resolve AC types + colors from registration
    const sourceAc = aircraft.find(a => a.registration === sourceReg)
    const targetAc = aircraft.find(a => a.registration === targetReg)
    const sourceType = sourceAc?.aircraftTypeIcao ?? null
    const targetType = targetAc?.aircraftTypeIcao ?? null
    const typeColorMap = new Map(aircraftTypes.map((t, i) => [
      t.icaoType,
      t.color ?? ['#3B82F6', '#8B5CF6', '#0d9488', '#2563eb', '#d97706', '#7c3aed', '#059669', '#e11d48'][i % 8],
    ]))
    const sourceTypeColor = sourceType ? typeColorMap.get(sourceType) ?? '#6b7280' : '#6b7280'
    const targetTypeColor = targetType ? typeColorMap.get(targetType) ?? '#6b7280' : '#6b7280'

    // Flights moving each direction
    const aToB = flights.filter(f => swapMode.sourceFlightIds.includes(f.id))
    const bToA = flights.filter(f => swapDialog.targetFlightIds.includes(f.id))

    // Format date range
    const sortedDates = [...sourceDates].sort()
    const dateRange = sortedDates.length === 1
      ? formatDate(sortedDates[0])
      : `${formatDate(sortedDates[0])} — ${formatDate(sortedDates[sortedDates.length - 1])} (${sortedDates.length} days)`

    // Boundary validation
    const warnings: ValidationWarning[] = []

    // AC type mismatch
    if (sourceType && targetType && sourceType !== targetType) {
      warnings.push({
        aircraft: '',
        type: 'type_mismatch',
        message: 'Aircraft type mismatch: Seat capacity, crew qualifications, payload limits, and performance data may differ.',
      })
    }

    // For each aircraft, check boundaries where swapped flights meet non-swapped flights
    const validateBoundaries = (reg: string, incomingFlights: typeof aToB) => {
      if (!reg) return
      // Get ALL flights on this aircraft (after swap)
      const allOnAc = flights.filter(f => {
        if (swapMode.sourceFlightIds.includes(f.id) || swapDialog!.targetFlightIds.includes(f.id)) return false
        return f.aircraftReg === reg
      })
      const combined = [...allOnAc, ...incomingFlights].sort((a, b) => a.stdUtc - b.stdUtc)

      for (let i = 0; i < combined.length - 1; i++) {
        const curr = combined[i]
        const next = combined[i + 1]
        const isSwapBoundary =
          incomingFlights.some(f => f.id === curr.id) !== incomingFlights.some(f => f.id === next.id)

        if (!isSwapBoundary) continue

        // Station mismatch
        if (curr.arrStation !== next.depStation) {
          warnings.push({
            aircraft: reg,
            type: 'station_mismatch',
            message: `${curr.flightNumber} arrives ${curr.arrStation} but ${next.flightNumber} departs ${next.depStation}`,
          })
        }

        // Time overlap
        if (next.stdUtc < curr.staUtc) {
          warnings.push({
            aircraft: reg,
            type: 'time_overlap',
            message: `${next.flightNumber} departs before ${curr.flightNumber} arrives`,
          })
        }

        // TAT violation
        const gapMin = (next.stdUtc - curr.staUtc) / 60_000
        const acType = aircraftTypes.find(t => t.icaoType === (next.aircraftTypeIcao ?? curr.aircraftTypeIcao))
        const minTat = acType?.tatDefaultMinutes ?? 30
        if (gapMin > 0 && gapMin < minTat) {
          warnings.push({
            aircraft: reg,
            type: 'tat_violation',
            message: `${Math.round(gapMin)}min gap between ${curr.flightNumber} and ${next.flightNumber} (min ${minTat}min)`,
          })
        }
      }
    }

    if (sourceReg) validateBoundaries(sourceReg, bToA)
    validateBoundaries(targetReg, aToB)

    return { sourceReg, targetReg, sourceType, targetType, sourceTypeColor, targetTypeColor, aToB, bToA, dateRange, warnings }
  }, [swapMode, swapDialog, flights, aircraft, aircraftTypes])

  if (!mounted || !swapDialog || !swapMode || !analysis) return null

  const bg = isDark ? 'rgba(24,24,27,0.95)' : 'rgba(255,255,255,0.97)'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const textColor = isDark ? '#fafafa' : '#18181b'
  const textMuted = isDark ? 'rgba(250,250,250,0.45)' : 'rgba(24,24,27,0.45)'
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'

  async function handleSwap() {
    setExecuting(true)
    try {
      await executeSwap()
    } catch (e) {
      console.error('Swap failed:', e)
    } finally {
      setExecuting(false)
    }
  }

  return createPortal(
    <div data-gantt-overlay className="fixed inset-0 z-[9998] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div
        ref={ref}
        className="rounded-2xl overflow-hidden"
        style={{
          width: 700, maxHeight: '80vh',
          background: bg, border: `1px solid ${border}`,
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.24)',
          animation: 'bc-dropdown-in 150ms ease-out',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${border}` }}>
          <ArrowLeftRight size={18} style={{ color: '#3E7BFA' }} />
          <span className="text-[15px] font-semibold flex-1" style={{ color: textColor }}>Swap Flights</span>
          <button onClick={() => { closeSwapDialog(); exitSwapMode() }}
            className="p-1 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5">
            <X size={16} style={{ color: textMuted }} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 130px)' }}>
          {/* Date range */}
          <div className="text-[12px] font-medium" style={{ color: textMuted }}>{analysis.dateRange}</div>

          {/* Direction A → B */}
          <SwapDirectionCard
            fromReg={analysis.sourceReg ?? 'Unassigned'}
            fromType={analysis.sourceType}
            fromTypeColor={analysis.sourceTypeColor}
            toReg={analysis.targetReg}
            toType={analysis.targetType}
            toTypeColor={analysis.targetTypeColor}
            flights={analysis.aToB}
            barLabelMode={barLabelMode}
            isDark={isDark}
            textColor={textColor}
            textMuted={textMuted}
            cardBg={cardBg}
            border={border}
          />

          {/* Direction B → A */}
          <SwapDirectionCard
            fromReg={analysis.targetReg}
            fromType={analysis.targetType}
            fromTypeColor={analysis.targetTypeColor}
            toReg={analysis.sourceReg ?? 'Unassigned'}
            toType={analysis.sourceType}
            toTypeColor={analysis.sourceTypeColor}
            flights={analysis.bToA}
            barLabelMode={barLabelMode}
            isDark={isDark}
            textColor={textColor}
            textMuted={textMuted}
            cardBg={cardBg}
            border={border}
          />

          {/* Warnings */}
          {analysis.warnings.length > 0 && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: isDark ? 'rgba(255,136,0,0.08)' : 'rgba(255,136,0,0.06)', border: '1px solid rgba(255,136,0,0.20)' }}>
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={14} style={{ color: '#FF8800' }} />
                <span className="text-[12px] font-semibold" style={{ color: '#FF8800' }}>
                  {analysis.warnings.length} warning{analysis.warnings.length > 1 ? 's' : ''}
                </span>
              </div>
              {analysis.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[12px] pl-5" style={{ color: isDark ? 'rgba(255,200,120,0.85)' : 'rgba(180,100,0,0.85)' }}>
                  {w.type === 'station_mismatch' && <Shuffle size={12} className="shrink-0 mt-0.5" />}
                  {w.type === 'time_overlap' && <Clock size={12} className="shrink-0 mt-0.5" />}
                  {w.type === 'tat_violation' && <Timer size={12} className="shrink-0 mt-0.5" />}
                  <span>{w.aircraft && <><span className="font-medium">{w.aircraft}</span>: </>}{w.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3" style={{ borderTop: `1px solid ${border}` }}>
          <button
            onClick={() => { closeSwapDialog(); exitSwapMode() }}
            className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors"
            style={{ color: textColor, border: `1px solid ${border}` }}
          >
            Cancel
          </button>
          <button
            onClick={handleSwap}
            disabled={executing}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-colors flex items-center gap-2"
            style={{ background: '#3E7BFA', opacity: executing ? 0.7 : 1 }}
          >
            {executing && <Loader2 size={14} className="animate-spin" />}
            {analysis.warnings.length > 0 ? 'Swap Anyway' : 'Swap'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function AcPill({ reg, type, typeColor, isDark, textColor, border }: {
  reg: string; type: string | null; typeColor: string; isDark: boolean; textColor: string; border: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full"
      style={{ border: `1.5px solid ${border}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }}>
      <span className="text-[12px] font-bold" style={{ color: textColor }}>{reg}</span>
      {type && (
        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
          style={{ background: typeColor, lineHeight: 1 }}>
          {type}
        </span>
      )}
    </span>
  )
}

function SwapDirectionCard({ fromReg, fromType, fromTypeColor, toReg, toType, toTypeColor, flights, barLabelMode, isDark, textColor, textMuted, cardBg, border }: {
  fromReg: string; fromType: string | null; fromTypeColor: string
  toReg: string; toType: string | null; toTypeColor: string
  flights: { id: string; flightNumber: string; depStation: string; arrStation: string; blockMinutes: number }[]
  barLabelMode: string
  isDark: boolean; textColor: string; textMuted: string; cardBg: string; border: string
}) {
  const totalBlock = flights.reduce((sum, f) => sum + (f.blockMinutes ?? 0), 0)
  const blockH = String(Math.floor(totalBlock / 60)).padStart(2, '0')
  const blockM = String(totalBlock % 60).padStart(2, '0')

  return (
    <div className="rounded-xl p-3 space-y-3" style={{ background: cardBg, border: `1px solid ${border}` }}>
      {/* Direction: pill → arrow → pill + stats */}
      <div className="flex items-center gap-2">
        <AcPill reg={fromReg} type={fromType} typeColor={fromTypeColor} isDark={isDark} textColor={textColor} border={border} />
        <span className="text-[13px]" style={{ color: textMuted }}>→</span>
        <AcPill reg={toReg} type={toType} typeColor={toTypeColor} isDark={isDark} textColor={textColor} border={border} />
        <div className="flex-1" />
        <div className="flex items-center gap-2.5 text-[11px] shrink-0" style={{ color: textMuted }}>
          <span><span className="font-semibold" style={{ color: textColor }}>{flights.length}</span> flt{flights.length !== 1 ? 's' : ''}</span>
          <span style={{ opacity: 0.3 }}>·</span>
          <span className="font-[Inter]"><span className="font-semibold" style={{ color: textColor }}>{blockH}:{blockM}</span></span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {flights.length === 0
          ? <span className="text-[12px] italic" style={{ color: textMuted }}>No flights</span>
          : flights.map(f => {
            const label = barLabelMode === 'sector'
              ? `${f.depStation}-${f.arrStation}`
              : f.flightNumber
            return (
              <span key={f.id} className="px-2 py-1 rounded-md text-[11px] font-medium text-white"
                style={{ background: '#3E7BFA' }}>
                {label}
              </span>
            )
          })
        }
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z')
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[d.getUTCDay()]} ${d.getUTCDate().toString().padStart(2, '0')} ${months[d.getUTCMonth()]}`
}
