'use client'

import { api, type ApiError } from '@skyhub/api'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'

/**
 * Dispatch a target-picker row click to the right mode handler.
 *
 * Modes:
 *   - copy-pairing: POST a new assignment for the target crew using the
 *     source pairing + seat position + next free seat index.
 *   - copy-block:   For every assignment the source crew has overlapping
 *     [fromIso, toIso], POST a copy for the target crew.
 *   - move-block:   PATCH every overlapping assignment to the target crew.
 *   - swap-block:   POST /crew-schedule/assignments/swap-block (server
 *     atomically swaps both sides in a transaction).
 *
 * Capacity errors surface through the existing CapacityErrorDialog via
 * the store's `setCapacityError` action, matching Ctrl-drag Copy.
 */
export function dispatchTargetPicker(targetCrewId: string): void {
  const s = useCrewScheduleStore.getState()
  const mode = s.targetPickerMode
  if (!mode) return
  if (mode.sourceCrewId === targetCrewId) {
    // Picking source again = no-op; leave mode active so the user can
    // retry with a different row.
    return
  }

  const runReconcile = () => useCrewScheduleStore.getState().reconcilePeriod()
  const handleCapacityError = (err: unknown): boolean => {
    const apiErr = err as ApiError
    const payload = apiErr?.payload as
      | {
          code?: string
          seatCode?: string
          capacity?: number
          attemptedIndex?: number
          pairingCode?: string | null
        }
      | null
      | undefined
    if (
      payload &&
      payload.code === 'capacity_exceeded' &&
      typeof payload.seatCode === 'string' &&
      typeof payload.capacity === 'number' &&
      typeof payload.attemptedIndex === 'number'
    ) {
      useCrewScheduleStore.getState().setCapacityError({
        seatCode: payload.seatCode,
        capacity: payload.capacity,
        attemptedIndex: payload.attemptedIndex,
        pairingCode: payload.pairingCode ?? null,
      })
      return true
    }
    return false
  }

  if (mode.kind === 'copy-pairing') {
    const src = s.assignments.find((a) => a._id === mode.sourceAssignmentId)
    if (!src) {
      useCrewScheduleStore.getState().clearTargetPickerMode()
      return
    }
    const pairingAssignments = s.assignments.filter(
      (a) => a.pairingId === src.pairingId && a.seatPositionId === src.seatPositionId && a.status !== 'cancelled',
    )
    const usedIndices = new Set(pairingAssignments.map((a) => a.seatIndex))
    let seatIndex = 0
    while (usedIndices.has(seatIndex)) seatIndex += 1

    useCrewScheduleStore.getState().clearTargetPickerMode()
    void (async () => {
      try {
        await api.createCrewAssignment({
          pairingId: src.pairingId,
          crewId: targetCrewId,
          seatPositionId: src.seatPositionId,
          seatIndex,
          status: 'planned',
        })
        void runReconcile()
      } catch (err) {
        if (handleCapacityError(err)) return
        console.error('Duplicate-to-crew failed:', err)
        void runReconcile()
      }
    })()
    return
  }

  // Block modes — gather every overlapping assignment for the source crew.
  const fromIso = mode.fromIso
  const toIso = mode.toIso
  const inRange = s.assignments.filter(
    (a) =>
      a.crewId === mode.sourceCrewId &&
      a.startUtcIso.slice(0, 10) <= toIso &&
      a.endUtcIso.slice(0, 10) >= fromIso &&
      a.status !== 'cancelled',
  )

  if (mode.kind === 'copy-block') {
    if (inRange.length === 0) {
      useCrewScheduleStore.getState().clearTargetPickerMode()
      return
    }
    useCrewScheduleStore.getState().clearTargetPickerMode()
    void (async () => {
      for (const src of inRange) {
        const pairingAssignments = useCrewScheduleStore
          .getState()
          .assignments.filter(
            (a) => a.pairingId === src.pairingId && a.seatPositionId === src.seatPositionId && a.status !== 'cancelled',
          )
        const usedIndices = new Set(pairingAssignments.map((a) => a.seatIndex))
        let seatIndex = 0
        while (usedIndices.has(seatIndex)) seatIndex += 1
        try {
          await api.createCrewAssignment({
            pairingId: src.pairingId,
            crewId: targetCrewId,
            seatPositionId: src.seatPositionId,
            seatIndex,
            status: 'planned',
          })
        } catch (err) {
          if (handleCapacityError(err)) break
          console.error('Copy-block failed on one row:', err)
        }
      }
      void runReconcile()
    })()
    return
  }

  if (mode.kind === 'move-block') {
    if (inRange.length === 0) {
      useCrewScheduleStore.getState().clearTargetPickerMode()
      return
    }
    useCrewScheduleStore.getState().clearTargetPickerMode()
    void (async () => {
      for (const src of inRange) {
        try {
          await api.patchCrewAssignment(src._id, { crewId: targetCrewId })
        } catch (err) {
          if (handleCapacityError(err)) break
          console.error('Move-block failed on one row:', err)
        }
      }
      void runReconcile()
    })()
    return
  }

  if (mode.kind === 'swap-block') {
    useCrewScheduleStore.getState().clearTargetPickerMode()
    void (async () => {
      try {
        await api.swapCrewAssignmentsBlock({
          sourceCrewId: mode.sourceCrewId,
          targetCrewId,
          fromIso: mode.fromIso,
          toIso: mode.toIso,
        })
      } catch (err) {
        if (handleCapacityError(err)) return
        console.error('Swap-block failed:', err)
      } finally {
        void runReconcile()
      }
    })()
    return
  }
}
