'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import * as LucideIcons from 'lucide-react'
import { MODULE_REGISTRY, MODULE_THEMES, type ModuleEntry } from '@skyhub/constants'
import { useRouter, useSearchParams } from 'next/navigation'
import { WallpaperBg } from '@/components/wallpaper-bg'
import { useTheme } from '@/components/theme-provider'
import { UserMenu } from '@/components/UserMenu'
import { revealNavigate, supportsViewTransitions } from '@/lib/nav-transition'

/* ═══════════════════════════════════════════════
   Data
   ═══════════════════════════════════════════════ */

interface DomainCard {
  key: string
  label: string
  description: string
  icon: string
  href: string
  module: string
  image: string
}

const DOMAINS: DomainCard[] = [
  {
    key: 'network',
    label: 'Network',
    description: 'Routes, schedules, fleet planning & slot management',
    icon: 'Route',
    href: '/network',
    module: 'network',
    image: 'https://images.unsplash.com/photo-1533456307239-052e029c1362?w=1920&q=80&auto=format&fit=crop',
  },
  {
    key: 'flightops',
    label: 'Flight Ops',
    description: 'Movement control, OOOI tracking & daily operations',
    icon: 'Plane',
    href: '/flight-ops',
    module: 'operations',
    image: '/assets/domains/flight-ops.png',
  },
  {
    key: 'groundops',
    label: 'Ground Ops',
    description: 'Cargo, turnaround, fueling & ramp coordination',
    icon: 'Truck',
    href: '/ground-ops',
    module: 'ground',
    image: 'https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?w=1920&q=80&auto=format&fit=crop',
  },
  {
    key: 'crewops',
    label: 'Crew Ops',
    description: 'Rostering, pairing, FDTL & crew tracking',
    icon: 'Users',
    href: '/crew-ops',
    module: 'workforce',
    image: 'https://images.unsplash.com/photo-1503468120394-03d29a34a0bf?w=1920&q=80&auto=format&fit=crop',
  },
  {
    key: 'settings',
    label: 'Settings',
    description: 'Master data, users, roles & operator config',
    icon: 'Settings',
    href: '/settings',
    module: 'admin',
    image: '/assets/domains/settings.png',
  },
]

interface SectionGroup {
  section: ModuleEntry
  children: ModuleEntry[]
}

function buildTree(mod: string): SectionGroup[] {
  return MODULE_REGISTRY.filter((m) => m.module === mod && m.level === 1)
    .map((s) => ({ section: s, children: MODULE_REGISTRY.filter((m) => m.parent_code === s.code && m.level === 2) }))
    .filter((g) => g.children.length > 0)
}

const TREES = Object.fromEntries(DOMAINS.map((d) => [d.key, buildTree(d.module)]))

const iconMap = LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>
function getIcon(name: string): LucideIcons.LucideIcon {
  return iconMap[name] ?? LucideIcons.Box
}

/* ═══════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════ */

