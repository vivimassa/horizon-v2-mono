'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, ChevronUp, ChevronDown } from 'lucide-react'

export interface Column<T> {
  key: string
  label: string
  render: (row: T) => React.ReactNode
  sortValue?: (row: T) => string | number
}

interface DataTableProps<T> {
  title: string
  data: T[]
  columns: Column<T>[]
  loading: boolean
  searchPlaceholder?: string
  filterFn: (row: T, query: string) => boolean
  keyFn: (row: T) => string
}

export function DataTable<T>({
  title,
  data,
  columns,
  loading,
  searchPlaceholder = 'Search…',
  filterFn,
  keyFn,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter((row) => filterFn(row, q))
  }, [data, search, filterFn])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    const col = columns.find((c) => c.key === sortKey)
    if (!col?.sortValue) return filtered
    const sv = col.sortValue
    return [...filtered].sort((a, b) => {
      const va = sv(a)
      const vb = sv(b)
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortKey, sortDir, columns])

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="p-2 rounded-lg hover:bg-hz-border/50 transition-colors text-hz-text-secondary">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-hz-text-secondary">{sorted.length} records</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-hz-text-secondary" />
        <input
          type="text"
          placeholder={searchPlaceholder}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-hz-card border border-hz-border outline-none focus:ring-2 focus:ring-hz-accent/30 placeholder:text-hz-text-secondary/50"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-sm text-hz-text-secondary animate-pulse">Loading…</div>
      ) : (
        <div className="rounded-xl border border-hz-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-hz-card text-left">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.sortValue && handleSort(col.key)}
                    className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-hz-text-secondary ${
                      col.sortValue ? 'cursor-pointer select-none hover:text-hz-text' : ''
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key &&
                        (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-hz-border">
              {sorted.map((row, i) => (
                <tr
                  key={keyFn(row)}
                  className={`transition-colors hover:bg-hz-card/50 ${i % 2 === 1 ? 'bg-hz-card/30' : ''}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
