'use client'

import { useRef } from 'react'
import { usePairingGanttStore } from '@/stores/use-pairing-gantt-store'

interface PairingZoneResizerProps {
  frameHeight: number
  /**
   * Imperative callback invoked on every drag frame. Mutates canvas + DOM
   * directly with the new ratio so React is NOT re-rendered during the
   * drag — the store is updated once on mouseup. This is what keeps the
   * canvases from flashing empty mid-drag: no React commit means no
   * layout-effect/ResizeObserver dance, just a single synchronous resize
   * + redraw per mouse event.
   */
  onDragResize?: (nextRatio: number) => void
}

/**
 * 6px drag handle between the grid canvas and the pairing zone. During a
 * drag it runs imperatively against DOM refs (see `onDragResize`), and only
 * commits the final ratio to the zustand store on mouseup — one React
 * render for the whole drag instead of one per mousemove.
 */
export function PairingZoneResizer({ frameHeight, onDragResize }: PairingZoneResizerProps) {
  const setZoneHeightRatio = usePairingGanttStore((s) => s.setZoneHeightRatio)
  const dragRef = useRef<{ startY: number; startRatio: number; lastRatio: number } | null>(null)

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault()
    const startRatio = usePairingGanttStore.getState().zoneHeightRatio
    dragRef.current = { startY: e.clientY, startRatio, lastRatio: startRatio }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function onMove(e: MouseEvent) {
    if (!dragRef.current || frameHeight === 0) return
    const dy = dragRef.current.startY - e.clientY // drag up grows zone
    const deltaRatio = dy / frameHeight
    const next = Math.min(0.6, Math.max(0.1, dragRef.current.startRatio + deltaRatio))
    dragRef.current.lastRatio = next
    onDragResize?.(next)
  }

  function onUp() {
    if (dragRef.current) {
      // Commit the final ratio to the store exactly once — this is the only
      // React render triggered by the whole drag.
      setZoneHeightRatio(dragRef.current.lastRatio)
      dragRef.current = null
    }
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  return (
    <div
      className="shrink-0 flex items-center justify-center group cursor-row-resize hover:bg-module-accent/10 transition-colors"
      style={{ height: 6 }}
      onMouseDown={handleMouseDown}
      title="Drag to resize pairing zone"
    >
      <div
        className="rounded-full transition-colors group-hover:bg-module-accent/60"
        style={{
          width: 32,
          height: 3,
          background: 'rgba(125,125,140,0.5)',
        }}
      />
    </div>
  )
}
