'use client'

import { createPortal } from 'react-dom'
import { Plane } from 'lucide-react'
import type { WorldMapFlight, WorldMapAirport } from './world-map-types'
import { getFlightMapStatus } from './world-map-types'

interface FlightTooltipProps {
  flight: WorldMapFlight
  x: number
  y: number
  progress: number
}

interface AirportTooltipProps {
  airport: WorldMapAirport
  x: number
  y: number
  depCount: number
  arrCount: number
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  airborne: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Airborne' },
  ground: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'On Ground' },
  completed: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Completed' },
  scheduled: { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'Scheduled' },
}

export function FlightTooltip({ flight, x, y, progress }: FlightTooltipProps) {
  const status = getFlightMapStatus(flight)
  const badge = STATUS_BADGE[status] || STATUS_BADGE.scheduled

  // Clamp position
  const left = Math.min(x + 12, window.innerWidth - 280)
  const top = Math.min(y - 10, window.innerHeight - 200)

  const content = (
    <div className="fixed z-[100] pointer-events-none animate-fade-in" style={{ left, top }}>
      <div
        className="w-[260px] rounded-xl shadow-xl overflow-hidden"
        style={{
          background: 'rgba(24,24,27,0.92)',
          backdropFilter: 'blur(20px) saturate(1.6)',
        }}
      >
        <div className="px-4 pt-3 pb-2">
          {/* Header: flight number + status */}
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[15px] font-bold text-[#fafafa]">{flight.flightNumber}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
          </div>

          {/* Route with animated progress */}
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-[14px] font-semibold text-[#fafafa]">{flight.depStation}</span>
            <div className="flex-1 relative h-4 flex items-center">
              {/* Track line (full, dim) */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-[rgba(250,250,250,0.1)] rounded-full" />
              {/* Glowing progress line (dep → current position) */}
              {status === 'airborne' && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] rounded-full"
                  style={{
                    width: `${progress * 100}%`,
                    background: 'linear-gradient(90deg, rgba(245,200,66,0.15), #f5c842)',
                    boxShadow: '0 0 6px rgba(245,200,66,0.4)',
                  }}
                />
              )}
              {/* Aircraft icon at progress point */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                style={{ left: `${(status === 'airborne' ? progress : 0) * 100}%` }}
              >
                <Plane className="h-[18px] w-[18px] rotate-45 fill-[#fafafa] text-[#fafafa]" strokeWidth={0} />
              </div>
            </div>
            <span className="font-mono text-[14px] font-semibold text-[#fafafa]">{flight.arrStation}</span>
          </div>

          {/* Details */}
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-[rgba(250,250,250,0.45)]">
              {flight.aircraftTypeIcao || '—'}
              {flight.tailNumber ? ` · ${flight.tailNumber}` : ''}
            </span>
            <span className="text-[rgba(250,250,250,0.45)]">
              {Math.floor(flight.blockMinutes / 60)}h{String(flight.blockMinutes % 60).padStart(2, '0')}m
            </span>
          </div>

          {/* Times — show most relevant (ATD/ATA > STD/STA) */}
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-[rgba(250,250,250,0.55)]">
              {flight.actualOut || flight.actualOff ? (
                <>
                  <span className="text-[rgba(250,250,250,0.75)]">ATD</span> {flight.actualOut || flight.actualOff}z
                </>
              ) : (
                <>STD {flight.stdUtc}z</>
              )}
            </span>
            <span className="text-[rgba(250,250,250,0.55)]">
              {flight.actualIn || flight.actualOn ? (
                <>
                  <span className="text-[rgba(250,250,250,0.75)]">ATA</span> {flight.actualIn || flight.actualOn}z
                </>
              ) : (
                <>STA {flight.staUtc}z</>
              )}
            </span>
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-[rgba(250,250,250,0.10)]">
          <span className="text-[10px] text-[rgba(250,250,250,0.50)] font-medium uppercase tracking-widest">
            Show flight information
          </span>
        </div>
      </div>
    </div>
  )

  if (typeof window === 'undefined') return null
  return createPortal(content, document.body)
}

export function AirportTooltip({ airport, x, y, depCount, arrCount }: AirportTooltipProps) {
  const left = Math.min(x + 12, window.innerWidth - 200)
  const top = Math.min(y - 10, window.innerHeight - 100)

  const content = (
    <div className="fixed z-[100] pointer-events-none animate-fade-in" style={{ left, top }}>
      <div
        className="rounded-xl shadow-xl px-4 py-3 min-w-[160px]"
        style={{
          background: 'rgba(24,24,27,0.92)',
          backdropFilter: 'blur(20px) saturate(1.6)',
        }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-mono text-[15px] font-bold text-[#fafafa]">{airport.iataCode}</span>
          {airport.isHub && (
            <span className="text-[9px] font-bold bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">HUB</span>
          )}
        </div>
        <div className="text-[11px] text-[rgba(250,250,250,0.55)] mb-2 leading-tight">{airport.name}</div>
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <span className="text-[rgba(250,250,250,0.45)]">{depCount} dep</span>
          <span className="text-[rgba(250,250,250,0.45)]">{arrCount} arr</span>
        </div>
      </div>
    </div>
  )

  if (typeof window === 'undefined') return null
  return createPortal(content, document.body)
}
