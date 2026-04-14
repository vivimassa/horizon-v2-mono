'use client'

import { useEffect, useRef } from 'react'

export function HeroAurora({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--mkt-cursor-x', `${x}%`)
        el.style.setProperty('--mkt-cursor-y', `${y}%`)
      })
    }
    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <section
      ref={ref}
      className="relative overflow-hidden pt-14 pb-20 md:pt-20 md:pb-28"
      style={
        {
          '--mkt-cursor-x': '50%',
          '--mkt-cursor-y': '50%',
        } as React.CSSProperties
      }
    >
      <div className="mkt-aurora" />
      <div className="mkt-dots" />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(600px circle at var(--mkt-cursor-x) var(--mkt-cursor-y), rgba(62,123,250,0.10), transparent 40%)',
        }}
      />
      <div className="mkt-grain" />
      <div className="relative z-10 max-w-[1280px] mx-auto px-6">{children}</div>
    </section>
  )
}
