import { useEffect } from 'react'
import { useGanttStore } from '@/stores/use-gantt-store'

export function useGanttKeyboard() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const state = useGanttStore.getState()

      // Ctrl+A — assign to this aircraft (prevent Chrome select-all)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        if (state.selectedFlightIds.size > 0 && state.layout) {
          // Find the row registration of the first selected flight
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
