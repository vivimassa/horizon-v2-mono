'use client'

import { useState } from 'react'
import type { CrewTransportVendorRef, AirportRef } from '@skyhub/api'
import { Bus, X } from 'lucide-react'

interface Props {
  airports: AirportRef[]
  onCreate: (data: Partial<CrewTransportVendorRef>) => Promise<void>
  onCancel: () => void
}

export function CrewTransportVendorCreatePanel({ airports, onCreate, onCancel }: Props) {
  const [icao, setIcao] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [priority, setPriority] = useState('1')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async () => {
    if (!icao || !vendorName) {
      setErr('Airport and vendor name required')
      return
    }
    setBusy(true)
    setErr('')
    try {
      await onCreate({
        baseAirportIcao: icao.toUpperCase(),
        vendorName: vendorName.trim(),
        priority: Number(priority) || 1,
        isActive: true,
      } as Partial<CrewTransportVendorRef>)
    } catch (e) {
      setErr((e as Error).message ?? 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-hz-border">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-module-accent/10">
            <Bus className="h-[18px] w-[18px] text-module-accent" />
          </div>
          <div>
            <div className="text-[15px] font-bold">Add New Vendor</div>
            <div className="text-[13px] text-hz-text-secondary">Pick base airport and enter vendor name to begin</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-hz-text-secondary hover:bg-hz-border/30"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 max-w-2xl">
        <div>
          <label className="text-[13px] text-hz-text-secondary uppercase tracking-wider font-medium">
            Base Airport *
          </label>
          <select
            value={icao}
            onChange={(e) => setIcao(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-card text-hz-text focus:ring-2 focus:ring-module-accent/30 outline-none"
          >
            <option value="">Select airport…</option>
            {airports.map((a) => (
              <option key={a._id} value={a.icaoCode ?? ''}>
                {a.icaoCode} {a.iataCode ? `(${a.iataCode})` : ''} — {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[13px] text-hz-text-secondary uppercase tracking-wider font-medium">
            Vendor Name *
          </label>
          <input
            type="text"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            placeholder="e.g. SGN AIRPORT TRANSPORT CO"
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
          <div className="text-[13px] text-hz-text-secondary mt-1">1 = first choice for trip auto-assignment</div>
        </div>

        {err && <div className="text-[13px] text-red-500">{err}</div>}

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create Vendor'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30"
          >
            Cancel
          </button>
        </div>

        <div className="text-[13px] text-hz-text-secondary pt-4 border-t border-hz-border">
          After creation, edit the vendor to fill address, contacts, contracts (with vehicle tiers), and the driver
          roster.
        </div>
      </div>
    </div>
  )
}
