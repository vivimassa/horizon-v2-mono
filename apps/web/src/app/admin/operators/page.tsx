'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, setApiBaseUrl, type OperatorRef } from '@skyhub/api'
import { DataTable, type Column } from '@/components/admin/data-table'

setApiBaseUrl('http://localhost:3002')

const columns: Column<OperatorRef>[] = [
  {
    key: 'code',
    label: 'Code',
    render: (r) => <span className="font-bold">{r.code}</span>,
    sortValue: (r) => r.code,
  },
  {
    key: 'name',
    label: 'Name',
    render: (r) => <span className="font-medium">{r.name}</span>,
    sortValue: (r) => r.name,
  },
  {
    key: 'icaoCode',
    label: 'ICAO Code',
    render: (r) => <span className="font-mono text-hz-text-secondary">{r.icaoCode ?? '—'}</span>,
    sortValue: (r) => r.icaoCode ?? '',
  },
  {
    key: 'iataCode',
    label: 'IATA Code',
    render: (r) => <span className="font-mono text-hz-text-secondary">{r.iataCode ?? '—'}</span>,
    sortValue: (r) => r.iataCode ?? '',
  },
  {
    key: 'country',
    label: 'Country',
    render: (r) => <span className="text-hz-text-secondary">{r.country ?? '—'}</span>,
    sortValue: (r) => r.country ?? '',
  },
  {
    key: 'active',
    label: 'Active',
    render: (r) =>
      r.isActive ? (
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">Active</span>
      ) : (
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">Inactive</span>
      ),
    sortValue: (r) => (r.isActive ? 1 : 0),
  },
]

const filterFn = (r: OperatorRef, q: string) =>
  r.code.toLowerCase().includes(q) ||
  r.name.toLowerCase().includes(q) ||
  (r.icaoCode?.toLowerCase().includes(q) ?? false) ||
  (r.iataCode?.toLowerCase().includes(q) ?? false)

export default function OperatorsPage() {
  const [data, setData] = useState<OperatorRef[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .getOperators()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const keyFn = useCallback((r: OperatorRef) => r._id, [])

  return (
    <DataTable
      title="Operators"
      data={data}
      columns={columns}
      loading={loading}
      searchPlaceholder="Search code, name, ICAO, IATA…"
      filterFn={filterFn}
      keyFn={keyFn}
    />
  )
}
