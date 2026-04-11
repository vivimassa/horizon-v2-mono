'use client'

import { useState, useMemo } from 'react'
import type { ActivityCodeGroupRef, ActivityCodeRef } from '@skyhub/api'
import { Search, Plus, ChevronRight, Trash2, Lock, Archive, Download } from 'lucide-react'

const ACCENT = '#7c3aed' // Crew Ops purple

interface Props {
  groups: ActivityCodeGroupRef[]
  codes: ActivityCodeRef[]
  selected: ActivityCodeRef | null
  onSelect: (c: ActivityCodeRef) => void
  search: string
  onSearchChange: (v: string) => void
  loading: boolean
  onCreateClick: (groupId?: string) => void
  onCreateGroup: (data: Partial<ActivityCodeGroupRef>) => Promise<void>
  onUpdateGroup: (id: string, data: Partial<ActivityCodeGroupRef>) => Promise<void>
  onDeleteGroup: (id: string) => Promise<void>
  onSeedDefaults: () => Promise<void>
}

export function ActivityCodeList({
  groups,
  codes,
  selected,
  onSelect,
  search,
  onSearchChange,
  loading,
  onCreateClick,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onSeedDefaults,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [newGroupCode, setNewGroupCode] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupColor, setNewGroupColor] = useState('#3b82f6')
  const [hoverGroupId, setHoverGroupId] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Group codes by groupId, filtered by search
  const groupedCodes = useMemo(() => {
    const q = search.toLowerCase().trim()
    const filtered = q
      ? codes.filter(
          (c) =>
            c.code.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q) ||
            (c.description?.toLowerCase().includes(q) ?? false),
        )
      : codes

    const map = new Map<string, ActivityCodeRef[]>()
    for (const c of filtered) {
      const arr = map.get(c.groupId)
      if (arr) arr.push(c)
      else map.set(c.groupId, [c])
    }
    return map
  }, [codes, search])

  const sortedGroups = useMemo(() => [...groups].sort((a, b) => a.sortOrder - b.sortOrder), [groups])

  const handleAddGroup = async () => {
    if (!newGroupCode.trim() || !newGroupName.trim()) return
    await onCreateGroup({
      code: newGroupCode.toUpperCase(),
      name: newGroupName,
      color: newGroupColor,
    })
    setNewGroupCode('')
    setNewGroupName('')
    setNewGroupColor('#3b82f6')
    setShowAddGroup(false)
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await onSeedDefaults()
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 space-y-3 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-hz-text">Activity Codes</h2>
            <span className="text-[11px] text-hz-text-secondary">
              {codes.length} code{codes.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowAddGroup(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-hz-border text-hz-text-secondary hover:text-hz-text transition-colors"
            >
              <Plus className="h-3 w-3" /> Group
            </button>
            <button
              onClick={() => onCreateClick()}
              disabled={groups.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: ACCENT }}
            >
              <Plus className="h-3 w-3" /> Code
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hz-text-secondary" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search code, name, description..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 placeholder:text-hz-text-secondary/50 text-hz-text"
          />
        </div>
      </div>

      {/* Add group dialog */}
      {showAddGroup && (
        <div className="px-4 py-3 border-b border-hz-border space-y-2 bg-hz-card/50">
          <p className="text-[12px] font-semibold text-hz-text">New Group</p>
          <div className="flex gap-2">
            <input
              value={newGroupCode}
              onChange={(e) => setNewGroupCode(e.target.value.toUpperCase())}
              placeholder="Code"
              maxLength={8}
              className="w-20 px-2 py-1 rounded border border-hz-border bg-hz-card text-[12px] font-mono text-hz-text outline-none"
            />
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Name"
              maxLength={60}
              className="flex-1 px-2 py-1 rounded border border-hz-border bg-hz-card text-[12px] text-hz-text outline-none"
            />
            <input
              type="color"
              value={newGroupColor}
              onChange={(e) => setNewGroupColor(e.target.value)}
              className="w-7 h-7 rounded border border-hz-border cursor-pointer"
            />
          </div>
          <div className="flex justify-end gap-1.5">
            <button
              onClick={() => setShowAddGroup(false)}
              className="px-2 py-1 rounded text-[11px] text-hz-text-secondary hover:text-hz-text"
            >
              Cancel
            </button>
            <button
              onClick={handleAddGroup}
              disabled={!newGroupCode.trim() || !newGroupName.trim()}
              className="px-3 py-1 rounded text-[11px] font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: '#1e40af' }}
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Groups list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="p-4 text-center text-[13px] text-hz-text-secondary">Loading...</div>
        ) : sortedGroups.length === 0 ? (
          <div className="p-6 text-center space-y-3">
            <p className="text-[13px] text-hz-text-secondary">No activity code groups yet</p>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-colors disabled:opacity-60"
              style={{ backgroundColor: '#1e40af' }}
            >
              <Download className="h-3.5 w-3.5" />
              {seeding ? 'Loading...' : 'Load Defaults'}
            </button>
          </div>
        ) : (
          sortedGroups.map((group) => {
            const groupCodes = groupedCodes.get(group._id) ?? []
            const isCollapsed = collapsed.has(group._id)
            const activeCount = codes.filter((c) => c.groupId === group._id && c.isActive).length

            return (
              <div key={group._id}>
                {/* Group header */}
                <button
                  className="w-full flex items-center gap-2 px-2 py-2 mt-1 first:mt-0 hover:text-hz-text-secondary transition-colors"
                  onMouseEnter={() => setHoverGroupId(group._id)}
                  onMouseLeave={() => setHoverGroupId(null)}
                  onClick={() => toggle(group._id)}
                >
                  <ChevronRight
                    className={`h-3 w-3 shrink-0 text-hz-text-secondary/50 transition-transform duration-200 ${
                      !isCollapsed ? 'rotate-90' : ''
                    }`}
                  />
                  <div
                    className="w-3 h-3 rounded-full shrink-0 cursor-pointer"
                    style={{ backgroundColor: group.color }}
                    onClick={(e) => {
                      e.stopPropagation()
                      const input = document.createElement('input')
                      input.type = 'color'
                      input.value = group.color
                      input.onchange = () => onUpdateGroup(group._id, { color: input.value })
                      input.click()
                    }}
                  />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-hz-text-secondary/70">
                    {group.code} — {group.name}
                  </span>
                  <span className="text-[10px] text-hz-text-secondary/40">({activeCount})</span>

                  {/* Hover actions */}
                  {hoverGroupId === group._id && (
                    <div className="flex items-center gap-0.5 ml-auto">
                      <div
                        onClick={(e) => {
                          e.stopPropagation()
                          onCreateClick(group._id)
                        }}
                        className="p-1 rounded hover:bg-hz-card cursor-pointer"
                        title="Add code to this group"
                      >
                        <Plus className="h-3 w-3 text-hz-text-secondary" />
                      </div>
                      <div
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteGroup(group._id)
                        }}
                        className="p-1 rounded hover:bg-red-500/10 cursor-pointer"
                        title="Delete group"
                      >
                        <Trash2 className="h-3 w-3 text-red-400" />
                      </div>
                    </div>
                  )}

                  <div className="flex-1 h-px bg-hz-border/50 ml-1" />
                </button>

                {/* Codes in group */}
                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {groupCodes.map((code) => {
                      const isSel = selected?._id === code._id
                      return (
                        <button
                          key={code._id}
                          onClick={() => onSelect(code)}
                          className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                            isSel
                              ? 'border-l-[3px] border-l-module-accent bg-module-accent/[0.08]'
                              : 'border-l-[3px] border-l-transparent hover:bg-hz-border/30'
                          }`}
                        >
                          {/* Code chip — fixed width */}
                          <span
                            className="w-12 text-center py-0.5 rounded text-[12px] font-mono font-bold text-white shrink-0"
                            style={{
                              backgroundColor: code.color ?? group.color,
                            }}
                          >
                            {code.code}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium truncate text-hz-text">{code.name}</div>
                            {code.description && (
                              <div className="text-[11px] text-hz-text-secondary truncate">{code.description}</div>
                            )}
                          </div>
                          {/* Badges */}
                          {code.isSystem && <Lock className="h-3.5 w-3.5 text-hz-text-tertiary shrink-0" />}
                          {code.isArchived && <Archive className="h-3.5 w-3.5 text-hz-text-tertiary shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
