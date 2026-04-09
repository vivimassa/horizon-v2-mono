import { useEffect } from 'react'
import { useGanttStore } from '@/stores/use-gantt-store'

/** Set by GanttShell to toggle search panel */
let _toggleSearch: (() => void) | null = null
export function registerSearchToggle(fn: () => void) { _toggleSearch = fn }
export function unregisterSearchToggle() { _toggleSearch = null }

export function useGanttKeyboard() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+F — open search (intercept before browser Find, even in inputs)
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        _toggleSearch?.()
        return
      }

      // Don't intercept when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const state = useGanttStore.getState()

      // Alt+A — assign selected flights to this aircraft row
      if (e.altKey && (e.key === 'a' || e.key === 'A' || e.code === 'KeyA')) {
        e.preventDefault()
        if (state.selectedFlightIds.size > 0 && state.layout) {
          const [firstId] = state.selectedFlightIds
          const bar = state.layout.bars.find(b => b.flightId === firstId)
          const row = bar ? state.layout.rows[bar.row] : null
          if (row?.registration) {
            const flightIds = [...state.selectedFlightIds]
            state.assignToAircraft(flightIds, row.registration)
          }
        }
        return
      }

      // Alt+D — unassign selected flights from aircraft
      if (e.altKey && (e.key === 'd' || e.key === 'D' || e.code === 'KeyD')) {
        e.preventDefault()
        if (state.selectedFlightIds.size > 0) {
          const flightIds = [...state.selectedFlightIds]
          state.unassignFromAircraft(flightIds)
        }
        return
      }

      // Del — cancel selected flight(s) from date
      if (e.key === 'Delete') {
        e.preventDefault()
        if (state.selectedFlightIds.size > 0) {
          state.openCancelDialog([...state.selectedFlightIds])
        }
        return
      }

      // Alt+S — enter swap mode
      if (e.altKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) {
        e.preventDefault()
        if (state.selectedFlightIds.size > 0 && !state.swapMode) {
          state.enterSwapMode()
        }
        return
      }

      if (e.key === 'F1') {
        e.preventDefault()
        // Context menu open → open info for that flight
        if (state.contextMenu) {
          state.openFlightInfo(state.contextMenu.flightId)
          return
        }
        // Single flight selected → open its info
        if (state.selectedFlightIds.size === 1) {
          const [flightId] = state.selectedFlightIds
          state.openFlightInfo(flightId)
        }
      }

      if (e.key === 'F2') {
        e.preventDefault()
        if (state.aircraftContextMenu) {
          const { x, y, registration, aircraftTypeIcao } = state.aircraftContextMenu
          state.closeAircraftContextMenu()
          state.openAircraftPopover(x, y, registration, aircraftTypeIcao)
        }
      }

      if (e.key === 'F3') {
        e.preventDefault()
        if (state.dayContextMenu) {
          const { x, y, date } = state.dayContextMenu
          state.closeDayContextMenu()
          state.openDailySummary(x, y, date)
        }
      }

      if (e.key === 'F4') {
        e.preventDefault()
        if (state.rowContextMenu) {
          const { x, y, registration, aircraftTypeIcao, date } = state.rowContextMenu
          state.closeRowContextMenu()
          state.openRotationPopover(x, y, registration, aircraftTypeIcao, date)
        }
      }

      if (e.key === 'Escape') {
        if (state.cancelDialog) { state.closeCancelDialog(); return }
        if (state.swapDialog) { state.closeSwapDialog(); state.exitSwapMode(); return }
        if (state.swapMode) { state.exitSwapMode(); return }
        if (state.flightInfoDialogId) { state.closeFlightInfo(); return }
        if (state.rotationPopover) { state.closeRotationPopover(); return }
        if (state.dailySummaryPopover) { state.closeDailySummary(); return }
        if (state.aircraftPopover) { state.closeAircraftPopover(); return }
        if (state.rowContextMenu) { state.closeRowContextMenu(); return }
        if (state.dayContextMenu) { state.closeDayContextMenu(); return }
        if (state.aircraftContextMenu) { state.closeAircraftContextMenu(); return }
        if (state.contextMenu) { state.closeContextMenu(); return }
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])
}
