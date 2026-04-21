'use client'

import { useEffect, useMemo } from 'react'
import { api } from '@skyhub/api'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { usePairingStore } from '@/stores/use-pairing-store'
import { pairingFromApi } from '@/components/crew-ops/pairing/adapters'
import {
  PairingDetailsDialog,
  type AssignedCrewRow,
} from '@/components/crew-ops/pairing/dialogs/pairing-details-dialog'

/**
 * Host for the full 4.1.5.2 Pairing Details dialog, opened from the 4.1.6
 * Crew Schedule context menu. Responsibilities:
 *  1. Read the selected pairing from the schedule store.
 *  2. Adapt `PairingRef` → `Pairing` (the UI type) via the shared adapter.
 *  3. Derive the live "Crew Assigned" roster from `assignments` × `crew` ×
 *     `positions`, grouped cockpit-first then by rank order, so the dialog's
 *     Crew Assigned section stops rendering the 3.2.x placeholder.
 */
export function PairingDetailsDialogHost() {
  const dialog = useCrewScheduleStore((s) => s.pairingDetailsDialog)
  const close = useCrewScheduleStore((s) => s.closePairingDetailsDialog)
  const pairings = useCrewScheduleStore((s) => s.pairings)
  const assignments = useCrewScheduleStore((s) => s.assignments)
  const crew = useCrewScheduleStore((s) => s.crew)
  const positions = useCrewScheduleStore((s) => s.positions)

  const pairingRef = useMemo(
    () => (dialog ? (pairings.find((p) => p._id === dialog.pairingId) ?? null) : null),
    [dialog, pairings],
  )

  const uiPairing = useMemo(() => (pairingRef ? pairingFromApi(pairingRef) : null), [pairingRef])

  // The Pairing Details dialog reads positions + complements from
  // `usePairingStore`. When opened from 4.1.6 (without the pairing workspace
  // ever being mounted) that store is empty, which breaks the Complement
  // panel's active-code filter and leaves position pills uncoloured. Sync
  // what we already have in the 4.1.6 store + pull complements lazily.
  useEffect(() => {
    if (!dialog) return
    const pairingStore = usePairingStore.getState()
    if (pairingStore.positions.length === 0) {
      pairingStore.setPositions(positions)
    }
    if (pairingStore.complements.length === 0) {
      void api.getCrewComplements().then((c) => {
        usePairingStore.getState().setComplements(c)
      })
    }
  }, [dialog, positions])

  const assignedCrew = useMemo<AssignedCrewRow[]>(() => {
    if (!dialog) return []
    const crewById = new Map(crew.map((c) => [c._id, c]))
    const posById = new Map(positions.map((p) => [p._id, p]))
    const rows: AssignedCrewRow[] = []
    for (const a of assignments) {
      if (a.pairingId !== dialog.pairingId) continue
      const cm = crewById.get(a.crewId)
      if (!cm) continue
      const pos = posById.get(a.seatPositionId)
      rows.push({
        crewId: cm._id,
        firstName: cm.firstName,
        lastName: cm.lastName,
        employeeId: cm.employeeId,
        positionCode: pos?.code ?? '?',
        positionColor: pos?.color ?? null,
        baseLabel: cm.baseLabel ?? null,
        seniority: cm.seniority ?? null,
        status: a.status,
      })
    }
    // Cockpit first, then cabin; within each group, sort by the position's
    // rankOrder, then by crew last-name so the list reads consistently.
    const posByCode = new Map(positions.map((p) => [p.code, p]))
    rows.sort((a, b) => {
      const pa = posByCode.get(a.positionCode)
      const pb = posByCode.get(b.positionCode)
      const ca = pa?.category ?? 'zzz'
      const cb = pb?.category ?? 'zzz'
      if (ca !== cb) return ca === 'cockpit' ? -1 : cb === 'cockpit' ? 1 : ca.localeCompare(cb)
      const ra = pa?.rankOrder ?? 99
      const rb = pb?.rankOrder ?? 99
      if (ra !== rb) return ra - rb
      return a.lastName.localeCompare(b.lastName)
    })
    return rows
  }, [dialog, assignments, crew, positions])

  if (!dialog || !uiPairing) return null

  return <PairingDetailsDialog pairing={uiPairing} onClose={close} assignedCrew={assignedCrew} />
}
