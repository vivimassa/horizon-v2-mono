'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { api, type CrewTransportVendorRef, type AirportRef } from '@skyhub/api'
import { MasterDetailLayout } from '@/components/layout'
import { CrewTransportVendorList } from './crew-transport-vendor-list'
import { CrewTransportVendorDetail } from './crew-transport-vendor-detail'
import { CrewTransportVendorCreatePanel } from './crew-transport-vendor-create-panel'

/**
 * 4.1.8.2 Crew Transport — vendor master data admin shell.
 * Mirrors CrewHotelsShell so the parent page can host both behind a segment.
 */
export function CrewTransportVendorsShell() {
  const [vendors, setVendors] = useState<CrewTransportVendorRef[]>([])
  const [airports, setAirports] = useState<AirportRef[]>([])
  const [selected, setSelected] = useState<CrewTransportVendorRef | null>(null)
  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState(true)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const fetchVendors = useCallback(() => {
    setLoading(true)
    api
      .getCrewTransportVendors()
      .then((data) => {
        setVendors(data)
        setSelected((prev) => {
          if (prev) {
            const found = data.find((v) => v._id === prev._id)
            if (found) return found
          }
          return data.length > 0 ? data[0] : null
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchVendors()
    api.getAirports().then(setAirports).catch(console.error)
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
      const created = await api.createCrewTransportVendor(data)
      fetchVendors()
      setShowCreate(false)
      setTimeout(() => setSelected(created), 300)
    },
    [fetchVendors],
  )

  const { filtered, groups } = useMemo(() => {
    const q = search.toLowerCase().trim()
    let filtered = vendors
    if (activeOnly) filtered = filtered.filter((v) => v.isActive)
    if (q) {
      filtered = filtered.filter(
        (v) =>
          v.vendorName.toLowerCase().includes(q) ||
          v.baseAirportIcao.toLowerCase().includes(q) ||
          (v.addressLine1?.toLowerCase().includes(q) ?? false),
      )
    }

    const map = new Map<string, CrewTransportVendorRef[]>()
    for (const v of filtered) {
      const arr = map.get(v.baseAirportIcao)
      if (arr) arr.push(v)
      else map.set(v.baseAirportIcao, [v])
    }

    const groups = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
    for (const [, arr] of groups) {
      arr.sort((a, b) => a.priority - b.priority || a.vendorName.localeCompare(b.vendorName))
    }
    return { filtered, groups }
  }, [vendors, search, activeOnly])

  return (
    <MasterDetailLayout
      left={
        <CrewTransportVendorList
          groups={groups}
          airports={airports}
          totalCount={vendors.length}
          filteredCount={filtered.length}
          selected={selected}
          onSelect={setSelected}
          search={search}
          onSearchChange={setSearch}
          activeOnly={activeOnly}
          onActiveOnlyChange={setActiveOnly}
          loading={loading}
          onRefresh={fetchVendors}
          onAdd={() => setShowCreate(true)}
        />
      }
      center={
        showCreate ? (
          <CrewTransportVendorCreatePanel
            airports={airports}
            onCreate={handleCreate}
            onCancel={() => setShowCreate(false)}
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
          <div className="flex-1 flex items-center justify-center flex-col gap-4 p-8">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-module-accent/10">
              <span className="text-module-accent text-[13px] font-bold">5.4.10</span>
            </div>
            <div className="text-center">
              <div className="text-[15px] font-semibold">Crew Transport Vendors</div>
              <div className="text-[13px] text-hz-text-secondary mt-1">
                Select a vendor from the list or add your first one
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-module-accent text-white text-[13px] font-semibold hover:opacity-90"
            >
              + Add Vendor
            </button>
          </div>
        )
      }
    />
  )
}
