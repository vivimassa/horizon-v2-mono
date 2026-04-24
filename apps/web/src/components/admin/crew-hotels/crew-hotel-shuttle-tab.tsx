'use client'

import { useState } from 'react'
import type { CrewHotelRef, HotelShuttle } from '@skyhub/api'
import { api } from '@skyhub/api'
import { Plus, Trash2 } from 'lucide-react'

interface Props {
  hotel: CrewHotelRef
  onRefresh?: () => void
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function CrewHotelShuttleTab({ hotel, onRefresh }: Props) {
  const [busy, setBusy] = useState(false)

  const handleAdd = async () => {
    setBusy(true)
    try {
      await api.addHotelShuttle(hotel._id, {
        weekdayMask: [false, false, false, false, false, false, false],
      })
      onRefresh?.()
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (sId: string) => {
    setBusy(true)
    try {
      await api.deleteHotelShuttle(hotel._id, sId)
      onRefresh?.()
    } finally {
      setBusy(false)
    }
  }

  const fmtDate = (ms: number | null) => (ms ? new Date(ms).toISOString().slice(0, 10) : '—')

  return (
    <div className="px-6 pt-3 pb-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="text-[13px] font-medium uppercase tracking-wider text-hz-text-secondary flex items-center gap-2">
          <span className="inline-block w-[3px] h-3.5 bg-module-accent rounded-sm" />
          Shuttle Bus Schedule
        </div>
        <div className="flex-1" />
        <button
          onClick={handleAdd}
          disabled={busy}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-module-accent text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          Add Window
        </button>
      </div>

      <div className="border border-hz-border rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-hz-card text-hz-text-secondary uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 text-left font-medium">From Date</th>
              <th className="px-3 py-2 text-left font-medium">To Date</th>
              <th className="px-3 py-2 text-left font-medium">From Time</th>
              <th className="px-3 py-2 text-left font-medium">To Time</th>
              <th className="px-3 py-2 text-center font-medium">Weekdays</th>
              <th className="px-3 py-2 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {hotel.shuttles?.length ? (
              hotel.shuttles.map((s: HotelShuttle) => (
                <tr key={s._id} className="border-t border-hz-border hover:bg-hz-border/20">
                  <td className="px-3 py-2">{fmtDate(s.fromDateUtcMs)}</td>
                  <td className="px-3 py-2">{fmtDate(s.toDateUtcMs)}</td>
                  <td className="px-3 py-2">{s.fromTimeLocal ?? '—'}</td>
                  <td className="px-3 py-2">{s.toTimeLocal ?? '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      {WEEKDAYS.map((d, idx) => (
                        <span
                          key={idx}
                          className={`w-4 h-4 rounded-sm flex items-center justify-center text-[10px] ${
                            s.weekdayMask?.[idx]
                              ? 'bg-module-accent text-white'
                              : 'bg-hz-border/40 text-hz-text-secondary'
                          }`}
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleDelete(s._id)}
                      className="text-red-500 hover:text-red-700"
                      disabled={busy}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-hz-text-secondary">
                  No shuttle windows configured
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
