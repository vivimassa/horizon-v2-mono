'use client'

import { useEffect, useState } from 'react'
import { useTheme } from '@/components/theme-provider'
import { useDockStore } from '@/lib/dock-store'
import { WorldMapCanvas } from './world-map-canvas'
import { WorldMapClockDock } from './world-map-clock-dock'

function useUiZoom(): number {
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    function calc() {
      const w = window.innerWidth
      const z = Math.max(0.75, Math.min(w / 1920, 1.5))
      setZoom(Math.round(z * 100) / 100)
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])
  return zoom
}

export function WorldMapShell() {
  const uiZoom = useUiZoom()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // Auto-collapse the bottom nav dock on this page (focus workspace).
  useEffect(() => {
    useDockStore.getState().collapse()
  }, [])

  return (
    <div className="wm-root fixed inset-0 z-0">
      <WorldMapCanvas isDark={isDark} uiZoom={uiZoom} />
      <WorldMapClockDock />
    </div>
  )
}
