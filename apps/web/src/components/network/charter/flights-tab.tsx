'use client'

import { useState, useCallback } from 'react'
import { Plus, Wand2, Trash2, Loader2 } from 'lucide-react'
import type { CharterContractRef } from '@skyhub/api'
import { api } from '@skyhub/api'
import { useCharterStore } from '@/stores/use-charter-store'
import { useOperatorStore, getOperatorId } from '@/stores/use-operator-store'
import { getLegTypeStyle } from './charter-types'
import type { FlightLegType } from './charter-types'

interface FlightsTabProps {
  contract: CharterContractRef
  onAddFlight: () => void
  onFlightChanged: () => void
  isDark: boolean
}

function fmtBlockTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`
}

export function FlightsTab({ contract, onAddFlight, onFlightChanged, isDark }: FlightsTabProps) {
  const flights = useCharterStore(s => s.flights)
  const stats = useCharterStore(s => s.stats)
  const operator = useOperatorStore(s => s.operator)
  const [positioning, setPositioning] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleAutoPosition = useCallback(async () => {
    setPositioning(true)
    try {
      const operatorCode = operator?.code ?? 'VJ'
      const homeBase = 'SGN'
      const { legs } = await api.generateCharterPositioning(contract._id, operatorCode, homeBase)
      const opId = getOperatorId()

      for (const leg of legs) {
        const nextNum = await api.getNextCharterFlightNumber()
        await api.createCharterFlight({
          operatorId: opId,
          contractId: contract._id,
          operatorCode,
          flightNumber: nextNum.flightNumber,
          flightDate: leg.date,
          departureIata: leg.from,
          arrivalIata: leg.to,
          stdUtc: '00:00',
          staUtc: '00:00',
          blockMinutes: 120,
          arrivalDayOffset: 0,
          legType: 'positioning',
          paxBooked: 0,
          cargoKg: 0,
          status: 'planned',
        })
      }
      onFlightChanged()
    } finally {
      setPositioning(false)
    }
  }, [contract._id, operator, onFlightChanged])

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(id)
    try {
      await api.deleteCharterFlight(id)
      onFlightChanged()
    } finally {
      setDeleting(null)
    }
  }, [onFlightChanged])

  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
  const headerColor = isDark ? '#8F90A6' : '#555770'

  return (
    <div className="p-5 space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Total flights" value={stats.totalFlights} isDark={isDark} />
        <KpiCard label="Revenue" value={stats.revenueFlights} color={isDark ? '#39D98A' : '#06C270'} isDark={isDark} />
        <KpiCard label="Positioning" value={stats.positioningFlights} color={isDark ? '#FDAC42' : '#E67A00'} isDark={isDark} />
        <KpiCard label="Block time" value={fmtBlockTime(stats.totalBlockMinutes)} isDark={isDark} />
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onAddFlight}
            className="h-8 px-3 flex items-center gap-2 rounded-lg text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 transition-opacity">
            <Plus size={14} />
            Add flight
          </button>
          <button onClick={handleAutoPosition} disabled={positioning}
            className="h-8 px-3 flex items-center gap-2 rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: `1px solid ${cardBorder}` }}>
            {positioning ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            Auto-position
          </button>
        </div>
        <span className="text-[13px] text-hz-text-tertiary">{flights.length} flights</span>
      </div>

      {/* Flight table */}
      {flights.length === 0 ? (
        <div className="text-center py-12 text-[14px] text-hz-text-tertiary">
          No flights yet. Add a flight to get started.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${cardBorder}` }}>
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: `1px solid ${cardBorder}` }}>
                {['Date', 'Flight', 'Type', 'Route', 'STD', 'STA', 'Block', 'AC', 'Tail', 'Pax', 'Status', ''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-[13px] font-medium uppercase whitespace-nowrap" style={{ color: headerColor }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flights.map((f, i) => {
                const legStyle = getLegTypeStyle(f.legType as FlightLegType, isDark)
                const isPos = f.legType === 'positioning'
                const rowBg = i % 2 === 1 ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)') : 'transparent'

                return (
                  <tr key={f._id}
                    className="group hover:bg-hz-border/10 transition-colors"
                    style={{
                      background: rowBg,
                      borderLeft: isPos ? `3px solid ${isDark ? '#FDAC42' : '#E67A00'}` : '3px solid transparent',
                    }}>
                    <td className="px-3 py-2 text-[13px] font-mono whitespace-nowrap">{fmtDate(f.flightDate)}</td>
                    <td className="px-3 py-2 text-[13px] font-mono font-bold whitespace-nowrap">{(operator?.code ?? '') + f.flightNumber}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded-md text-[13px] font-semibold capitalize"
                        style={{ background: legStyle.background, color: legStyle.color, border: `1px solid ${legStyle.borderColor}` }}>
                        {f.legType}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[13px] font-mono whitespace-nowrap">{f.departureIata} &rarr; {f.arrivalIata}</td>
                    <td className="px-3 py-2 text-[13px] font-mono">{f.stdUtc}</td>
                    <td className="px-3 py-2 text-[13px] font-mono">{f.staUtc}</td>
                    <td className="px-3 py-2 text-[13px] font-mono">{fmtBlockTime(f.blockMinutes)}</td>
                    <td className="px-3 py-2 text-[13px] font-mono text-hz-text-tertiary">{f.aircraftTypeIcao ?? '\u2014'}</td>
                    <td className="px-3 py-2 text-[13px] font-mono text-hz-text-tertiary">{f.aircraftRegistration ?? '\u2014'}</td>
                    <td className="px-3 py-2 text-[13px] font-mono">{f.legType === 'revenue' ? f.paxBooked : '\u2014'}</td>
                    <td className="px-3 py-2 text-[13px] capitalize text-hz-text-secondary">{f.status}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => handleDelete(f._id)} disabled={deleting === f._id}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-500/10 transition-all"
                        style={{ color: isDark ? '#FF5C5C' : '#E63535' }}>
                        {deleting === f._id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, color, isDark }: { label: string; value: string | number; color?: string; isDark: boolean }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{
      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
    }}>
      <div className="text-[18px] font-bold font-mono" style={{ color: color || (isDark ? '#F5F2FD' : '#1C1C28') }}>{value}</div>
      <div className="text-[13px] text-hz-text-tertiary mt-0.5">{label}</div>
    </div>
  )
}
