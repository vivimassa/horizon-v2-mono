'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { MONTHS, getDefaultLeadMonths, type MppEventType } from '@skyhub/logic'
import { api, useInvalidateManpower, useMppLeadTimeItems, type ManpowerEventRef } from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { crewAccent } from '@/components/crew-ops/crew-profile/common/draft-helpers'
import { positionColor } from '../common/position-colors'
import type { ManpowerEngineBundle } from '../manpower-planning-shell'

interface Props {
  bundle: ManpowerEngineBundle
  activePlanId: string
}

const EVENT_TYPES: MppEventType[] = ['AOC', 'CUG', 'CCQ', 'ACMI', 'DRY', 'DOWNSIZE', 'RESIGN', 'DELIVERY']

const EVENT_DESCRIPTIONS: Record<MppEventType, string> = {
  AOC: 'New-hire joining (type rating complete after lead months)',
  CUG: 'Captain upgrade — consumes FO at the event month, delivers CP after lead',
  CCQ: 'Cross-crew qualification — temporary unavailability then re-entry',
  ACMI: 'Wet lease — adds block-hour capacity with no crew impact',
  DRY: 'Dry lease — aircraft added without crew',
  DOWNSIZE: 'Scheduled headcount reduction',
  RESIGN: 'Batch resignation',
  DELIVERY: 'Aircraft delivery (fleet-side)',
}

