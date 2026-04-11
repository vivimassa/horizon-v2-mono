'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { api, setApiBaseUrl, type DutyPatternRef } from '@skyhub/api'
import { MasterDetailLayout } from '@/components/layout'
import { DutyPatternList } from './duty-pattern-list'
import { DutyPatternDetail } from './duty-pattern-detail'

setApiBaseUrl('http://localhost:3002')

export function DutyPatternsShell() {
  const [patterns, setPatterns] = useState<DutyPatternRef[]>([])
  const [selected, setSelected] = useState<DutyPatternRef | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchPatterns = useCallback(() => {
    setLoading(true)
    api
      .getDutyPatterns()
      .then((data) => {
        setPatterns(data)
        setSelected((prev) => {
          if (prev) {
            const found = data.find((p) => p._id === prev._id)
            if (found) return found
          }
          return data.length > 0 ? data[0] : null
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchPatterns()
  }, [fetchPatterns])

  const handleSave = useCallback(
    async (id: string, data: Partial<DutyPatternRef>) => {
      await api.updateDutyPattern(id, data)
      fetchPatterns()
    },
    [fetchPatterns],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await api.deleteDutyPattern(id)
      setSelected(null)
      fetchPatterns()
    },
    [fetchPatterns],
  )

  const handleCreate = useCallback(
    async (data: Partial<DutyPatternRef>) => {
      const created = await api.createDutyPattern(data)
      fetchPatterns()
      setTimeout(() => setSelected(created), 300)
    },
    [fetchPatterns],
  )

  const handleSeed = useCallback(async () => {
    await api.seedDutyPatterns()
    fetchPatterns()
  }, [fetchPatterns])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const list = q
      ? patterns.filter(
          (p) =>
            p.code.toLowerCase().includes(q) ||
            (p.description?.toLowerCase().includes(q) ?? false) ||
            p.offCode.toLowerCase().includes(q),
        )
      : patterns
    return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
  }, [patterns, search])

  return (
    <MasterDetailLayout
      left={
        <DutyPatternList
          patterns={filtered}
          totalCount={patterns.length}
          filteredCount={filtered.length}
          selected={selected}
          onSelect={setSelected}
          search={search}
          onSearchChange={setSearch}
          loading={loading}
          onSeed={patterns.length === 0 ? handleSeed : undefined}
        />
      }
      center={
        selected ? (
          <DutyPatternDetail pattern={selected} onSave={handleSave} onDelete={handleDelete} onCreate={handleCreate} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-hz-text-secondary text-sm">
            {patterns.length === 0 ? 'Load defaults or create a pattern' : 'Select a pattern'}
          </div>
        )
      }
    />
  )
}
