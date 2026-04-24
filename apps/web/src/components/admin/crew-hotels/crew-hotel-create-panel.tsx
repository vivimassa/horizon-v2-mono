'use client'

import { useState } from 'react'
import type { CrewHotelRef, AirportRef } from '@skyhub/api'
import { BedDouble, X } from 'lucide-react'
import { HelpButton } from '@/components/help'

interface Props {
  airports: AirportRef[]
  onCreate: (data: Partial<CrewHotelRef>) => Promise<void>
  onCancel: () => void
}

export function CrewHotelCreatePanel({ airports, onCreate, onCancel }: Props) {
  const [icao, setIcao] = useState('')
  const [hotelName, setHotelName] = useState('')
  const [priority, setPriority] = useState('1')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async () => {
    if (!icao || !hotelName) {
      setErr('Airport and hotel name required')
      return
    }
    setBusy(true)
    setErr('')
    try {
      await onCreate({
        airportIcao: icao.toUpperCase(),
        hotelName: hotelName.trim(),
        priority: Number(priority) || 1,
        isActive: true,
      } as Partial<CrewHotelRef>)
    } catch (e: any) {
      setErr(e.message || 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-hz-border">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-module-accent/10">
            <BedDouble className="h-[18px] w-[18px] text-module-accent" />
          </div>
          <div>
            <div className="text-[15px] font-bold">Add New Hotel</div>
            <div className="text-[13px] text-hz-text-secondary">
              5.4.10 · Pick airport and enter hotel name to begin
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <HelpButton
            code="5.4.10"
            title="Crew Hotels"
            subtitle="Layover hotels per airport — contracts, rates, shuttle bus"
          />
          <button
            onClick={onCancel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-hz-text-secondary hover:bg-hz-border/30"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 max-w-2xl">
        <div>
          <label className="text-[13px] text-hz-text-secondary uppercase tracking-wider font-medium">Airport *</label>
          <select
            value={icao}
            onChange={(e) => setIcao(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-card text-hz-text focus:ring-2 focus:ring-module-accent/30 outline-none"
          >
            <option value="">Select airport…</option>
            {airports.map((a) => (
              <option key={a._id} value={a.icaoCode}>
                {a.icaoCode} {a.iataCode ? `(${a.iataCode})` : ''} — {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[13px] text-hz-text-secondary uppercase tracking-wider font-medium">
            Hotel Name *
          </label>
          <input
            type="text"
            value={hotelName}
            onChange={(e) => setHotelName(e.target.value)}
            placeholder="e.g. PREMIER INN OP CREW"
            className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-card outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text"
          />
        </div>

        <div>
          <label className="text-[13px] text-hz-text-secondary uppercase tracking-wider font-medium">Priority</label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            min={1}
            className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-card outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text"
          />
          <div className="text-[13px] text-hz-text-secondary mt-1">1 = first choice for layover pick</div>
        </div>

        {err && <div className="text-[13px] text-red-500">{err}</div>}

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create Hotel'}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30"
          >
            Cancel
          </button>
        </div>

        <div className="text-[13px] text-hz-text-secondary pt-4 border-t border-hz-border">
          After creation, edit the hotel to fill address, coordinates, contracts, and shuttle schedules — or use Bulk
          upload to import many hotels at once.
        </div>
      </div>
    </div>
  )
}