export function EventsTab({ bundle, activePlanId }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const accent = crewAccent(isDark)
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const operatorId = getOperatorId()
  const leadTimeItems = useMppLeadTimeItems(operatorId).data ?? []
  const invalidate = useInvalidateManpower()

  const [adding, setAdding] = useState(false)

  return (
    <div className="p-5 space-y-4">
      <header className="flex items-center gap-2">
        <div className="w-[3px] h-5 rounded-full" style={{ background: accent }} />
        <h3 className="text-[15px] font-bold" style={{ color: palette.text }}>
          Manpower Events
        </h3>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="ml-auto h-10 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 transition-opacity hover:opacity-90"
          style={{ background: accent, color: 'white' }}
        >
          <Plus size={13} /> {adding ? 'Cancel' : 'Add Event'}
        </button>
      </header>

      {adding && (
        <AddEventForm
          bundle={bundle}
          activePlanId={activePlanId}
          leadTimeItems={leadTimeItems}
          onDone={async () => {
            await invalidate.invalidatePlan(activePlanId)
            setAdding(false)
          }}
        />
      )}

      {bundle.events.length === 0 ? (
        <div
          className="rounded-xl border border-dashed p-8 text-center text-[13px]"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
            color: palette.textTertiary,
          }}
        >
          No events yet. Add training cycles, upgrades, leases, resignations to steer the plan.
        </div>
      ) : (
        <ul className="space-y-2">
          {bundle.events.map((e) => (
            <EventCard
              key={e._id}
              event={e}
              bundle={bundle}
              activePlanId={activePlanId}
              onDeleted={() => invalidate.invalidatePlan(activePlanId)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function EventCard({
  event,
  bundle,
  activePlanId,
  onDeleted,
}: {
  event: ManpowerEventRef
  bundle: ManpowerEngineBundle
  activePlanId: string
  onDeleted: () => Promise<unknown> | void
}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const tint = EVENT_TYPE_COLOR[event.eventType]

  const position = bundle.positions.find((p) => p.name === event.positionName)

  return (
    <li
      className="rounded-xl p-3 flex items-center gap-3"
      style={{
        background: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF',
        border: `1px solid ${border}`,
      }}
    >
      <span
        className="text-[13px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
        style={{ background: `${tint}22`, color: tint }}
      >
        {event.eventType}
      </span>
      {position && (
        <span className="text-[13px] font-medium flex items-center gap-1.5" style={{ color: palette.text }}>
          <span className="w-2 h-2 rounded-full" style={{ background: positionColor(position.code, position.color) }} />
          {position.name}
        </span>
      )}
      {event.fleetIcao && (
        <span className="text-[13px] font-mono" style={{ color: palette.textSecondary }}>
          {event.fleetIcao}
        </span>
      )}
      <span className="text-[13px]" style={{ color: palette.textSecondary }}>
        {MONTHS[event.monthIndex]} · {event.count} crew · +{event.leadMonths} mo lead
      </span>
      {event.notes && (
        <span className="text-[13px] truncate" style={{ color: palette.textTertiary }}>
          {event.notes}
        </span>
      )}
      <button
        type="button"
        onClick={async () => {
          if (!confirm('Delete this event?')) return
          await api.deleteManpowerEvent(activePlanId, event._id)
          await onDeleted()
        }}
        className="ml-auto h-9 w-9 rounded-lg flex items-center justify-center opacity-70 hover:opacity-100"
        title="Delete"
      >
        <Trash2 size={14} style={{ color: '#E63535' }} />
      </button>
    </li>
  )
}

function AddEventForm({
  bundle,
  activePlanId,
  leadTimeItems,
  onDone,
}: {
  bundle: ManpowerEngineBundle
  activePlanId: string
  leadTimeItems: { label: string; valueMonths: number }[]
  onDone: () => Promise<unknown> | void
}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const accent = crewAccent(isDark)
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'

  const [eventType, setEventType] = useState<MppEventType>('AOC')
  const [positionName, setPositionName] = useState<string>(bundle.positions[0]?.name ?? '')
  const [monthIndex, setMonthIndex] = useState(0)
  const [count, setCount] = useState(1)
  const [notes, setNotes] = useState('')

  const leadMonths = useMemo(
    () => getDefaultLeadMonths(eventType, positionName, leadTimeItems),
    [eventType, positionName, leadTimeItems],
  )
  const [leadOverride, setLeadOverride] = useState<number | null>(null)

  const activeLead = leadOverride ?? leadMonths

  const handleSubmit = async () => {
    await api.createManpowerEvent(activePlanId, {
      eventType,
      monthIndex,
      planYear: bundle.year,
      count,
      fleetIcao: null,
      positionName: positionName || null,
      leadMonths: activeLead,
      notes: notes || null,
    })
    await onDone()
  }

  const selectStyle = {
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
    border: `1px solid ${border}`,
    color: palette.text,
  } as const

  return (
    <form
      className="rounded-xl p-4 space-y-3"
      style={{
        background: isDark ? 'rgba(20,184,166,0.04)' : 'rgba(15,118,110,0.03)',
        border: `1px solid ${accent}33`,
      }}
      onSubmit={(e) => {
        e.preventDefault()
        void handleSubmit()
      }}
    >
      <p className="text-[13px]" style={{ color: palette.textSecondary }}>
        {EVENT_DESCRIPTIONS[eventType]}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
        <label className="flex flex-col gap-1 text-[13px]" style={{ color: palette.textSecondary }}>
          Type
          <select
            value={eventType}
            onChange={(e) => {
              setEventType(e.target.value as MppEventType)
              setLeadOverride(null)
            }}
            className="h-10 px-3 rounded-lg text-[13px]"
            style={selectStyle}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px]" style={{ color: palette.textSecondary }}>
          Position
          <select
            value={positionName}
            onChange={(e) => {
              setPositionName(e.target.value)
              setLeadOverride(null)
            }}
            className="h-10 px-3 rounded-lg text-[13px]"
            style={selectStyle}
          >
            {bundle.positions.map((p) => (
              <option key={p._id} value={p.name}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px]" style={{ color: palette.textSecondary }}>
          Month
          <select
            value={monthIndex}
            onChange={(e) => setMonthIndex(Number(e.target.value))}
            className="h-10 px-3 rounded-lg text-[13px]"
            style={selectStyle}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px]" style={{ color: palette.textSecondary }}>
          Count
          <input
            type="number"
            min={0}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="h-10 px-3 rounded-lg text-[13px]"
            style={selectStyle}
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px]" style={{ color: palette.textSecondary }}>
          Lead (mo)
          <input
            type="number"
            min={0}
            value={activeLead}
            onChange={(e) => setLeadOverride(Number(e.target.value))}
            className="h-10 px-3 rounded-lg text-[13px]"
            style={selectStyle}
          />
        </label>
        <button
          type="submit"
          className="h-10 rounded-lg text-[13px] font-semibold"
          style={{ background: accent, color: 'white' }}
        >
          Save event
        </button>
      </div>
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full h-10 px-3 rounded-lg text-[13px]"
        style={selectStyle}
      />
    </form>
  )
}

const EVENT_TYPE_COLOR: Record<MppEventType, string> = {
  AOC: '#06C270',
  CUG: '#0063F7',
  CCQ: '#7c3aed',
  ACMI: '#FF8800',
  DRY: '#FF8800',
  DOWNSIZE: '#E63535',
  RESIGN: '#E63535',
  DELIVERY: '#14B8A6',
}
