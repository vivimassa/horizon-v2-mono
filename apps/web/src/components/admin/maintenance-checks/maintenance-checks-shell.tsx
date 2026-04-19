'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { api, type MaintenanceCheckTypeRef } from '@skyhub/api'
import { MasterDetailLayout } from '@/components/layout'
import { MaintenanceCheckList } from './maintenance-check-list'
import { MaintenanceCheckDetail } from './maintenance-check-detail'

export function MaintenanceChecksShell() {
  const [checkTypes, setCheckTypes] = useState<MaintenanceCheckTypeRef[]>([])
  const [selected, setSelected] = useState<MaintenanceCheckTypeRef | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)

  const fetchCheckTypes = useCallback(() => {
    setLoading(true)
    api
      .getMaintenanceCheckTypes()
      .then((data) => {
        setCheckTypes(data)
        setSelected((prev) => {
          if (prev) {
            const found = data.find((t) => t._id === prev._id)
            if (found) return found
          }
          return data.length > 0 ? data[0] : null
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchCheckTypes()
  }, [fetchCheckTypes])

  const handleSelect = useCallback(
    (ct: MaintenanceCheckTypeRef) => {
      if (dirty && !window.confirm('You have unsaved changes. Discard?')) return
      setDirty(false)
      setSelected(ct)
    },
    [dirty],
  )

  const handleSave = useCallback(
    async (id: string, data: Partial<MaintenanceCheckTypeRef>) => {
      await api.updateMaintenanceCheckType(id, data)
      fetchCheckTypes()
    },
    [fetchCheckTypes],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await api.deleteMaintenanceCheckType(id)
      setSelected(null)
      setDirty(false)
      fetchCheckTypes()
    },
    [fetchCheckTypes],
  )

  const handleCreate = useCallback(
    async (data: Partial<MaintenanceCheckTypeRef>) => {
      const created = await api.createMaintenanceCheckType(data)
      setDirty(false)
      fetchCheckTypes()
      setTimeout(() => setSelected(created), 300)
    },
    [fetchCheckTypes],
  )

  // Filter by search
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return checkTypes
    return checkTypes.filter(
      (ct) =>
        ct.name.toLowerCase().includes(q) ||
        ct.code.toLowerCase().includes(q) ||
        (ct.description?.toLowerCase().includes(q) ?? false),
    )
  }, [checkTypes, search])

  return (
    <MasterDetailLayout
      left={
        <MaintenanceCheckList
          checkTypes={filtered}
          totalCount={checkTypes.length}
          filteredCount={filtered.length}
          selected={selected}
          onSelect={handleSelect}
          search={search}
          onSearchChange={setSearch}
          loading={loading}
          onCreateClick={() => {
            if (dirty && !window.confirm('You have unsaved changes. Discard?')) return
            setDirty(false)
            setSelected(null)
          }}
        />
      }
      center={
        selected ? (
          <MaintenanceCheckDetail
            checkType={selected}
            allCheckTypes={checkTypes}
            onSave={handleSave}
            onDelete={handleDelete}
            onCreate={handleCreate}
            onDirtyChange={setDirty}
          />
        ) : (
          <MaintenanceCheckDetail
            checkType={null}
            allCheckTypes={checkTypes}
            onCreate={handleCreate}
            onDirtyChange={setDirty}
            onCancelCreate={() => {
              if (checkTypes.length > 0) setSelected(checkTypes[0])
            }}
          />
        )
      }
    />
  )
}
