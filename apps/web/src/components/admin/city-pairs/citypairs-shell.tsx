'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { api, setApiBaseUrl, type CityPairRef } from '@skyhub/api'
import { MasterDetailLayout } from '@/components/layout'
import { CityPairList } from './citypair-list'
import { CityPairDetail } from './citypair-detail'

setApiBaseUrl('http://localhost:3002')

const ROUTE_TYPE_ORDER: Record<string, number> = {
  domestic: 0,
  regional: 1,
  international: 2,
  'long-haul': 3,
  'ultra-long-haul': 4,
  unknown: 5,
}

export function CityPairsShell() {
  const [cityPairs, setCityPairs] = useState<CityPairRef[]>([])
  const [selected, setSelected] = useState<CityPairRef | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchCityPairs = useCallback(() => {
    setLoading(true)
    api
      .getCityPairs()
      .then((data) => {
        setCityPairs(data)
        setSelected((prev) => {
          if (prev) {
            const found = data.find((c) => c._id === prev._id)
            if (found) return found
          }
          return data.length > 0 ? data[0] : null
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchCityPairs()
  }, [fetchCityPairs])

  const handleSave = useCallback(
    async (id: string, data: Partial<CityPairRef>) => {
      await api.updateCityPair(id, data)
      fetchCityPairs()
    },
    [fetchCityPairs],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await api.deleteCityPair(id)
      setSelected(null)
      fetchCityPairs()
    },
    [fetchCityPairs],
  )

  const handleCreate = useCallback(
    async (data: { station1Icao: string; station2Icao: string; standardBlockMinutes?: number }) => {
      const created = await api.createCityPair(data)
      fetchCityPairs()
      setTimeout(() => setSelected(created), 300)
    },
    [fetchCityPairs],
  )

  // Group by route type
  const { filtered, groups } = useMemo(() => {
    const q = search.toLowerCase().trim()
    const filtered = q
      ? cityPairs.filter(
          (cp) =>
            cp.station1Icao.toLowerCase().includes(q) ||
            (cp.station1Iata?.toLowerCase().includes(q) ?? false) ||
            (cp.station1Name?.toLowerCase().includes(q) ?? false) ||
            (cp.station1City?.toLowerCase().includes(q) ?? false) ||
            cp.station2Icao.toLowerCase().includes(q) ||
            (cp.station2Iata?.toLowerCase().includes(q) ?? false) ||
            (cp.station2Name?.toLowerCase().includes(q) ?? false) ||
            (cp.station2City?.toLowerCase().includes(q) ?? false) ||
            cp.routeType.toLowerCase().includes(q),
        )
      : cityPairs

    const map = new Map<string, CityPairRef[]>()
    for (const cp of filtered) {
      const key = cp.routeType
      const arr = map.get(key)
      if (arr) arr.push(cp)
      else map.set(key, [cp])
    }

    const groups = Array.from(map.entries()).sort(
      ([a], [b]) => (ROUTE_TYPE_ORDER[a] ?? 99) - (ROUTE_TYPE_ORDER[b] ?? 99),
    )

    return { filtered, groups }
  }, [cityPairs, search])

  return (
    <MasterDetailLayout
      left={
        <CityPairList
          groups={groups}
          totalCount={cityPairs.length}
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
          <CityPairDetail
            cityPair={selected}
            onSave={handleSave}
            onDelete={handleDelete}
            onCreate={handleCreate}
            onRefresh={fetchCityPairs}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-hz-text-secondary text-sm">
            Select a city pair
          </div>
        )
      }
    />
  )
}
