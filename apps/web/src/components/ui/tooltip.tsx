// SkyHub — Global Tooltip Component
// Dark bg + white text in Light Mode, Light bg + dark text in Dark Mode
// Appears on hover with 400ms delay, positioned above the trigger

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: string
  children: React.ReactElement<{ onMouseEnter?: React.MouseEventHandler; onMouseLeave?: React.MouseEventHandler }>
  delay?: number
  /** Let the tooltip wrap onto multiple lines. Content may contain `\n`. */
  multiline?: boolean
  /** Max width in px when multiline. Default 280. */
  maxWidth?: number
}

export function Tooltip({ content, children, delay = 400, multiline = false, maxWidth = 280 }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(
    (e: React.MouseEvent) => {
      const el = e.currentTarget as HTMLElement
      timerRef.current = setTimeout(() => {
        const rect = el.getBoundingClientRect()
        setCoords({
          x: rect.left + rect.width / 2,
          y: rect.top - 6,
        })
        setVisible(true)
      }, delay)
    },
    [delay],
  )

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (!content) return children

  return (
    <>
      {React.cloneElement(children, {
        onMouseEnter: (e: React.MouseEvent) => {
          show(e)
          children.props.onMouseEnter?.(e)
        },
        onMouseLeave: (e: React.MouseEvent) => {
          hide()
          children.props.onMouseLeave?.(e)
        },
      })}
      {visible &&
        createPortal(
          <TooltipPortal x={coords.x} y={coords.y} content={content} multiline={multiline} maxWidth={maxWidth} />,
          document.body,
        )}
    </>
  )
}

function TooltipPortal({
  x,
  y,
  content,
  multiline,
  maxWidth,
}: {
  x: number
  y: number
  content: string
  multiline: boolean
  maxWidth: number
}) {
  const isDark = document.documentElement.classList.contains('dark')

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
          padding: multiline ? '10px 12px' : '6px 12px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: multiline ? 400 : 500,
          lineHeight: multiline ? 1.45 : 1.2,
          fontFamily: 'Inter, system-ui, sans-serif',
          whiteSpace: multiline ? 'pre-line' : 'nowrap',
          maxWidth: multiline ? maxWidth : undefined,
          boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.15)',
          backdropFilter: 'blur(20px) saturate(1.6)',
          background: isDark ? 'rgba(244,244,245,0.95)' : 'rgba(24,24,27,0.92)',
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
