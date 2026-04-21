'use client'

import { useEffect, useRef } from 'react'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'

/**
 * Drag handle between the crew Gantt canvas and the uncrewed-duties tray.
 *
 * UX:
 *   • 16px-tall invisible hit band (visible 3px pill centered) — forgiving
 *     click target.
 *   • Live store updates throttled to animation frames so React renders at
 *     most once per paint. The tray re-renders per frame; its internal
 *     layout is memoised on stable inputs so only the outer wrapper's
 *     height actually recomputes.
 *   • Cursor + selection are locked during the drag so the browser doesn't
 *     fight the gesture.
 */
interface Props {
  frameHeight: number
}

export function UncrewedTrayResizer({ frameHeight }: Props) {
  const setUncrewedTrayHeight = useCrewScheduleStore((s) => s.setUncrewedTrayHeight)
  const dragRef = useRef<{
    startY: number
    startHeight: number
    lastHeight: number
    raf: number
  } | null>(null)

  // Stable listener refs so addEventListener / removeEventListener match
  // across renders. Logic lives in the ref; the bridges just call it.
  const onMoveImplRef = useRef<(e: MouseEvent) => void>(() => {})
  const onUpImplRef = useRef<() => void>(() => {})

  useEffect(() => {
    onMoveImplRef.current = (e: MouseEvent) => {
      const d = dragRef.current
      if (!d) return
      e.preventDefault()
      const dy = d.startY - e.clientY // drag up grows tray
      const raw = d.startHeight + dy
      const maxH = frameHeight > 0 ? Math.max(120, Math.round(frameHeight * 0.75)) : 800
      const next = Math.max(48, Math.min(maxH, raw))
      d.lastHeight = next
      // rAF-coalesce so even if the OS fires mousemove at 500 Hz we only
      // commit once per paint. Applies the height via the store, which
      // React renders consistently with the DOM (no imperative divergence).
      if (!d.raf) {
        d.raf = requestAnimationFrame(() => {
          if (dragRef.current) dragRef.current.raf = 0
          setUncrewedTrayHeight(next)
        })
      }
    }
    onUpImplRef.current = () => {
      const d = dragRef.current
      if (d) {
        if (d.raf) cancelAnimationFrame(d.raf)
        // Final commit — ensures the last pixel lands even if a rAF was
        // pending at release.
        setUncrewedTrayHeight(d.lastHeight)
        dragRef.current = null
      }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', moveBridge, true)
      window.removeEventListener('mouseup', upBridge, true)
    }
  }, [frameHeight, setUncrewedTrayHeight])

  function moveBridge(e: MouseEvent) {
    onMoveImplRef.current(e)
  }
  function upBridge() {
    onUpImplRef.current()
  }

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    const startHeight = useCrewScheduleStore.getState().uncrewedTrayHeight
    dragRef.current = {
      startY: e.clientY,
      startHeight,
      lastHeight: startHeight,
      raf: 0,
    }
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', moveBridge, true)
    window.addEventListener('mouseup', upBridge, true)
  }

  return (
    <div
      className="shrink-0 relative group cursor-row-resize select-none"
      // 16px invisible hit band; marginTop/Bottom of -5 makes it overlap
      // 5px into the canvas above and 5px into the tray below without
      // affecting layout, so the click target is forgiving.
      style={{ height: 10, marginTop: -5, marginBottom: -5, zIndex: 10 }}
      onMouseDown={handleMouseDown}
      title="Drag to resize uncrewed tray"
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="rounded-full transition-colors group-hover:bg-module-accent"
          style={{
            width: 40,
            height: 3,
            background: 'rgba(125,125,140,0.55)',
          }}
        />
      </div>
    </div>
  )
}