export default function HomePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  /* ── carousel ──
     If the user lands on Home with ?domain=<key> in the URL (e.g. from the
     bottom dock's "Flight Ops" tab), snap the carousel to that domain and
     auto-open its module panel — same view as clicking the card on Home. */
  const initialDomain = searchParams?.get('domain') ?? null
  const initialIdx = initialDomain !== null ? DOMAINS.findIndex((d) => d.key === initialDomain) : -1
  const [cur, setCur] = useState(initialIdx >= 0 ? initialIdx : 0)
  const [sel, setSel] = useState<number | null>(initialIdx >= 0 ? initialIdx : null)
  const isOpen = sel !== null

  function next() {
    if (!isOpen) setCur((c) => (c + 1) % DOMAINS.length)
  }
  function prev() {
    if (!isOpen) setCur((c) => (c - 1 + DOMAINS.length) % DOMAINS.length)
  }
  function select(i: number) {
    if (i === cur) setSel(i)
    else setCur(i)
  }
  function close() {
    setSel(null)
  }

  /* ── transition ── */
  const [leaving, setLeaving] = useState<string | null>(null)
  const [pendingCode, setPendingCode] = useState<string | null>(null)
  const [pendingAccent, setPendingAccent] = useState<string>('#1e40af')
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Minimum "charging" window before the zoom fires. Even prefetched routes
   * wait this long so the border-light animation on the clicked item always
   * registers. Not a mandatory theater-wait — just enough to read.
   */
  const CHARGING_MIN_MS = 600

  function go(href: string, accent: string, origin?: { x: number; y: number }, code?: string) {
    if (pendingTimer.current) clearTimeout(pendingTimer.current)
    if (code) setPendingCode(code)
    setPendingAccent(accent)

    // Warm the route in the background while the charging border plays.
    try {
      router.prefetch(href)
    } catch {
      /* best-effort */
    }

    if (supportsViewTransitions()) {
      pendingTimer.current = setTimeout(() => {
        revealNavigate(router, href, { origin, accent, direction: 'in' })
      }, CHARGING_MIN_MS)
    } else {
      // Fallback for browsers without View Transitions API (Firefox today).
      setLeaving(accent)
      pendingTimer.current = setTimeout(() => router.push(href), CHARGING_MIN_MS)
    }
  }

  useEffect(() => {
    return () => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current)
    }
  }, [])

  function prefetch(href: string) {
    try {
      router.prefetch(href)
    } catch {
      // prefetch is best-effort
    }
  }

  /* keyboard */
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        close()
        return
      }
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'Enter' && !isOpen) select(cur)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  /* wheel */
  const wc = useRef(false)
  useEffect(() => {
    function handler(e: WheelEvent) {
      if (isOpen || wc.current) return
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (Math.abs(d) < 30) return
      wc.current = true
      if (d > 0) next()
      else prev()
      setTimeout(() => {
        wc.current = false
      }, 500)
    }
    window.addEventListener('wheel', handler, { passive: true })
    return () => window.removeEventListener('wheel', handler)
  })

  const selDomain = sel !== null ? DOMAINS[sel] : null
  const selAccent = selDomain ? (MODULE_THEMES[selDomain.module]?.accent ?? '#64748b') : '#64748b'
  const selTreeRaw = selDomain ? (TREES[selDomain.key] ?? []) : []
  const [panelSearch, setPanelSearch] = useState('')

  // Reset search when domain changes
  useEffect(() => {
    setPanelSearch('')
  }, [sel])

  // Filter tree by search
  const selTree = panelSearch.trim()
    ? selTreeRaw
        .map((g) => ({
          ...g,
          children: g.children.filter((c) => {
            const q = panelSearch.trim().toLowerCase()
            return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.code.includes(q)
          }),
        }))
        .filter((g) => g.children.length > 0)
    : selTreeRaw
  const selCount = selDomain ? MODULE_REGISTRY.filter((m) => m.module === selDomain.module && m.level === 2).length : 0

  const bk = { backdropFilter: 'blur(48px) saturate(1.5)', WebkitBackdropFilter: 'blur(48px) saturate(1.5)' } as const
  const logoFilter = isDark
    ? 'brightness(0) invert(1) drop-shadow(0 1px 8px rgba(0,0,0,0.4))'
    : 'brightness(0) drop-shadow(0 1px 8px rgba(255,255,255,0.6))'

  return (
    <div
      className="relative h-screen overflow-hidden"
      style={leaving ? { animation: 'hzOut 450ms ease-in-out forwards' } : undefined}
    >
      {/* keyframes */}
      <style>{`
        @keyframes hzOut{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.06);filter:blur(6px)}}
        @keyframes hzFade{0%{opacity:0}100%{opacity:1}}
        @keyframes hzSlide{0%{opacity:0;transform:translateY(14px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes hzBgIn{0%{opacity:0;transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}
        @keyframes hzGlow{0%,100%{opacity:.4}50%{opacity:.8}}
      `}</style>

      {/* ── BG: wallpaper or domain image ── */}
      {isOpen && selDomain ? (
        <div className="fixed inset-0 z-0" style={{ animation: 'hzBgIn 600ms ease-out both' }}>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${selDomain.image})`, filter: 'blur(8px)', transform: 'scale(1.05)' }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, rgba(0,0,0,.75) 0%, rgba(0,0,0,.35) 50%, rgba(0,0,0,.70) 100%)',
            }}
          />
        </div>
      ) : (
        <WallpaperBg blur={8} variant={isDark ? 'dark' : 'light'} />
      )}

      {/* ── Header ── */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-5 pt-3 pb-1">
        <img
          src="/skyhub-logo.png"
          alt="SkyHub"
          style={{
            height: 52,
            filter: isOpen ? 'brightness(0) invert(1) drop-shadow(0 1px 8px rgba(0,0,0,.4))' : logoFilter,
          }}
        />
        <UserMenu tone={isDark || isOpen ? 'overlay' : 'palette'} align="right" />
      </div>

      {/* ═════════════════════════════════════
         CAROUSEL + PANEL LAYOUT
         ═════════════════════════════════════ */}
      <div className="relative z-10 h-full flex">
        {/* ── LEFT: Carousel ── */}
        <div
          className="flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(.4,0,.2,1)] relative"
          style={{ width: isOpen ? '42%' : '100%', minWidth: isOpen ? '42%' : undefined }}
        >
          {/* Cards container with perspective */}
          <div className="relative" style={{ width: 440, height: 600, perspective: 1200 }}>
            {DOMAINS.map((domain, i) => {
              const accent = MODULE_THEMES[domain.module]?.accent ?? '#64748b'
              const Icon = getIcon(domain.icon)
              const count = MODULE_REGISTRY.filter((m) => m.module === domain.module && m.level === 2).length

              let offset = i - cur
              if (offset > 2) offset -= DOMAINS.length
              if (offset < -2) offset += DOMAINS.length
              const isCenter = offset === 0
              const abs = Math.abs(offset)

              // Compute transform
              let tx: number, sc: number, ry: number, op: number, bl: number
              if (isOpen) {
                // When open: center card stays, others gone
                if (i === sel) {
                  tx = 0
                  sc = 1.12
                  ry = 0
                  op = 1
                  bl = 0
                } else {
                  tx = 0
                  sc = 0.7
                  ry = 0
                  op = 0
                  bl = 0
                }
              } else if (abs > 2) {
                tx = offset * 400
                sc = 0.5
                ry = 0
                op = 0
                bl = 5
              } else {
                tx = offset * 370
                sc = isCenter ? 1 : abs === 1 ? 0.85 : 0.68
                ry = isCenter ? 0 : offset > 0 ? -8 : 8
                op = isCenter ? 1 : abs === 1 ? 0.5 : 0.2
                bl = isCenter ? 0 : abs === 1 ? 2 : 5
              }

              return (
                <button
                  key={domain.key}
                  type="button"
                  className="absolute inset-0 rounded-[20px] overflow-hidden focus:outline-none"
                  style={{
                    transform: `translateX(${tx}px) scale(${sc}) rotateY(${ry}deg)`,
                    opacity: op,
                    filter: bl ? `blur(${bl}px) brightness(.65)` : 'none',
                    zIndex: isCenter ? 10 : 10 - abs,
                    transition: 'all 500ms cubic-bezier(.4,0,.2,1)',
                    transformStyle: 'preserve-3d',
                    border: isCenter ? `1px solid ${accent}40` : '1px solid rgba(255,255,255,.06)',
                    boxShadow: isCenter
                      ? `0 20px 60px rgba(0,0,0,.4), 0 0 60px ${accent}12`
                      : '0 8px 32px rgba(0,0,0,.3)',
                    cursor: isCenter ? 'pointer' : 'pointer',
                    pointerEvents: (abs > 2 && !isOpen) || (isOpen && i !== sel) ? 'none' : 'auto',
                  }}
                  onClick={() => select(i)}
                >
                  {/* BG image */}
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${domain.image})`,
                      transform: isCenter ? 'scale(1.05)' : 'scale(1)',
                      transition: 'transform 700ms ease',
                    }}
                  />
                  {/* Darken */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: isCenter
                        ? 'linear-gradient(180deg, rgba(0,0,0,.08) 0%, rgba(0,0,0,.25) 50%, rgba(0,0,0,.80) 100%)'
                        : 'linear-gradient(180deg, rgba(0,0,0,.30) 0%, rgba(0,0,0,.70) 100%)',
                    }}
                  />
                  {/* Glow */}
                  {isCenter && (
                    <div
                      className="absolute bottom-0 left-0 right-0 h-40"
                      style={{
                        background: `linear-gradient(0deg, ${accent}20 0%, transparent 100%)`,
                        animation: 'hzGlow 4s ease-in-out infinite',
                      }}
                    />
                  )}
                  {/* Top line */}
                  {isCenter && (
                    <div
                      className="absolute top-0 left-0 right-0 h-[2px]"
                      style={{ background: `linear-gradient(90deg, transparent 5%, ${accent} 50%, transparent 95%)` }}
                    />
                  )}

                  {/* Content — all inside the button */}
                  <div className="absolute inset-0 flex flex-col p-5">
                    {/* Top */}
                    <div className="flex items-start justify-between">
                      <div
                        className="flex items-center justify-center rounded-full text-[14px] font-bold"
                        style={{
                          width: 36,
                          height: 36,
                          background: isCenter ? accent : 'rgba(255,255,255,.10)',
                          color: '#fff',
                          boxShadow: isCenter ? `0 4px 20px ${accent}50` : 'none',
                          transition: 'all 500ms ease',
                        }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div
                        className="flex items-center justify-center rounded-xl"
                        style={{
                          width: 42,
                          height: 42,
                          background: 'rgba(0,0,0,.25)',
                          backdropFilter: 'blur(12px)',
                          border: isCenter ? `1px solid ${accent}40` : '1px solid rgba(255,255,255,.08)',
                        }}
                      >
                        <Icon size={20} strokeWidth={1.5} color="#fff" />
                      </div>
                    </div>

                    <div className="flex-1" />

                    {/* Bottom */}
                    <div className="text-left">
                      <div className="text-[22px] font-bold tracking-tight text-white mb-1.5 drop-shadow-lg">
                        {domain.label}
                      </div>
                      {isCenter && (
                        <div className="text-[13px] leading-[1.5] text-white/55 mb-3">{domain.description}</div>
                      )}
                      {isCenter && (
                        <div className="flex items-center gap-3">
                          <span
                            className="text-[12px] font-semibold px-3 py-1 rounded-full"
                            style={{ background: `${accent}25`, color: '#fff', border: `1px solid ${accent}30` }}
                          >
                            {count} modules
                          </span>
                          <span className="text-[12px] text-white/30">Click to explore</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Nav arrows — only when not open */}
          {!isOpen && (
            <>
              <button
                onClick={prev}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                style={{
                  background: isDark ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.55)',
                  backdropFilter: 'blur(12px)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'}`,
                }}
              >
                <LucideIcons.ChevronLeft size={20} color={isDark ? 'rgba(255,255,255,.6)' : 'rgba(15,23,42,.65)'} />
              </button>
              <button
                onClick={next}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                style={{
                  background: isDark ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.55)',
                  backdropFilter: 'blur(12px)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'}`,
                }}
              >
                <LucideIcons.ChevronRight size={20} color={isDark ? 'rgba(255,255,255,.6)' : 'rgba(15,23,42,.65)'} />
              </button>
            </>
          )}

          {/* Dots — only when not open. Lifted off the bottom edge so a
             small copyright line can sit comfortably below them. */}
          {!isOpen && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              {DOMAINS.map((d, i) => {
                const ac = MODULE_THEMES[d.module]?.accent ?? '#64748b'
                return (
                  <button
                    key={i}
                    onClick={() => setCur(i)}
                    className="rounded-full transition-all duration-500"
                    style={{
                      width: i === cur ? 28 : 8,
                      height: 8,
                      background: i === cur ? ac : isDark ? 'rgba(255,255,255,.20)' : 'rgba(15,23,42,.25)',
                      boxShadow: i === cur ? `0 0 12px ${ac}60` : 'none',
                    }}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT: Sub-module panel ── */}
        {isOpen && selDomain && (
          <div
            className="flex-1 min-w-0 flex flex-col py-20 pr-5 pl-2"
            style={{ animation: 'hzSlide 400ms cubic-bezier(.4,0,.2,1) both' }}
          >
            {/* Back button — neutral glass chip */}
            <button
              onClick={close}
              className="inline-flex items-center gap-2 mb-4 px-3.5 py-2 rounded-full transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] focus:outline-none w-fit"
              style={{
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.18)',
                backdropFilter: 'blur(16px) saturate(160%)',
                WebkitBackdropFilter: 'blur(16px) saturate(160%)',
                boxShadow: '0 4px 14px rgba(0,0,0,0.22)',
                color: '#fff',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.16)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.10)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'
              }}
            >
              <LucideIcons.ArrowLeft size={14} strokeWidth={2.4} />
              <span className="text-[13px] font-semibold tracking-wide">Back</span>
            </button>

            {/* Panel header */}
            <div className="flex items-center gap-3 mb-5">
              <div
                className="flex items-center justify-center rounded-xl"
                style={{
                  width: 40,
                  height: 40,
                  background: 'rgba(255,255,255,.08)',
                  border: '1px solid rgba(255,255,255,.12)',
                }}
              >
                {(() => {
                  const I = getIcon(selDomain.icon)
                  return <I size={20} strokeWidth={1.5} color="rgba(255,255,255,.7)" />
                })()}
              </div>
              <div>
                <div className="text-[20px] font-bold text-white tracking-tight">{selDomain.label}</div>
                <div className="text-[13px] text-white/45">{selCount} modules</div>
              </div>
            </div>

            {/* Glass panel with modules */}
            <div
              className="flex-1 rounded-2xl overflow-hidden"
              style={{
                background: isDark ? 'rgba(10,10,18,.75)' : 'rgba(15,15,25,.65)',
                ...bk,
                border: '1px solid rgba(255,255,255,.08)',
                boxShadow: '0 24px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.06) inset',
              }}
            >
              {/* Search */}
              <div className="px-3 pt-3 pb-2">
                <div
                  className="flex items-center gap-2.5 px-3 rounded-xl"
                  style={{ height: 40, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)' }}
                >
                  <LucideIcons.Search size={15} color="rgba(255,255,255,.30)" />
                  <input
                    type="text"
                    value={panelSearch}
                    onChange={(e) => setPanelSearch(e.target.value)}
                    placeholder="Search modules..."
                    className="flex-1 bg-transparent outline-none text-[13px] text-white/90 placeholder:text-white/25"
                  />
                  {panelSearch && (
                    <button onClick={() => setPanelSearch('')} className="hover:opacity-70">
                      <LucideIcons.X size={14} color="rgba(255,255,255,.30)" />
                    </button>
                  )}
                </div>
              </div>

              <div
                className="overflow-y-auto px-2 pt-2 pb-3"
                style={{
                  maxHeight: 'calc(100% - 56px)',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(255,255,255,.15) transparent',
                }}
              >
                {selTree.map((group, gi) => {
                  const SIcon = getIcon(group.section.icon)
                  return (
                    <div
                      key={group.section.code}
                      className={gi > 0 ? 'mt-4' : ''}
                      style={{ animation: `hzSlide 350ms ease-out ${gi * 60}ms both` }}
                    >
                      {/* Section header — code prefix then name (both Inter) */}
                      <div className="flex items-center gap-2 px-3 mb-1.5">
                        <div className="w-[3px] h-[14px] rounded-full" style={{ background: selAccent }} />
                        <SIcon size={13} strokeWidth={2} color="rgba(255,255,255,.45)" />
                        <span className="text-[11px] font-semibold tracking-wider text-white/50">
                          {group.section.code}
                        </span>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                          {group.section.name}
                        </span>
                        <div className="flex-1 h-px ml-2" style={{ background: 'rgba(255,255,255,.06)' }} />
                      </div>

                      {/* Items */}
                      {group.children.map((child, ci) => {
                        const CI = getIcon(child.icon)
                        return (
                          <button
                            key={child.code}
                            data-nav-loading={pendingCode === child.code ? 'true' : undefined}
                            className="relative isolate w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left group transition-all duration-150 active:scale-[0.985]"
                            style={
                              {
                                animation: `hzSlide 300ms ease-out ${gi * 60 + (ci + 1) * 40}ms both`,
                                '--loading-accent': selAccent,
                              } as React.CSSProperties
                            }
                            disabled={pendingCode !== null}
                            onClick={(e) => go(child.route, selAccent, { x: e.clientX, y: e.clientY }, child.code)}
                            onMouseEnter={(e) => {
                              if (pendingCode !== child.code) {
                                e.currentTarget.style.background = 'rgba(255,255,255,.06)'
                              }
                              prefetch(child.route)
                            }}
                            onFocus={() => prefetch(child.route)}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent'
                            }}
                          >
                            <div
                              className="flex items-center justify-center rounded-lg shrink-0"
                              style={{
                                width: 34,
                                height: 34,
                                background: 'rgba(255,255,255,.06)',
                                border: '1px solid rgba(255,255,255,.08)',
                              }}
                            >
                              <CI size={16} strokeWidth={1.8} color="rgba(255,255,255,.55)" />
                            </div>
                            <div className="flex-1 min-w-0">
                              {/* Code sits as a discreet trailing tag after
                                 the name — same line, Inter (inherits from
                                 root layout), muted so it doesn't compete
                                 with the name for attention. */}
                              <div className="flex items-baseline gap-2">
                                <span className="text-[14px] font-medium truncate text-white/90">{child.name}</span>
                                <span className="text-[11px] font-medium text-white/35 shrink-0 tabular-nums">
                                  {child.code}
                                </span>
                              </div>
                              <div className="text-[12px] mt-0.5 truncate text-white/35">{child.description}</div>
                            </div>
                            <LucideIcons.ChevronRight
                              size={14}
                              color="rgba(255,255,255,.3)"
                              className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
                            />
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Copyright footer — only when not in cinematic focus state ── */}
      {!isOpen && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none"
          style={{
            color: isDark ? 'rgba(255,255,255,0.32)' : 'rgba(15,23,42,0.42)',
            textShadow: isDark ? '0 1px 4px rgba(0,0,0,0.5)' : '0 1px 2px rgba(255,255,255,0.6)',
          }}
        >
          <span className="text-[12px]">
            © {new Date().getFullYear()} SkyHub · Aviation Management System · All rights reserved
          </span>
        </div>
      )}

      {/* ── Transition overlay ── */}
      {leaving && (
        <div
          className="fixed inset-0 z-50 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, ${leaving}20 0%, ${
              isDark ? 'rgba(10,10,18,.95)' : 'rgba(245,247,252,.96)'
            } 70%)`,
            animation: 'hzFade 450ms ease-out forwards',
          }}
        />
      )}
    </div>
  )
}
