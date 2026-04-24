'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { api, type CrewHotelRef, type AirportRef } from '@skyhub/api'
import { MasterDetailLayout } from '@/components/layout'
import { CrewHotelList } from './crew-hotel-list'
import { CrewHotelDetail } from './crew-hotel-detail'
import { CrewHotelCreatePanel } from './crew-hotel-create-panel'

export function CrewHotelsShell() {
  const [hotels, setHotels] = useState<CrewHotelRef[]>([])
  const [airports, setAirports] = useState<AirportRef[]>([])
  const [selected, setSelected] = useState<CrewHotelRef | null>(null)
  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState(true)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const fetchHotels = useCallback(() => {
    setLoading(true)
    api
      .getCrewHotels()
      .then((data) => {
        setHotels(data)
        setSelected((prev: CrewHotelRef | null) => {
          if (prev) {
            const found = data.find((h) => h._id === prev._id)
            if (found) return found
          }
          return data.length > 0 ? data[0] : null
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchHotels()
    api.getAirports().then(setAirports).catch(console.error)
  }, [fetchHotels])

  const handleSave = useCallback(
    async (id: string, data: Partial<CrewHotelRef>) => {
      await api.updateCrewHotel(id, data)
      fetchHotels()
    },
    [fetchHotels],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await api.deleteCrewHotel(id)
      setSelected(null)
      fetchHotels()
    },
    [fetchHotels],
  )

  const handleCreate = useCallback(
    async (data: Partial<CrewHotelRef>) => {
      const created = await api.createCrewHotel(data)
      fetchHotels()
      setShowCreate(false)
      setTimeout(() => setSelected(created), 300)
    },
    [fetchHotels],
  )

  const { filtered, groups } = useMemo(() => {
    const q = search.toLowerCase().trim()
    let filtered = hotels
    if (activeOnly) filtered = filtered.filter((h) => h.isActive)
    if (q) {
      filtered = filtered.filter(
        (h) =>
          h.hotelName.toLowerCase().includes(q) ||
          h.airportIcao.toLowerCase().includes(q) ||
          (h.addressLine1?.toLowerCase().includes(q) ?? false),
      )
    }

    const map = new Map<string, CrewHotelRef[]>()
    for (const h of filtered) {
      const arr = map.get(h.airportIcao)
      if (arr) arr.push(h)
      else map.set(h.airportIcao, [h])
    }

    const groups = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
    for (const [, arr] of groups) {
      arr.sort((a, b) => a.priority - b.priority || a.hotelName.localeCompare(b.hotelName))
    }
    return { filtered, groups }
  }, [hotels, search, activeOnly])

  return (
    <MasterDetailLayout
      left={
        <CrewHotelList
          groups={groups}
          airports={airports}
          totalCount={hotels.length}
          filteredCount={filtered.length}
          selected={selected}
          onSelect={setSelected}
          search={search}
          onSearchChange={setSearch}
          activeOnly={activeOnly}
          onActiveOnlyChange={setActiveOnly}
          loading={loading}
          onRefresh={fetchHotels}
          onAdd={() => setShowCreate(true)}
        />
      }
      center={
        showCreate ? (
          <CrewHotelCreatePanel airports={airports} onCreate={handleCreate} onCancel={() => setShowCreate(false)} />
        ) : selected ? (
          <CrewHotelDetail
            hotel={selected}
            airports={airports}
            onSave={handleSave}
            onDelete={handleDelete}
            onCreate={handleCreate}
            onRefresh={fetchHotels}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col gap-4 p-8">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-module-accent/10">
              <span className="text-module-accent text-[13px] font-bold">5.4.10</span>
            </div>
            <div className="text-center">
              <div className="text-[15px] font-semibold">Crew Hotels</div>
              <div className="text-[13px] text-hz-text-secondary mt-1">
                Select a hotel from the list or add your first one
              </div>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-module-accent text-white text-[13px] font-semibold hover:opacity-90"
            >
              + Add Hotel
            </button>
          </div>
        )
      }
    />
  )
}
