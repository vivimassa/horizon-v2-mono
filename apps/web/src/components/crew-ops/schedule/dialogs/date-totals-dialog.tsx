'use client'

import { useMemo } from 'react'
import { Sigma, X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { useDateFormat } from '@/hooks/use-date-format'

/**
 * Flight / Duty time totals for a selected date across ALL visible
 * crew. Opened from the date-header context menu (§4.4 "Flight / Duty
 * time totals (T)").
 *
 * Per-assignment/activity minutes are pro-rated by the fraction of its
 * window that falls inside the UTC day — a 2-day pairing that ends at
 * 02:00 only contributes 2h to the next day's block bucket.
 */
export function DateTotalsDialog() {
  const dialog = useCrewScheduleStore((s) => s.dateTotalsDialog)
  const close = useCrewScheduleStore((s) => s.closeDateTotalsDialog)
  const crew = useCrewScheduleStore((s) => s.crew)
  const fmtDate = useDateFormat()
  const pairings = useCrewScheduleStore((s) => s.pairings)
  const assignments = useCrewScheduleStore((s) => s.assignments)
  const activities = useCrewScheduleStore((s) => s.activities)
  const excludedCrewIds = useCrewScheduleStore((s) => s.excludedCrewIds)
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const totals = useMemo(() => {
    if (!dialog) return null
    const dayStartMs = new Date(dialog.dateIso + 'T00:00:00Z').getTime()
    const dayEndMs = dayStartMs + 86_400_000
    const visibleCrewIds = new Set(crew.filter((c) => !excludedCrewIds.has(c._id)).map((c) => c._id))
    const pairingsById = new Map(pairings.map((p) => [p._id, p]))
    const perCrew = new Map<
      string,
      {
        crewId: string
        name: string
        blockMinutes: number
        dutyMinutes: number
        pairingCount: number
        dutyCount: number
      }
    >()
    let totalBlock = 0
    let totalDuty = 0
    let totalPairings = 0
    let totalDuties = 0

    for (const a of assignments) {
      if (!visibleCrewIds.has(a.crewId)) continue
      if (a.status === 'cancelled') continue
      const startMs = new Date(a.startUtcIso).getTime()
      const endMs = new Date(a.endUtcIso).getTime()
      if (endMs <= dayStartMs || startMs >= dayEndMs) continue
      const pairing = pairingsById.get(a.pairingId)
      const overlapMs = Math.min(endMs, dayEndMs) - Math.max(startMs, dayStartMs)
      const totalMs = Math.max(1, endMs - startMs)
      const ratio = Math.min(1, Math.max(0, overlapMs / totalMs))
      const block = (pairing?.totalBlockMinutes ?? 0) * ratio
      const duty = (pairing?.totalDutyMinutes ?? 0) * ratio
      const c = crew.find((cc) => cc._id === a.crewId)
      const name = c ? `${c.lastName} ${c.firstName}` : '(missing)'
      const entry = perCrew.get(a.crewId) ?? {
        crewId: a.crewId,
        name,
        blockMinutes: 0,
        dutyMinutes: 0,
        pairingCount: 0,
        dutyCount: 0,
      }
      entry.blockMinutes += block
      entry.dutyMinutes += duty
      entry.pairingCount += 1
      perCrew.set(a.crewId, entry)
      totalBlock += block
      totalDuty += duty
      totalPairings += 1
    }

    for (const ac of activities) {
      if (!visibleCrewIds.has(ac.crewId)) continue
      const startMs = new Date(ac.startUtcIso).getTime()
      const endMs = new Date(ac.endUtcIso).getTime()
      if (endMs <= dayStartMs || startMs >= dayEndMs) continue
      const c = crew.find((cc) => cc._id === ac.crewId)
      const name = c ? `${c.lastName} ${c.firstName}` : '(missing)'
      const entry = perCrew.get(ac.crewId) ?? {
        crewId: ac.crewId,
        name,
        blockMinutes: 0,
        dutyMinutes: 0,
        pairingCount: 0,
        dutyCount: 0,
      }
      entry.dutyCount += 1
      perCrew.set(ac.crewId, entry)
      totalDuties += 1
    }
    // Pairings counted as duties too.
    totalDuties += totalPairings

    const perCrewSorted = [...perCrew.values()].sort((a, b) => b.blockMinutes - a.blockMinutes)
    return { totalBlock, totalDuty, totalPairings, totalDuties, perCrew: perCrewSorted }
  }, [dialog, crew, pairings, assignments, activities, excludedCrewIds])

  if (!dialog || !totals) return null

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl overflow-hidden w-[600px] max-w-[92vw] flex flex-col"
        style={{
          height: 500,
          maxHeight: '85vh',
          background: isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,1)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
          boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.5)' : '0 16px 48px rgba(96,97,112,0.18)',
          color: isDark ? '#FFFFFF' : '#0E0E14',
        }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Sigma className="w-4 h-4 shrink-0" style={{ color: 'var(--module-accent)' }} />
            <h3 className="text-[15px] font-bold truncate">Totals for {fmtDate(dialog.dateIso)}</h3>
          </div>
          <button onClick={close} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-3 flex items-center gap-5 flex-wrap text-[13px] tabular-nums">
          <Stat label="Block" value={formatHm(totals.totalBlock)} />
          <Stat label="Duty" value={formatHm(totals.totalDuty)} />
          <Stat label="Pairings" value={String(totals.totalPairings)} />
          <Stat label="Duties" value={String(totals.totalDuties)} />
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <div
            className="sticky top-0 px-5 py-2 text-[13px] font-semibold uppercase tracking-wider grid grid-cols-[1fr_auto_auto] gap-4"
            style={{
              background: isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,1)',
              color: isDark ? '#A7A9B5' : '#6B6C7B',
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}
          >
            <span>Crew</span>
            <span className="text-right w-16">Block</span>
            <span className="text-right w-16">Duty</span>
          </div>
          {totals.perCrew.length === 0 && (
            <div className="p-6 text-center text-[13px]" style={{ color: isDark ? '#A7A9B5' : '#6B6C7B' }}>
              No crew have activity on this date.
            </div>
          )}
          {totals.perCrew.map((row, i) => (
            <div
              key={row.crewId}
              className="px-5 py-2 grid grid-cols-[1fr_auto_auto] gap-4 text-[13px] tabular-nums"
              style={{
                background: i % 2 === 1 ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)') : undefined,
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
              }}
            >
              <span className="truncate font-medium">{row.name}</span>
              <span className="text-right w-16 font-semibold">{formatHm(row.blockMinutes)}</span>
              <span className="text-right w-16">{formatHm(row.dutyMinutes)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary">{label}</span>
      <span className="text-[17px] font-bold">{value}</span>
    </div>
  )
}

function formatHm(mins: number): string {
  const rounded = Math.round(mins)
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  return `${h}:${String(m).padStart(2, '0')}`
}
