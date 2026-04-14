'use client'

import { useEffect, useState } from 'react'
import * as Lucide from 'lucide-react'

export interface DockItem {
  id: string
  label: string
  icon: keyof typeof Lucide
  accent: string
}

const iconMap = Lucide as unknown as Record<string, Lucide.LucideIcon>

// Visual constants
const ICON_SIZE = 28
const GAP = 96 // vertical space between nodes (px)
const LINE_X = ICON_SIZE / 2 // line sits through the icon center

export function ProductsDock({ items }: { items: DockItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? '')

  useEffect(() => {
    const els = items
      .map((i) => ({ id: i.id, el: document.getElementById(i.id) }))
      .filter((x): x is { id: string; el: HTMLElement } => !!x.el)
    if (els.length === 0) return

    let raf = 0
    let lastActive = ''

    /**
     * Stable scrollspy: the active section is the one whose top edge
     * is ABOVE the trigger line (40% from viewport top) and whose bottom
     * edge is still below it. Exactly one section can satisfy this at a
     * time — no ping-ponging between adjacent sections on scroll.
     *
     * Edge cases: above the first section's trigger crossing → first
     * section is active. Past the last section → last stays active.
     */
    const update = () => {
      raf = 0
      const trigger = window.innerHeight * 0.3
      let candidate = els[0].id

      for (const { id, el } of els) {
        const rect = el.getBoundingClientRect()
        if (rect.top <= trigger) candidate = id
        else break // sections are in document order — no need to check further
      }

      if (candidate !== lastActive) {
        lastActive = candidate
        setActive(candidate)
      }
    }

    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [items])

  function jumpTo(id: string) {
    const el = document.getElementById(id)
    if (!el) return
    const headerOffset = 32
    const top = el.getBoundingClientRect().top + window.scrollY - headerOffset
    window.scrollTo({ top, behavior: 'smooth' })
  }

  return (
    <aside aria-label="Product sections" className="hidden lg:block fixed left-10 top-1/2 -translate-y-1/2 z-30">
      <div className="relative">
        {/* Thin connecting line — runs through icon centers */}
        <div
          aria-hidden
          className="absolute"
          style={{
            left: LINE_X - 0.5,
            top: ICON_SIZE / 2,
            bottom: ICON_SIZE / 2,
            width: 1,
            background:
              'linear-gradient(180deg, transparent 0%, rgba(127,127,155,0.28) 12%, rgba(127,127,155,0.28) 88%, transparent 100%)',
          }}
        />

        <div className="flex flex-col" style={{ gap: GAP }}>
          {items.map((item) => {
            const Icon = iconMap[item.icon] ?? Lucide.Box
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => jumpTo(item.id)}
                aria-label={item.label}
                className="group relative flex items-center gap-7 cursor-pointer bg-transparent border-0 p-0 outline-none"
              >
                {/* Icon column — fixed width, padded hit area */}
                <span
                  className="relative flex items-center justify-center shrink-0"
                  style={{ width: ICON_SIZE, height: ICON_SIZE }}
                >
                  {/* Glow halo — always rendered; fades in on active */}
                  <span
                    aria-hidden
                    className="absolute pointer-events-none"
                    style={{
                      left: -18,
                      top: -18,
                      width: ICON_SIZE + 36,
                      height: ICON_SIZE + 36,
                      borderRadius: '50%',
                      background: `radial-gradient(circle, ${item.accent}55 0%, ${item.accent}18 40%, transparent 70%)`,
                      filter: 'blur(8px)',
                      opacity: isActive ? 1 : 0,
                      transition: 'opacity 520ms cubic-bezier(0.4, 0, 0.2, 1)',
                      animation: isActive ? 'mktDockPulse 2.8s ease-in-out infinite' : 'none',
                    }}
                  />

                  <Icon
                    size={ICON_SIZE}
                    strokeWidth={1.5}
                    className="relative z-10 pointer-events-none"
                    style={{
                      color: isActive ? item.accent : 'rgba(127,127,155,0.55)',
                      filter: isActive
                        ? `drop-shadow(0 0 10px ${item.accent}) drop-shadow(0 0 20px ${item.accent}80)`
                        : 'drop-shadow(0 0 0 transparent)',
                      transform: isActive ? 'scale(1.08)' : 'scale(1)',
                      transition:
                        'color 520ms cubic-bezier(0.4, 0, 0.2, 1), filter 520ms cubic-bezier(0.4, 0, 0.2, 1), transform 520ms cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                </span>

                {/* Label */}
                <span
                  className="text-[15px] font-semibold tracking-tight whitespace-nowrap"
                  style={{
                    color: isActive ? 'var(--mkt-text)' : 'rgba(127,127,155,0.70)',
                    opacity: isActive ? 1 : 0.78,
                    transform: isActive ? 'translateX(3px)' : 'translateX(0)',
                    letterSpacing: '-0.01em',
                    textShadow: isActive ? `0 0 24px ${item.accent}50` : '0 0 0 transparent',
                    transition:
                      'color 520ms cubic-bezier(0.4, 0, 0.2, 1), opacity 520ms cubic-bezier(0.4, 0, 0.2, 1), transform 520ms cubic-bezier(0.4, 0, 0.2, 1), text-shadow 520ms cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>

        <style>{`
          @keyframes mktDockPulse {
            0%, 100% { opacity: 0.85; transform: scale(1); }
            50%      { opacity: 1;    transform: scale(1.08); }
          }
          aside[aria-label="Product sections"] button:hover svg {
            color: var(--mkt-text) !important;
          }
          aside[aria-label="Product sections"] button:hover span:last-child {
            color: var(--mkt-text) !important;
            opacity: 1 !important;
          }
        `}</style>
      </div>
    </aside>
  )
}
