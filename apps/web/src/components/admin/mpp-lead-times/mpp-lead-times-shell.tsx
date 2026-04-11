'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { api, setApiBaseUrl, type MppLeadTimeGroupRef, type MppLeadTimeItemRef } from '@skyhub/api'
import { MasterDetailLayout } from '@/components/layout'
import { MppGroupList } from './mpp-group-list'
import { MppGroupDetail } from './mpp-group-detail'

setApiBaseUrl('http://localhost:3002')

export function MppLeadTimesShell() {
  const [groups, setGroups] = useState<MppLeadTimeGroupRef[]>([])
  const [items, setItems] = useState<MppLeadTimeItemRef[]>([])
  const [selected, setSelected] = useState<MppLeadTimeGroupRef | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [g, it] = await Promise.all([api.getMppLeadTimeGroups(), api.getMppLeadTimeItems()])
      setGroups(g)
      setItems(it)
      setSelected((prev) => {
        if (prev) {
          const found = g.find((x) => x._id === prev._id)
          if (found) return found
        }
        return g.length > 0 ? g[0] : null
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSaveGroup = useCallback(
    async (id: string, data: Partial<MppLeadTimeGroupRef>) => {
      await api.updateMppLeadTimeGroup(id, data)
      fetchData()
    },
    [fetchData],
  )

  const handleDeleteGroup = useCallback(
    async (id: string) => {
      await api.deleteMppLeadTimeGroup(id)
      setSelected(null)
      fetchData()
    },
    [fetchData],
  )

  const handleCreateGroup = useCallback(
    async (data: Partial<MppLeadTimeGroupRef>) => {
      const created = await api.createMppLeadTimeGroup(data)
      fetchData()
      setTimeout(() => setSelected(created), 300)
    },
    [fetchData],
  )

  const handleCreateItem = useCallback(
    async (data: Partial<MppLeadTimeItemRef>) => {
      await api.createMppLeadTimeItem(data)
      fetchData()
    },
    [fetchData],
  )

  const handleUpdateItem = useCallback(
    async (id: string, data: Partial<MppLeadTimeItemRef>) => {
      await api.updateMppLeadTimeItem(id, data)
      fetchData()
    },
    [fetchData],
  )

  const handleDeleteItem = useCallback(
    async (id: string) => {
      await api.deleteMppLeadTimeItem(id)
      fetchData()
    },
    [fetchData],
  )

  const handleSeed = useCallback(async () => {
    await api.seedMppLeadTimeDefaults()
    fetchData()
  }, [fetchData])

  const selectedItems = useMemo(
    () => (selected ? items.filter((i) => i.groupId === selected._id) : []),
    [items, selected],
  )

  return (
    <MasterDetailLayout
      left={
        <MppGroupList
          groups={groups}
          items={items}
          selected={selected}
          onSelect={setSelected}
          loading={loading}
          onSeed={groups.length === 0 ? handleSeed : undefined}
        />
      }
      center={
        selected ? (
          <MppGroupDetail
            group={selected}
            items={selectedItems}
            onSaveGroup={handleSaveGroup}
            onDeleteGroup={handleDeleteGroup}
            onCreateGroup={handleCreateGroup}
            onCreateItem={handleCreateItem}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-hz-text-secondary text-sm">
            {groups.length === 0 ? 'Load defaults or add a group' : 'Select a group'}
          </div>
        )
      }
    />
  )
}
