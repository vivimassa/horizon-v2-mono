import { useEffect } from 'react'
import { useGanttStore } from '@/stores/use-gantt-store'

export function useGanttKeyboard() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const state = useGanttStore.getState()

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

      if (e.key === 'Escape') {
        if (state.flightInfoDialogId) { state.closeFlightInfo(); return }
        if (state.contextMenu) { state.closeContextMenu(); return }
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])
}
