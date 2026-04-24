'use client'

import { useState } from 'react'
import type { CrewHotelRef, HotelContract } from '@skyhub/api'
import { api } from '@skyhub/api'
import { Plus, Trash2 } from 'lucide-react'

interface Props {
  hotel: CrewHotelRef
  onRefresh?: () => void
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function CrewHotelContractsTab({ hotel, onRefresh }: Props) {
  const [selected, setSelected] = useState<HotelContract | null>(hotel.contracts?.[0] ?? null)
  const [busy, setBusy] = useState(false)

  const handleAdd = async () => {
    setBusy(true)
    try {
      await api.addHotelContract(hotel._id, {
        priority: (hotel.contracts?.length ?? 0) + 1,
        weekdayMask: [true, true, true, true, true, true, true],
      })
      onRefresh?.()
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (cId: string) => {
    setBusy(true)
    try {
      await api.deleteHotelContract(hotel._id, cId)
      if (selected?._id === cId) setSelected(null)
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
          Contracts
        </div>
        <div className="flex-1" />
        <button
          onClick={handleAdd}
          disabled={busy}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-module-accent text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          Add Contract
        </button>
      </div>

      <div className="border border-hz-border rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-hz-card text-hz-text-secondary uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Idx</th>
              <th className="px-3 py-2 text-left font-medium">Priority</th>
              <th className="px-3 py-2 text-left font-medium">Start Date</th>
              <th className="px-3 py-2 text-left font-medium">End Date</th>
              <th className="px-3 py-2 text-center font-medium">Weekdays</th>
              <th className="px-3 py-2 text-left font-medium">Check-In</th>
              <th className="px-3 py-2 text-left font-medium">Check-Out</th>
              <th className="px-3 py-2 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {hotel.contracts?.length ? (
              hotel.contracts.map((c: HotelContract, i: number) => {
                const isSelected = selected?._id === c._id
                return (
                  <tr
                    key={c._id}
                    onClick={() => setSelected(c)}
                    className={`cursor-pointer border-t border-hz-border ${
                      isSelected ? 'bg-module-accent/[0.08]' : 'hover:bg-hz-border/20'
                    }`}
                  >
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2">{c.priority}</td>
                    <td className="px-3 py-2">{fmtDate(c.startDateUtcMs)}</td>
                    <td className="px-3 py-2">{fmtDate(c.endDateUtcMs)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        {WEEKDAYS.map((d, idx) => (
                          <span
                            key={idx}
                            className={`w-4 h-4 rounded-sm flex items-center justify-center text-[10px] ${
                              c.weekdayMask?.[idx]
                                ? 'bg-module-accent text-white'
                                : 'bg-hz-border/40 text-hz-text-secondary'
                            }`}
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2">{c.checkInLocal ?? '—'}</td>
                    <td className="px-3 py-2">{c.checkOutLocal ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(c._id)
                        }}
                        className="text-red-500 hover:text-red-700"
                        disabled={busy}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-hz-text-secondary">
                  No contracts yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          <div>
            <div className="text-[13px] font-medium uppercase tracking-wider text-hz-text-secondary mb-3 flex items-center gap-2">
              <span className="inline-block w-[3px] h-3.5 bg-module-accent rounded-sm" />
              Contract Details
            </div>
            <div className="space-y-2 text-[13px]">
              <KV k="Contract No" v={selected.contractNo ?? '—'} />
              <KV k="Contract Rate" v={`${selected.contractRate ?? 0} ${selected.currency}`} />
            </div>
          </div>
          <div>
            <div className="text-[13px] font-medium uppercase tracking-wider text-hz-text-secondary mb-3 flex items-center gap-2">
              <span className="inline-block w-[3px] h-3.5 bg-module-accent rounded-sm" />
              Room Utilization
            </div>
            <div className="space-y-2 text-[13px]">
              <KV k="Rooms Per Night" v={String(selected.roomsPerNight ?? 0)} />
              <KV k="Release Time" v={selected.releaseTime ?? '00:00'} />
              <KV k="Room Rate" v={String(selected.roomRate ?? 0)} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-hz-text-secondary w-40 shrink-0">{k}</span>
      <span className="text-hz-text">{v}</span>
    </div>
  )
}
