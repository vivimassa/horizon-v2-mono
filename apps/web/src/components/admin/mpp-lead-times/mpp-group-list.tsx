'use client'

import type { MppLeadTimeGroupRef, MppLeadTimeItemRef } from '@skyhub/api'
import { PlaneTakeoff, UsersRound, Layers, Sparkles } from 'lucide-react'

interface Props {
  groups: MppLeadTimeGroupRef[]
  items: MppLeadTimeItemRef[]
  selected: MppLeadTimeGroupRef | null
  onSelect: (g: MppLeadTimeGroupRef) => void
  loading: boolean
  onSeed?: () => void
}

const CREW_SECTIONS: { key: MppLeadTimeGroupRef['crewType']; label: string; icon: typeof PlaneTakeoff }[] = [
  { key: 'cockpit', label: 'COCKPIT CREW', icon: PlaneTakeoff },
  { key: 'cabin', label: 'CABIN CREW', icon: UsersRound },
  { key: 'other', label: 'OTHER', icon: Layers },
]

export function MppGroupList({ groups, items, selected, onSelect, loading, onSeed }: Props) {
  const itemCountByGroup = new Map<string, number>()
  for (const it of items) itemCountByGroup.set(it.groupId, (itemCountByGroup.get(it.groupId) ?? 0) + 1)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-hz-border shrink-0">
        <h2 className="text-[16px] font-bold">Lead Times</h2>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="text-[13px] text-hz-text-secondary animate-pulse px-3 py-4">Loading...</div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-3 py-8 text-center">
            <p className="text-[13px] text-hz-text-secondary">No lead time groups</p>
            {onSeed && (
              <button
                onClick={onSeed}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white bg-module-accent transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" /> Load Defaults
              </button>
            )}
          </div>
        ) : (
          CREW_SECTIONS.map((section) => {
            const sectionGroups = groups.filter((g) => g.crewType === section.key)
            if (sectionGroups.length === 0) return null
            const Icon = section.icon
            return (
              <div key={section.key} className="mb-4">
                <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                  <Icon size={13} className="text-hz-text-tertiary" strokeWidth={1.8} />
                  <span className="text-[12px] font-medium uppercase tracking-wider text-hz-text-tertiary">
                    {section.label}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {sectionGroups.map((g) => {
                    const isSelected = selected?._id === g._id
                    const count = itemCountByGroup.get(g._id) ?? 0
                    return (
                      <button
                        key={g._id}
                        onClick={() => onSelect(g)}
                        className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                          isSelected
                            ? 'border-l-[3px] border-l-module-accent bg-module-accent/[0.08]'
                            : 'border-l-[3px] border-l-transparent hover:bg-hz-border/30'
                        }`}
                      >
                        {/* Code badge */}
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded text-white shrink-0"
                          style={{ backgroundColor: g.color }}
                        >
                          {g.code}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium truncate">{g.label}</div>
                          {g.description && (
                            <div className="text-[12px] text-hz-text-secondary truncate">{g.description}</div>
                          )}
                        </div>
                        {/* Item count */}
                        <span className="text-[12px] font-semibold text-module-accent shrink-0">{count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
