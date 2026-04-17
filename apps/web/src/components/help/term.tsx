'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { lookupTerm, type GlossaryEntry } from './glossary'

interface TermProps {
  children: string
  definition?: string
  full?: string
}

export function Term({ children, definition: definitionProp, full: fullProp }: TermProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const anchorRef = useRef<HTMLSpanElement | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const entry: GlossaryEntry | undefined =
    definitionProp || fullProp
      ? { term: children, full: fullProp, definition: definitionProp ?? '' }
      : lookupTerm(children)

  const show = () => {
    if (!anchorRef.current) return
    timerRef.current = setTimeout(() => {
      const rect = anchorRef.current!.getBoundingClientRect()
      setCoords({ x: rect.left + rect.width / 2, y: rect.top - 8 })
      setVisible(true)
    }, 200)
  }

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  return (
    <>
      <span
        ref={anchorRef}
        tabIndex={0}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={[
          'inline-flex items-baseline',
          'border-b border-dashed border-module-accent/60',
          'cursor-help',
          'text-inherit',
          'focus:outline-none focus:ring-2 focus:ring-module-accent focus:ring-offset-0 rounded-sm',
        ].join(' ')}
      >
        {children}
      </span>

      {mounted &&
        visible &&
        entry &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              left: coords.x,
              top: coords.y,
              transform: 'translate(-50%, -100%)',
              zIndex: 10000,
              pointerEvents: 'none',
            }}
            className={[
              'max-w-[280px] px-3 py-2 rounded-lg',
              'bg-hz-card backdrop-blur-xl',
              'border border-hz-border',
              'shadow-[0_8px_24px_rgba(0,0,0,0.20)]',
              'text-[13px] text-hz-text leading-snug',
            ].join(' ')}
          >
            <div className="font-semibold text-module-accent">
              {entry.term}
              {entry.full ? <span className="text-hz-text-secondary font-normal"> — {entry.full}</span> : null}
            </div>
            {entry.definition ? <div className="mt-1 text-hz-text-secondary">{entry.definition}</div> : null}
          </div>,
          document.body,
        )}
    </>
  )
}
