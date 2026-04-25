// Shared scroll values for the Gantt body, time header, and row labels.
// All three Skia canvases read scrollX / scrollY from this context so the
// header (sticky top) and row labels (sticky left) stay glued to the body
// during pan without any JS bridge round-trip.

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useSharedValue, type SharedValue } from 'react-native-reanimated'

interface GanttScrollContextValue {
  scrollX: SharedValue<number>
  scrollY: SharedValue<number>
}

const GanttScrollContext = createContext<GanttScrollContextValue | null>(null)

export function GanttScrollProvider({ children }: { children: ReactNode }) {
  const scrollX = useSharedValue(0)
  const scrollY = useSharedValue(0)
  const value = useMemo(() => ({ scrollX, scrollY }), [scrollX, scrollY])
  return <GanttScrollContext.Provider value={value}>{children}</GanttScrollContext.Provider>
}

export function useGanttScroll(): GanttScrollContextValue {
  const ctx = useContext(GanttScrollContext)
  if (!ctx) throw new Error('useGanttScroll outside of GanttScrollProvider')
  return ctx
}
