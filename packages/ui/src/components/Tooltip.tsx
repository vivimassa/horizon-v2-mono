// SkyHub — Global Tooltip Component
// Dark bg + white text in Light Mode, Light bg + dark text in Dark Mode
// Appears on hover with 400ms delay, positioned above the trigger

import React, { useState, useRef, useCallback, useEffect } from 'react'

interface TooltipProps {
  content: string
  children: React.ReactNode
  delay?: number
}

export function Tooltip({ content, children, delay = 400 }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        setCoords({
          x: rect.left + rect.width / 2,
          y: rect.top - 6,
        })
        setVisible(true)
      }
    }, delay)
  }, [delay])

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (!content) return <>{children}</>

  return (
    <>
      <div ref={triggerRef} onMouseEnter={show} onMouseLeave={hide} style={{ display: 'contents' }}>
        {children}
      </div>
      {visible && <TooltipPortal x={coords.x} y={coords.y} content={content} />}
    </>
  )
}

function TooltipPortal({ x, y, content }: { x: number; y: number; content: string }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || typeof document === 'undefined') return null

  const isDark = document.documentElement.classList.contains('dark')

  const el = document.createElement('div')

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        transform: 'translate(-50%, -100%)',
        zIndex: 10000,
        pointerEvents: 'none',
        animation: 'skyhub-tooltip-in 120ms ease-out',
      }}
    >
      <div
        style={{
          padding: '6px 12px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.15)',
          backdropFilter: 'blur(20px) saturate(1.6)',
          background: isDark ? 'rgba(244,244,245,0.92)' : 'rgba(24,24,27,0.88)',
          color: isDark ? '#18181b' : '#fafafa',
        }}
      >
        {content}
      </div>
      {/* Arrow */}
      <div
        style={{
          width: 0,
          height: 0,
          margin: '0 auto',
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: isDark ? '5px solid rgba(244,244,245,0.92)' : '5px solid rgba(24,24,27,0.88)',
        }}
      />
    </div>
  )
}
