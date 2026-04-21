'use client'

import { useMemo, useState } from 'react'
import { Plane } from 'lucide-react'
import { api } from '@skyhub/api'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { useDateFormat } from '@/hooks/use-date-format'
import { isEligibleForSeat } from '@/lib/crew-schedule/seat-eligibility'
import { checkAssignmentViolations, partitionViolations } from '@/lib/crew-schedule/violations'
import { DialogShell, DialogCancelButton } from './dialog-shell'

interface Props {
  crewId: string
  dateIso: string
  onClose: () => void
  onAfterMutate: () => void
}

/**
 * Empty-cell → "Assign pairing…" picker.
 *
 * Filters uncrewed pairings whose startDate matches the selected date AND
 * have at least one missing seat this crew is eligible to fill. Clicking
 * a row creates the assignment on the seat with the smallest rankOrder
 * that matches — so (for example) a Captain gets slotted into the
 * Captain seat before falling back to a downrank candidate.
 */
export function AssignPairingDialog({ crewId, dateIso, onClose, onAfterMutate }: Props) {
  const pairings = useCrewScheduleStore((s) => s.pairings)
  const uncrewed = useCrewScheduleStore((s) => s.uncrewed)
  const crewList = useCrewScheduleStore((s) => s.crew)
  const positions = useCrewScheduleStore((s) => s.positions)
  const aircraftTypes = useCrewScheduleStore((s) => s.aircraftTypes)
  const tempBases = useCrewScheduleStore((s) => s.tempBases)
  const setAssignmentBlocked = useCrewScheduleStore((s) => s.setAssignmentBlocked)
  const reconcilePeriod = useCrewScheduleStore((s) => s.reconcilePeriod)
  const fmtDate = useDateFormat()

  const crew = useMemo(() => crewList.find((c) => c._id === crewId) ?? null, [crewList, crewId])
  const positionsById = useMemo(() => new Map(positions.map((p) => [p._id, p])), [positions])
  const pairingsById = useMemo(() => new Map(pairings.map((p) => [p._id, p])), [pairings])

  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  /** For each uncrewed pairing starting on this date, find which missing
   *  seat this crew is eligible for (smallest rankOrder match). */
  const candidates = useMemo(() => {
    if (!crew) return []
    type Row = {
      pairingId: string
      pairingCode: string
      routeChain: string
      seatPositionId: string
      seatCode: string
    }
    const out: Row[] = []
    for (const u of uncrewed) {
      if (u.startDate !== dateIso) continue
      const pairing = pairingsById.get(u.pairingId)
      if (!pairing) continue

      const eligibleSeats = u.missing
        .map((m) => positionsById.get(m.seatPositionId))
        .filter((s): s is NonNullable<typeof s> => !!s)
        .filter((s) => isEligibleForSeat(crew, s, positionsById))
        .sort((a, b) => a.rankOrder - b.rankOrder) // exact match first

      if (eligibleSeats.length === 0) continue

      const seat = eligibleSeats[0]
      const routeChain =
        pairing.routeChain ||
        (pairing.legs.length > 0
          ? [pairing.legs[0].depStation, ...pairing.legs.map((l) => l.arrStation)].join('-')
          : '—')

      out.push({
        pairingId: pairing._id,
        pairingCode: pairing.pairingCode,
        routeChain,
        seatPositionId: seat._id,
        seatCode: seat.code,
      })
    }
    return out
  }, [crew, uncrewed, dateIso, pairingsById, positionsById])

  const onPick = async (c: (typeof candidates)[number]) => {
    if (busy) return
    if (crew) {
      const pairing = pairingsById.get(c.pairingId)
      if (pairing) {
        const { hardBlocks } = partitionViolations(
          checkAssignmentViolations({
            crew,
            pairing,
            aircraftTypes,
            tempBases: tempBases.filter((t) => t.crewId === crew._id),
          }),
        )
        if (hardBlocks.length > 0) {
          setAssignmentBlocked({ violations: hardBlocks })
          onClose()
          return
        }
      }
    }
    setBusy(c.pairingId)
    setError(null)
    try {
      await api.createCrewAssignment({
        pairingId: c.pairingId,
        crewId,
        seatPositionId: c.seatPositionId,
        seatIndex: 0,
      })
      await reconcilePeriod()
      onAfterMutate()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <DialogShell
      title="Assign pairing"
      onClose={onClose}
      width={520}
      bodyPadding={false}
      footer={<DialogCancelButton onClick={onClose} disabled={!!busy} label="Close" />}
    >
      <div className="px-5 py-4">
        <div className="text-[13px] text-hz-text-secondary mb-3">
          {crew ? (
            <>
              <span className="font-semibold">
                {crew.lastName} {crew.firstName}
              </span>
              <span className="text-hz-text-tertiary"> · {fmtDate(dateIso)}</span>
            </>
          ) : (
            <span className="text-hz-text-tertiary">Crew not found</span>
          )}
        </div>

        {error && (
          <div
            className="mb-3 p-2 rounded-md text-[13px]"
            style={{ backgroundColor: 'rgba(255,59,59,0.18)', color: '#FF6A6A' }}
          >
            {error}
          </div>
        )}

        {candidates.length === 0 ? (
          <div className="text-[13px] text-hz-text-tertiary py-8 text-center">
            No uncrewed pairings match this crew for this date.
          </div>
        ) : (
          <div className="space-y-1 max-h-[50vh] overflow-y-auto">
            {candidates.map((c) => (
              <button
                key={c.pairingId}
                onClick={() => onPick(c)}
                disabled={!!busy}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-hz-border/20 text-left disabled:opacity-50 transition-colors"
              >
                <Plane className="w-4 h-4 shrink-0" style={{ color: 'var(--module-accent)' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold tabular-nums truncate">{c.pairingCode}</div>
                  <div className="text-[13px] text-hz-text-tertiary tabular-nums truncate">{c.routeChain}</div>
                </div>
                <span
                  className="inline-flex items-center h-6 px-2 rounded-md text-[13px] font-bold tabular-nums shrink-0"
                  style={{
                    background: 'color-mix(in srgb, var(--module-accent) 20%, transparent)',
                    color: 'var(--module-accent)',
                  }}
                >
                  {c.seatCode}
                </span>
                {busy === c.pairingId && <span className="text-[13px] text-hz-text-tertiary">…</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </DialogShell>
  )
}
