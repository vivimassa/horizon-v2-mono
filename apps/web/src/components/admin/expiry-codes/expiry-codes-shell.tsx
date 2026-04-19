'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { api, type ExpiryCodeRef, type ExpiryCodeCategoryRef } from '@skyhub/api'
import { MasterDetailLayout } from '@/components/layout'
import { accentTint } from '@skyhub/ui/theme'
import { getOperatorId } from '@/stores/use-operator-store'
import { FileCheck, Plus, Sparkles } from 'lucide-react'
import { ExpiryCodeList } from './expiry-code-list'
import { ExpiryCodeDetail } from './expiry-code-detail'

export const ACCENT = '#16a34a' // Crew Ops qualifications green

export function ExpiryCodesShell() {
  const [codes, setCodes] = useState<ExpiryCodeRef[]>([])
  const [categories, setCategories] = useState<ExpiryCodeCategoryRef[]>([])
  const [selected, setSelected] = useState<ExpiryCodeRef | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const fetchData = useCallback(() => {
    setLoading(true)
    Promise.all([api.getExpiryCodes(getOperatorId()), api.getExpiryCodeCategories(getOperatorId())])
      .then(([codesData, catsData]) => {
        setCodes(codesData)
        setCategories(catsData)
        setSelected((prev) => {
          if (prev) {
            const f = codesData.find((c) => c._id === prev._id)
            if (f) return f
          }
          return codesData.length > 0 ? codesData[0] : null
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreate = useCallback(
    async (data: Partial<ExpiryCodeRef>) => {
      await api.createExpiryCode({ ...data, operatorId: getOperatorId() })
      setShowCreate(false)
      fetchData()
    },
    [fetchData],
  )

  const handleSave = useCallback(
    async (id: string, data: Partial<ExpiryCodeRef>) => {
      await api.updateExpiryCode(id, data)
      fetchData()
    },
    [fetchData],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await api.deleteExpiryCode(id)
      setSelected(null)
      fetchData()
    },
    [fetchData],
  )

  const handleDeactivate = useCallback(
    async (id: string) => {
      await api.updateExpiryCode(id, { isActive: false })
      fetchData()
    },
    [fetchData],
  )

  const handleSeed = useCallback(async () => {
    await api.seedExpiryCodes(getOperatorId())
    fetchData()
  }, [fetchData])

  const handleSelect = useCallback((code: ExpiryCodeRef) => {
    setSelected(code)
    setShowCreate(false)
  }, [])

  // Build category lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, ExpiryCodeCategoryRef>()
    for (const c of categories) map.set(c._id, c)
    return map
  }, [categories])

  // Group by category
  const { groups, totalCount } = useMemo(() => {
    const q = search.toLowerCase().trim()
    const filtered = q
      ? codes.filter(
          (c) =>
            c.code.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q) ||
            c.crewCategory.toLowerCase().includes(q) ||
            c.formula.toLowerCase().includes(q),
        )
      : codes

    const map = new Map<string, ExpiryCodeRef[]>()
    for (const c of filtered) {
      const cat = categoryMap.get(c.categoryId)
      const key = cat?.label ?? 'Uncategorized'
      const arr = map.get(key)
      if (arr) arr.push(c)
      else map.set(key, [c])
    }

    // Sort groups by category sortOrder
    const catOrder = new Map(categories.map((c) => [c.label, c.sortOrder]))
    const groups = Array.from(map.entries()).sort(([a], [b]) => (catOrder.get(a) ?? 99) - (catOrder.get(b) ?? 99))
    return { groups, totalCount: filtered.length }
  }, [codes, categories, categoryMap, search])

  return (
    <MasterDetailLayout
      left={
        <ExpiryCodeList
          groups={groups}
          totalCount={totalCount}
          selected={selected}
          onSelect={handleSelect}
          search={search}
          onSearchChange={setSearch}
          loading={loading}
          onAddClick={() => {
            setShowCreate(true)
            setSelected(null)
          }}
          categoryMap={categoryMap}
        />
      }
      center={
        showCreate ? (
          <ExpiryCodeDetail
            code={null}
            categories={categories}
            onCreate={handleCreate}
            onCancel={() => {
              setShowCreate(false)
              if (codes.length > 0) setSelected(codes[0])
            }}
          />
        ) : selected ? (
          <ExpiryCodeDetail
            code={selected}
            categories={categories}
            onSave={handleSave}
            onDelete={handleDelete}
            onDeactivate={handleDeactivate}
          />
        ) : !loading && codes.length === 0 ? (
          <EmptyState onSeed={handleSeed} onAdd={() => setShowCreate(true)} />
        ) : null
      }
    />
  )
}

// ── Empty State ──

function EmptyState({ onSeed, onAdd }: { onSeed: () => void; onAdd: () => void }) {
  const [seeding, setSeeding] = useState(false)

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await onSeed()
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: accentTint(ACCENT, 0.1) }}
      >
        <FileCheck size={24} color={ACCENT} strokeWidth={1.8} />
      </div>
      <div className="text-center">
        <h2 className="text-[17px] font-semibold text-hz-text mb-1">No Expiry Codes Configured</h2>
        <p className="text-[13px] text-hz-text-secondary max-w-sm">
          Expiry codes define qualification tracking rules, validity formulas, and enforcement levels. Seed defaults for
          a quick start, or add codes manually.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: ACCENT }}
        >
          <Sparkles className="h-4 w-4" /> {seeding ? 'Seeding...' : 'Seed Default Codes'}
        </button>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold border border-hz-border text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Manually
        </button>
      </div>
    </div>
  )
}
