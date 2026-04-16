'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, setApiBaseUrl, type NonCrewPersonCreate, type NonCrewPersonRef } from '@skyhub/api'
import { MasterDetailLayout } from '@/components/layout'
import { NonCrewPeopleList } from './non-crew-people-list'
import { NonCrewPeopleDetail } from './non-crew-people-detail'

setApiBaseUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002')

// Sentinel id for an unsaved draft row.
export const DRAFT_ID = '__draft__'

export function NonCrewPeopleShell() {
  const [people, setPeople] = useState<NonCrewPersonRef[]>([])
  const [selected, setSelected] = useState<NonCrewPersonRef | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchPeople = useCallback(() => {
    setLoading(true)
    return api
      .listNonCrewPeople()
      .then((data) => {
        setPeople(data)
        setSelected((prev: NonCrewPersonRef | null) => {
          if (prev && prev._id !== DRAFT_ID) {
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
    fetchPeople()
  }, [fetchPeople])

  const handleCreate = useCallback(
    async (data: NonCrewPersonCreate) => {
      const created = await api.createNonCrewPerson(data)
      await fetchPeople()
      setTimeout(() => setSelected(created), 100)
      return created
    },
    [fetchPeople],
  )

  const handleSave = useCallback(
    async (id: string, data: Partial<NonCrewPersonCreate>) => {
      const updated = await api.updateNonCrewPerson(id, data)
      await fetchPeople()
      setSelected(updated)
      return updated
    },
    [fetchPeople],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await api.deleteNonCrewPerson(id)
      setSelected(null)
      await fetchPeople()
    },
    [fetchPeople],
  )

  const handleStartCreate = useCallback(() => {
    const draft: NonCrewPersonRef = {
      _id: DRAFT_ID,
      operatorId: '',
      fullName: { first: '', middle: null, last: '' },
      dateOfBirth: '',
      gender: 'M',
      nationality: '',
      passport: { number: '', countryOfIssue: '', expiryDate: '' },
      contact: { email: null, phone: null },
      company: null,
      department: null,
      avatarUrl: null,
      jumpseatPriority: 'normal',
      doNotList: false,
      terminated: false,
    }
    setSelected(draft)
  }, [])

  const { filtered, groups } = useMemo(() => {
    const q = search.toLowerCase().trim()
    const filtered = q
      ? people.filter((p) => {
          const name = `${p.fullName.first} ${p.fullName.middle ?? ''} ${p.fullName.last}`.toLowerCase()
          return (
            name.includes(q) ||
            (p.company ?? '').toLowerCase().includes(q) ||
            (p.department ?? '').toLowerCase().includes(q) ||
            p.passport.number.toLowerCase().includes(q)
          )
        })
      : people

    const map = new Map<string, NonCrewPersonRef[]>()
    for (const p of filtered) {
      const key = p.company ?? 'Unassigned'
      const arr = map.get(key)
      if (arr) arr.push(p)
      else map.set(key, [p])
    }

    const groups = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
    for (const [, arr] of groups) {
      arr.sort((a, b) => {
        const lastA = `${a.fullName.last}${a.fullName.first}`.toLowerCase()
        const lastB = `${b.fullName.last}${b.fullName.first}`.toLowerCase()
        return lastA.localeCompare(lastB)
      })
    }

    return { filtered, groups }
  }, [people, search])

  return (
    <MasterDetailLayout
      left={
        <NonCrewPeopleList
          groups={groups}
          totalCount={people.length}
          filteredCount={filtered.length}
          selected={selected}
          onSelect={setSelected}
          onStartCreate={handleStartCreate}
          search={search}
          onSearchChange={setSearch}
          loading={loading}
        />
      }
      center={
        selected ? (
          <NonCrewPeopleDetail
            person={selected}
            isDraft={selected._id === DRAFT_ID}
            onSave={handleSave}
            onDelete={handleDelete}
            onCreate={handleCreate}
            onCancelDraft={() => setSelected(people.length > 0 ? people[0] : null)}
            onRefresh={fetchPeople}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-hz-text-secondary text-sm">
            Select a person or click <strong className="mx-1">+ Add</strong> to create one
          </div>
        )
      }
    />
  )
}
