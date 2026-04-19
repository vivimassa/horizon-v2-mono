'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { api, type CountryRef } from '@skyhub/api'
import { MasterDetailLayout } from '@/components/layout'
import { CountryList } from './country-list'
import { CountryDetail } from './country-detail'

export function CountriesShell() {
  const [countries, setCountries] = useState<CountryRef[]>([])
  const [selected, setSelected] = useState<CountryRef | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchCountries = useCallback(() => {
    setLoading(true)
    api
      .getCountries()
      .then((data) => {
        setCountries(data)
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
    fetchCountries()
  }, [fetchCountries])

  const handleSave = useCallback(
    async (id: string, data: Partial<CountryRef>) => {
      await api.updateCountry(id, data)
      fetchCountries()
    },
    [fetchCountries],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await api.deleteCountry(id)
      setSelected(null)
      fetchCountries()
    },
    [fetchCountries],
  )

  const handleCreate = useCallback(
    async (data: Partial<CountryRef>) => {
      const created = await api.createCountry(data)
      fetchCountries()
      setTimeout(() => setSelected(created), 300)
    },
    [fetchCountries],
  )

  // Filter and sort alphabetically
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const list = q
      ? countries.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.isoCode2.toLowerCase().includes(q) ||
            c.isoCode3.toLowerCase().includes(q) ||
            (c.region?.toLowerCase().includes(q) ?? false),
        )
      : countries

    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [countries, search])

  return (
    <MasterDetailLayout
      left={
        <CountryList
          countries={filtered}
          totalCount={countries.length}
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
          <CountryDetail country={selected} onSave={handleSave} onDelete={handleDelete} onCreate={handleCreate} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-hz-text-secondary text-sm">Select a country</div>
        )
      }
    />
  )
}
