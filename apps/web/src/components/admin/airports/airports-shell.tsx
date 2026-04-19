'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { api, type AirportRef } from '@skyhub/api'
import { MasterDetailLayout } from '@/components/layout'
import { AirportList } from './airport-list'
import { AirportDetail } from './airport-detail'

export function AirportsShell() {
  const [airports, setAirports] = useState<AirportRef[]>([])
  const [selected, setSelected] = useState<AirportRef | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchAirports = useCallback(() => {
    setLoading(true)
    api
      .getAirports()
      .then((data) => {
        setAirports(data)
        // Reselect current airport if still exists, else pick first
        setSelected((prev) => {
          if (prev) {
            const found = data.find((a) => a._id === prev._id)
            if (found) return found
          }
          return data.length > 0 ? data[0] : null
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchAirports()
  }, [fetchAirports])

  const handleSave = useCallback(
    async (id: string, data: Partial<AirportRef>) => {
      await api.updateAirport(id, data)
      fetchAirports()
    },
    [fetchAirports],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await api.deleteAirport(id)
      setSelected(null)
      fetchAirports()
    },
    [fetchAirports],
  )

  const handleCreate = useCallback(
    async (data: Partial<AirportRef>) => {
      const created = await api.createAirport(data)
      fetchAirports()
      // Select the new airport after list refreshes
      setTimeout(() => setSelected(created), 300)
    },
    [fetchAirports],
  )

  // Group airports by country
  const { filtered, groups } = useMemo(() => {
    const q = search.toLowerCase().trim()
    const filtered = q
      ? airports.filter(
          (a) =>
            a.icaoCode.toLowerCase().includes(q) ||
            (a.iataCode?.toLowerCase().includes(q) ?? false) ||
            a.name.toLowerCase().includes(q) ||
            (a.city?.toLowerCase().includes(q) ?? false),
        )
      : airports

    const map = new Map<string, AirportRef[]>()
    for (const a of filtered) {
      const key = a.countryName ?? a.country ?? 'Unknown'
      const arr = map.get(key)
      if (arr) arr.push(a)
      else map.set(key, [a])
    }

    const groups = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
    for (const [, arr] of groups) {
      arr.sort((a, b) => (a.iataCode ?? '').localeCompare(b.iataCode ?? ''))
    }

    return { filtered, groups }
  }, [airports, search])

  return (
    <MasterDetailLayout
      left={
        <AirportList
          groups={groups}
          totalCount={airports.length}
          filteredCount={filtered.length}
          selected={selected}
          onSelect={setSelected}
          search={search}
          onSearchChange={setSearch}
          loading={loading}
        />
      }
      center={
        selected ? (
          <AirportDetail
            airport={selected}
            onSave={handleSave}
            onDelete={handleDelete}
            onCreate={handleCreate}
            onRefresh={fetchAirports}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-hz-text-secondary text-sm">
            Select an airport
          </div>
        )
      }
    />
  )
}
