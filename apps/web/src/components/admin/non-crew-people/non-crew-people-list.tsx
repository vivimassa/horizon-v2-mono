'use client'

import { useState } from 'react'
import { ChevronRight, Contact, Plus, Ban, ShieldOff } from 'lucide-react'
import type { NonCrewPersonRef } from '@skyhub/api'
import { ListScreenHeader, TextInput, Text } from '@/components/ui'
import { DRAFT_ID } from './non-crew-people-shell'

interface NonCrewPeopleListProps {
  groups: [string, NonCrewPersonRef[]][]
  totalCount: number
  filteredCount: number
  selected: NonCrewPersonRef | null
  onSelect: (p: NonCrewPersonRef) => void
  onStartCreate: () => void
  search: string
  onSearchChange: (value: string) => void
  loading: boolean
}

function displayName(p: NonCrewPersonRef): string {
  const mid = p.fullName.middle ? ` ${p.fullName.middle}` : ''
  return `${p.fullName.last}, ${p.fullName.first}${mid}`.trim()
}

export function NonCrewPeopleList({
  groups,
  totalCount,
  filteredCount,
  selected,
  onSelect,
  onStartCreate,
  search,
  onSearchChange,
  loading,
}: NonCrewPeopleListProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleGroup = (name: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-hz-border shrink-0">
        <ListScreenHeader
          icon={Contact}
          title="Non-Crew Directory"
          count={totalCount}
          filteredCount={filteredCount}
          countLabel="person"
        />
        <div className="px-4 pb-3 flex gap-2">
          <TextInput
            placeholder="Search name, company, passport…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <button
            type="button"
            onClick={onStartCreate}
            className="h-9 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-1 shrink-0"
            style={{ background: 'var(--module-accent, #1e40af)', color: 'white' }}
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <Text variant="secondary" muted as="div" className="animate-pulse px-3 py-4">
            Loading…
          </Text>
        ) : groups.length === 0 ? (
          <Text variant="secondary" muted as="div" className="px-3 py-4">
            No non-crew people registered yet.
          </Text>
        ) : (
          groups.map(([company, list]) => (
            <div key={company}>
              <button
                onClick={() => toggleGroup(company)}
                className="w-full flex items-center gap-2 px-2 py-2 mt-1 first:mt-0 hover:text-hz-text-secondary transition-colors"
              >
                <ChevronRight
                  className={`h-3 w-3 shrink-0 text-hz-text-secondary/50 transition-transform duration-200 ${
                    !collapsed.has(company) ? 'rotate-90' : ''
                  }`}
                />
                <span className="text-[13px] font-medium uppercase tracking-wider text-hz-text-secondary/70">
                  {company}
                </span>
                <span className="text-[13px] text-hz-text-secondary/40">({list.length})</span>
                <div className="flex-1 h-px bg-hz-border/50 ml-1" />
              </button>
              {!collapsed.has(company) && (
                <div className="space-y-0.5">
                  {list.map((person) => {
                    const isSelected = selected?._id === person._id
                    const muted = person.terminated || person.doNotList
                    return (
                      <button
                        key={person._id}
                        onClick={() => onSelect(person)}
                        className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                          isSelected
                            ? 'border-l-[3px] border-l-module-accent bg-module-accent/[0.08]'
                            : 'border-l-[3px] border-l-transparent hover:bg-hz-border/30'
                        }`}
                      >
                        {/* Avatar */}
                        {person.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}${person.avatarUrl}`}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: 'rgba(124,58,237,0.15)' }}
                          >
                            <Contact size={14} style={{ color: '#7c3aed' }} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className={`text-[13px] font-medium truncate ${muted ? 'line-through opacity-60' : ''}`}>
                            {displayName(person)}
                          </div>
                          <div className="text-[13px] text-hz-text-secondary truncate">
                            {person.department ?? person.passport.number}
                          </div>
                        </div>
                        {person.terminated && <Ban size={12} className="text-hz-text-secondary/60 shrink-0" />}
                        {!person.terminated && person.doNotList && (
                          <ShieldOff size={12} className="text-hz-text-secondary/60 shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))
        )}

        {/* Draft placeholder */}
        {selected?._id === DRAFT_ID && (
          <div className="mt-2 px-3 py-2.5 rounded-xl border border-dashed border-module-accent/50 bg-module-accent/[0.04] text-[13px]">
            New person (unsaved)
          </div>
        )}
      </div>
    </div>
  )
}
