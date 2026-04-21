'use client'

import { useMemo } from 'react'
import { Users, X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'

/**
 * Modal listing every crew member assigned to a given pairing. Opened
 * from the pairing context menu's "Crew on same pairing (C)" item.
 *
 * Each row shows seat code + crew name + employee ID. Click a row to
 * select that crew + close the dialog.
 */
export function CrewOnPairingDialog() {
  const dialog = useCrewScheduleStore((s) => s.crewOnPairingDialog)
  const close = useCrewScheduleStore((s) => s.closeCrewOnPairingDialog)
  const assignments = useCrewScheduleStore((s) => s.assignments)
  const pairings = useCrewScheduleStore((s) => s.pairings)
  const crew = useCrewScheduleStore((s) => s.crew)
  const positions = useCrewScheduleStore((s) => s.positions)
  const selectCrew = useCrewScheduleStore((s) => s.selectCrew)
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const pairing = useMemo(() => (dialog ? pairings.find((p) => p._id === dialog.pairingId) : null), [dialog, pairings])

  const rows = useMemo(() => {
    if (!dialog) return []
    const positionsById = new Map(positions.map((p) => [p._id, p]))
    const crewById = new Map(crew.map((c) => [c._id, c]))
    return assignments
      .filter((a) => a.pairingId === dialog.pairingId && a.status !== 'cancelled')
      .map((a) => {
        const seat = positionsById.get(a.seatPositionId)
        const member = crewById.get(a.crewId)
        return {
          assignmentId: a._id,
          crewId: a.crewId,
          seatCode: seat?.code ?? '?',
          seatRank: seat?.rankOrder ?? 999,
          seatColor: seat?.color ?? null,
          name: member ? `${member.lastName} ${member.firstName}` : '(missing)',
          employeeId: member?.employeeId ?? '—',
        }
      })
      .sort((a, b) => a.seatRank - b.seatRank || a.seatCode.localeCompare(b.seatCode))
  }, [assignments, crew, positions, dialog])

  if (!dialog) return null

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl overflow-hidden w-[520px] max-w-[92vw] flex flex-col"
        style={{
          maxHeight: '80vh',
          background: isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,1)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
          boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.5)' : '0 16px 48px rgba(96,97,112,0.18)',
          color: isDark ? '#FFFFFF' : '#0E0E14',
        }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-4 h-4 shrink-0" style={{ color: 'var(--module-accent)' }} />
            <h3 className="text-[15px] font-bold truncate">Crew on pairing {pairing?.pairingCode ?? ''}</h3>
          </div>
          <button onClick={close} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 pb-2 text-[13px]" style={{ color: isDark ? '#A7A9B5' : '#4A4C5A' }}>
          {rows.length} {rows.length === 1 ? 'crew member' : 'crew members'}
        </div>
        <div className="flex-1 min-h-0 overflow-auto px-2 pb-2">
          {rows.length === 0 && (
            <div className="p-6 text-center text-[13px]" style={{ color: isDark ? '#A7A9B5' : '#6B6C7B' }}>
              No crew assigned to this pairing.
            </div>
          )}
          {rows.map((row) => (
            <button
              key={row.assignmentId}
              onClick={() => {
                selectCrew(row.crewId)
                close()
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-white/5"
              style={{
                background: 'transparent',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
              }}
            >
              <div
                className="w-10 h-7 rounded-md flex items-center justify-center text-[13px] font-bold shrink-0"
                style={{
                  background: row.seatColor ? `${row.seatColor}22` : 'rgba(62,123,250,0.18)',
                  color: row.seatColor ?? '#5B8DEF',
                }}
              >
                {row.seatCode}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold truncate">{row.name}</div>
                <div className="text-[13px] tabular-nums truncate" style={{ color: isDark ? '#A7A9B5' : '#6B6C7B' }}>
                  {row.employeeId}
                </div>
              </div>
            </button>
          ))}
        </div>
        <div
          className="px-5 py-3 flex justify-end"
          style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
        >
          <button
            onClick={close}
            className="h-8 px-4 rounded-lg text-[13px] font-medium hover:bg-white/10"
            style={{ color: isDark ? '#FFFFFF' : '#0E0E14' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
