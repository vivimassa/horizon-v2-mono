'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import type { HoldKey, CargoHold, DockItem } from '@/types/cargo'
import { HoldTabs } from './HoldTabs'
import { AircraftSlider } from './AircraftSlider'
import { LoadingDock } from './LoadingDock'
import { ConnectorLine } from './ConnectorLine'

interface AircraftViewProps {
  aircraftType: string
  activeHold: HoldKey
  onSelectHold: (key: HoldKey) => void
  holds: Record<string, CargoHold>
  dockItems: DockItem[]
  accent: string
  isDark: boolean
  hasSelection: boolean
  children?: React.ReactNode
}

// Sequence: image (0s) → box (0.8s) → line (1.4s) → dock (1.8s)
type TransitionPhase = 'image' | 'box' | 'line' | 'dock' | 'done'

const HOLD_POSITIONS: Record<HoldKey, string> = {
  fwd: 'translateY(440px)',
  aft: 'translateY(-270px)',
  bulk: 'translateY(-460px)',
}
const OVERVIEW_POSITION = 'translateY(calc(30% - 200px)) scale(0.28)'

export function AircraftView({
  aircraftType,
  activeHold,
  onSelectHold,
  holds,
  dockItems,
  accent,
  isDark,
  hasSelection,
  children,
}: AircraftViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const kpiRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const [dotEl, setDotEl] = useState<HTMLButtonElement | null>(null)

  const handleDotRef = useCallback((el: HTMLButtonElement | null) => {
    setDotEl(el)
  }, [])

  // ── Sequenced transition ──
  const [phase, setPhase] = useState<TransitionPhase>('done')
  const prevHold = useRef(activeHold)
  const prevSelection = useRef(hasSelection)

  useEffect(() => {
    const holdChanged = activeHold !== prevHold.current
    const justSelected = hasSelection && !prevSelection.current

    prevHold.current = activeHold
    prevSelection.current = hasSelection

    if (holdChanged || justSelected) {
      setPhase('image')

      const t1 = setTimeout(() => setPhase('box'), 800)
      const t2 = setTimeout(() => setPhase('line'), 1400)
      const t3 = setTimeout(() => setPhase('dock'), 1800)
      const t4 = setTimeout(() => setPhase('done'), 2200)

      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
        clearTimeout(t3)
        clearTimeout(t4)
      }
    }

    // When deselected, reset immediately
    if (!hasSelection) {
      setPhase('done')
    }
  }, [activeHold, hasSelection])

  const showBox = hasSelection && (phase === 'box' || phase === 'line' || phase === 'dock' || phase === 'done')
  const showLine = hasSelection && (phase === 'line' || phase === 'dock' || phase === 'done')
  const showDock = hasSelection && (phase === 'dock' || phase === 'done')

  // Image transform
  const imageTransform = hasSelection ? HOLD_POSITIONS[activeHold] : OVERVIEW_POSITION

  // ── Drag state ──
  const [dockPos, setDockPos] = useState<{ x: number; y: number } | undefined>(undefined)
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  const clamp = useCallback((x: number, y: number) => {
    const container = containerRef.current
    const dock = dockRef.current
    const kpi = kpiRef.current
    if (!container || !dock) return { x, y }

    const cRect = container.getBoundingClientRect()
    const dW = dock.offsetWidth
    const dH = dock.offsetHeight

    const topMin = kpi ? kpi.getBoundingClientRect().bottom - cRect.top + 4 : 0
    const bottomMax = cRect.height - dH - 8
    const leftMin = 8
    const rightMax = cRect.width - dW - 8

    return {
      x: Math.max(leftMin, Math.min(rightMax, x)),
      y: Math.max(topMin, Math.min(bottomMax, y)),
    }
  }, [])

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const dock = dockRef.current
    const container = containerRef.current
    if (!dock || !container) return

    const cRect = container.getBoundingClientRect()
    const dRect = dock.getBoundingClientRect()

    const currentX = dRect.left - cRect.left
    const currentY = dRect.top - cRect.top

    dragOffset.current = {
      x: e.clientX - currentX,
      y: e.clientY - currentY,
    }

    setDockPos({ x: currentX, y: currentY })
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMove = (e: MouseEvent) => {
      const rawX = e.clientX - dragOffset.current.x
      const rawY = e.clientY - dragOffset.current.y
      setDockPos(clamp(rawX, rawY))
    }

    const handleUp = () => setIsDragging(false)

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [isDragging, clamp])

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-2xl overflow-hidden relative"
      style={{
        background: isDark
          ? 'linear-gradient(160deg, #2a2a32 0%, #252530 30%, #22222c 60%, #1e1e28 100%)'
          : 'linear-gradient(160deg, #e8ecf1 0%, #dde2e8 30%, #d0d5dc 60%, #c8cdd4 100%)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#c0c4ca'}`,
        borderRadius: 14,
      }}
    >
      {/* Radial highlight */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse 60% 45% at 50% 35%, rgba(255,255,255,0.04), transparent 70%)'
            : 'radial-gradient(ellipse 60% 45% at 50% 35%, rgba(255,255,255,0.3), transparent 70%)',
        }}
      />

      {/* Terminal background — overview mode only */}
      <div
        className="absolute inset-0 z-0 flex items-center justify-center"
        style={{
          opacity: hasSelection ? 0 : 1,
          transition: 'opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'none',
        }}
      >
        <img
          src={isDark ? '/assets/aircraft/Terminal_Dark.png' : '/assets/aircraft/Terminal_Light.png'}
          alt="Terminal gate"
          className="select-none"
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </div>

      {/* Aircraft image — hidden in overview, visible when selected */}
      <div
        className="absolute inset-0 z-[1] flex items-center justify-center"
        style={{
          transform: imageTransform,
          opacity: hasSelection ? 1 : 0,
          transition: 'transform 1.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 1s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <AircraftSlider
          aircraftType={aircraftType}
          activeHold={activeHold}
          onSelectHold={onSelectHold}
          accent={accent}
          isDark={isDark}
          onDotRef={handleDotRef}
          showBox={showBox}
          overviewMode={!hasSelection}
        />
      </div>

      {/* Connector line — only when flight selected */}
      <div
        style={{
          opacity: showLine ? 1 : 0,
          transition: 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <ConnectorLine containerRef={containerRef} dotRef={dotEl} dockRef={dockRef.current} accent={accent} />
      </div>

      {/* Hold tabs — fade in/out based on selection */}
      <div
        className="relative z-[2] pt-3 pb-1"
        style={{
          opacity: hasSelection ? 1 : 0,
          transition: 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: hasSelection ? 'auto' : 'none',
        }}
      >
        <HoldTabs activeHold={activeHold} onSelect={onSelectHold} holds={holds} accent={accent} isDark={isDark} />
      </div>

      {/* Boundary ref for dock drag clamping */}
      <div ref={kpiRef} className="relative z-[2]" />

      {/* Floating flight list panel */}
      <div
        className="absolute left-3 z-[5] flex flex-col justify-end"
        style={{
          top: hasSelection ? 110 : 12,
          bottom: 12,
          width: 300,
          transition: 'top 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {children}
      </div>

      {/* Loading dock — only when flight selected */}
      <div
        style={{
          opacity: showDock ? 1 : 0,
          transition: 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: showDock ? 'auto' : 'none',
        }}
      >
        <LoadingDock
          ref={dockRef}
          items={dockItems}
          accent={accent}
          isDark={isDark}
          position={dockPos}
          onDragStart={handleDragStart}
          isDragging={isDragging}
        />
      </div>
    </div>
  )
}
