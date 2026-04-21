'use client'

import { useState } from 'react'
import { Activity, Check, MapPin, Users2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCrewScheduleStore, type CrewGroupingKind } from '@/stores/use-crew-schedule-store'
import { useDateFormat } from '@/hooks/use-date-format'
import { DialogShell, DialogCancelButton, DialogPrimaryButton } from './dialog-shell'

interface Props {
  dateIso: string
  onClose: () => void
}

interface Option {
  kind: CrewGroupingKind
  icon: LucideIcon
  label: string
  description: string
}

const OPTIONS: Option[] = [
  {
    kind: 'activity',
    icon: Activity,
    label: 'By activity on date',
    description: 'Groups crew on the same pairing together, then off/leave/standby, then empty.',
  },
  {
    kind: 'base',
    icon: MapPin,
    label: 'By base on date',
    description: 'Crew on a pairing at this date first (sorted by base), then off-duty.',
  },
  {
    kind: 'seat',
    icon: Users2,
    label: 'By seat filled on date',
    description: 'Groups by seat code (CP/FO/PU/CA), uncrewed/off last.',
  },
]

/**
 * Date-scoped auto-group / sort (AIMS §4.4 "Group crew together").
 *
 * Picking a mode stores `{ kind, dateIso }` so the layout engine swaps
 * its default base→seniority→lastName sort for a group-aware variant.
 * Picking "Clear grouping" reverts to the default. The store persists
 * the choice to localStorage under `horizon.crewSchedule.grouping`.
 */
export function GroupCrewDialog({ dateIso, onClose }: Props) {
  const current = useCrewScheduleStore((s) => s.crewGrouping)
  const setCrewGrouping = useCrewScheduleStore((s) => s.setCrewGrouping)
  const fmtDate = useDateFormat()

  const [selected, setSelected] = useState<CrewGroupingKind | null>(current?.kind ?? null)

  const apply = () => {
    if (selected) setCrewGrouping({ kind: selected, dateIso })
    else setCrewGrouping(null)
    onClose()
  }

  return (
    <DialogShell
      title="Group crew together"
      onClose={onClose}
      width={480}
      footer={
        <>
          <button
            onClick={() => {
              setCrewGrouping(null)
              onClose()
            }}
            className="mr-auto h-9 px-3 rounded-lg text-[13px] font-medium hover:bg-white/10"
          >
            Clear grouping
          </button>
          <DialogCancelButton onClick={onClose} />
          <DialogPrimaryButton onClick={apply} label="Apply" disabled={!selected} />
        </>
      }
    >
      <div className="space-y-3">
        <div className="text-[13px] text-hz-text-tertiary">
          Grouping is scoped to <span className="font-semibold text-hz-text">{fmtDate(dateIso)}</span>. Seniority + last
          name remain as tie-breakers inside each group.
        </div>

        <div className="space-y-2">
          {OPTIONS.map((opt) => {
            const isActive = selected === opt.kind
            return (
              <button
                key={opt.kind}
                onClick={() => setSelected(opt.kind)}
                className="w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors hover:bg-white/5"
                style={{
                  borderColor: isActive ? 'var(--module-accent)' : 'rgba(142,142,160,0.3)',
                  backgroundColor: isActive ? 'rgba(62,123,250,0.08)' : 'transparent',
                }}
              >
                <opt.icon
                  className="w-4 h-4 mt-0.5 shrink-0"
                  style={{ color: isActive ? 'var(--module-accent)' : undefined }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold">{opt.label}</div>
                  <div className="text-[13px] text-hz-text-tertiary mt-0.5">{opt.description}</div>
                </div>
                {isActive && <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--module-accent)' }} />}
              </button>
            )
          })}
        </div>
      </div>
    </DialogShell>
  )
}
