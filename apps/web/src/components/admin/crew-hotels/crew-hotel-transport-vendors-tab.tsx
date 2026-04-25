'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bus, ChevronRight, Plus } from 'lucide-react'
import { api, type AirportRef, type CrewHotelRef, type CrewTransportVendorRef } from '@skyhub/api'
import { CrewTransportVendorDetail } from '../crew-transport-vendors/crew-transport-vendor-detail'
import { CrewTransportVendorCreatePanel } from '../crew-transport-vendors/crew-transport-vendor-create-panel'

interface Props {
  hotel: CrewHotelRef
  airports: AirportRef[]
}

/**
 * Per-airport transport vendor management embedded inside the hotel detail.
 * Vendors live at airport granularity, so a hotel's airport implicitly scopes
 * the list. Creating a vendor from this tab is locked to the hotel's airport.
 *
 * Master-detail layout inside the tab: vendor list (260px) on the left,
 * full vendor detail on the right — same component used by the legacy
 * top-level segment-toggle shell.
 */
export function CrewHotelTransportVendorsTab({ hotel, airports }: Props) {
  const [vendors, setVendors] = useState<CrewTransportVendorRef[]>([])
  const [selected, setSelected] = useState<CrewTransportVendorRef | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchVendors = useCallback(() => {
    setLoading(true)
    api
      .getCrewTransportVendors({ airportIcao: hotel.airportIcao })
      .then((data) => {
        setVendors(data)
        setSelected((prev) => {
          if (prev) {
            const found = data.find((v) => v._id === prev._id)
            if (found) return found
          }
          return data[0] ?? null
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [hotel.airportIcao])

  useEffect(() => {
    fetchVendors()
  }, [fetchVendors])

  const handleSave = useCallback(
    async (id: string, data: Partial<CrewTransportVendorRef>) => {
      await api.updateCrewTransportVendor(id, data)
      fetchVendors()
    },
    [fetchVendors],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await api.deleteCrewTransportVendor(id)
      setSelected(null)
      fetchVendors()
    },
    [fetchVendors],
  )

  const handleCreate = useCallback(
    async (data: Partial<CrewTransportVendorRef>) => {
      // Force the airport — even if the locked dropdown is somehow bypassed.
      const created = await api.createCrewTransportVendor({
        ...data,
        baseAirportIcao: hotel.airportIcao,
      })
      fetchVendors()
      setShowCreate(false)
      setTimeout(() => setSelected(created), 150)
    },
    [fetchVendors, hotel.airportIcao],
  )

  const airport = airports.find((a) => a.icaoCode === hotel.airportIcao)
  const airportLabel = airport?.iataCode ?? hotel.airportIcao

  const sorted = vendors.slice().sort((a, b) => a.priority - b.priority || a.vendorName.localeCompare(b.vendorName))

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left — vendor list at this airport */}
      <aside className="w-[260px] shrink-0 border-r border-hz-border flex flex-col">
        <div className="px-4 py-3 border-b border-hz-border flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-hz-text">{airportLabel}</div>
            <div className="text-[13px] text-hz-text-secondary">
              {vendors.length} vendor{vendors.length === 1 ? '' : 's'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowCreate(true)
              setSelected(null)
            }}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-module-accent text-white text-[13px] font-semibold hover:opacity-90"
          >
            <Plus className="h-3 w-3" />
            New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-[13px] text-hz-text-secondary">Loading…</div>
          ) : sorted.length === 0 ? (
            <div className="p-6 text-center text-[13px] text-hz-text-secondary">
              No vendors at {airportLabel}.
              <br />
              Click <span className="font-semibold text-hz-text">New</span> to add one.
            </div>
          ) : (
            sorted.map((v) => {
              const active = selected?._id === v._id && !showCreate
              return (
                <button
                  key={v._id}
                  type="button"
                  onClick={() => {
                    setShowCreate(false)
                    setSelected(v)
                  }}
                  className={`w-full text-left flex items-center gap-2 px-4 py-3 border-b border-hz-border/40 transition-colors ${
                    active ? 'bg-module-accent/[0.08]' : 'hover:bg-hz-border/20'
                  }`}
                >
                  <div className="h-8 w-8 rounded-lg bg-module-accent/10 text-module-accent flex items-center justify-center shrink-0">
                    <Bus className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-hz-text truncate">{v.vendorName}</div>
                    <div className="text-[13px] text-hz-text-secondary">
                      P{v.priority}
                      {v.isActive ? '' : ' · inactive'}
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-hz-text-tertiary shrink-0" />
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* Right — vendor detail or create panel */}
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {showCreate ? (
          <CrewTransportVendorCreatePanel
            airports={airports}
            onCreate={handleCreate}
            onCancel={() => setShowCreate(false)}
            lockedAirportIcao={hotel.airportIcao}
          />
        ) : selected ? (
          <CrewTransportVendorDetail
            vendor={selected}
            airports={airports}
            onSave={handleSave}
            onDelete={handleDelete}
            onRefresh={fetchVendors}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-[13px] text-hz-text-secondary px-12 text-center">
            Select a vendor on the left, or click <span className="font-semibold mx-1 text-hz-text">New</span> to add
            one for {airportLabel}.
          </div>
        )}
      </div>
    </div>
  )
}
