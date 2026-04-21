'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import * as LucideIcons from 'lucide-react'
import { MODULE_REGISTRY, MODULE_THEMES, type ModuleEntry } from '@skyhub/constants'
import { useRouter, useSearchParams } from 'next/navigation'
import { WallpaperBg } from '@/components/wallpaper-bg'
import { useTheme } from '@/components/theme-provider'
import { UserMenu } from '@/components/UserMenu'
import { revealNavigate, supportsViewTransitions } from '@/lib/nav-transition'
import { carouselTick, carouselSelect, carouselDismiss, hoverTak } from '@/lib/ui-sound'

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
    label: 'Master Database',
    description: 'Reference data catalogues for every operational domain',
    icon: 'Database',
    href: '/settings',
    module: 'admin',
    image: '/assets/domains/master-database.png',
  },
  {
    key: 'sysadmin',
    label: 'System Administration',
    description: 'User accounts, access rights, operator config & company documents',
    icon: 'ShieldCheck',
    href: '/sysadmin',
    module: 'sysadmin',
    image: '/assets/domains/settings.png',
  },
]

interface ChildNode {
  entry: ModuleEntry
  subChildren: ModuleEntry[]
}

interface SectionGroup {
  section: ModuleEntry
  children: ChildNode[]
}

function buildTree(mod: string): SectionGroup[] {
  return MODULE_REGISTRY.filter((m) => m.module === mod && m.level === 1)
    .map((s) => ({
      section: s,
      children: MODULE_REGISTRY.filter((m) => m.parent_code === s.code && m.level === 2).map((c) => ({
        entry: c,
        subChildren: MODULE_REGISTRY.filter((sc) => sc.parent_code === c.code && sc.level === 3),
      })),
    }))
    .filter((g) => g.children.length > 0)
}

const TREES = Object.fromEntries(DOMAINS.map((d) => [d.key, buildTree(d.module)]))

const iconMap = LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>
function getIcon(name: string): LucideIcons.LucideIcon {
  return iconMap[name] ?? LucideIcons.Box
}

/* Web-side viewport hook. `packages/ui` useResponsive uses react-native's
   useWindowDimensions, which isn't available in Next. Mirror the 768/1024
   thresholds so mobile + web stay consistent. */
function useViewport() {
  const [w, setW] = useState<number>(1440)
  useEffect(() => {
    const read = () => setW(window.innerWidth)
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])
  return { isPhone: w < 768, isTablet: w >= 768 && w < 1024, isDesktop: w >= 1024 }
}

/* ═══════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════ */

export default function HomePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const { isPhone } = useViewport()

  /* ── carousel ──
     If the user lands on Home with ?domain=<key> in the URL (e.g. from the
     bottom dock's "Flight Ops" tab), snap the carousel to that domain and
     auto-open its module panel — same view as clicking the card on Home. */
  const initialDomain = searchParams?.get('domain') ?? null
  const initialIdx = initialDomain !== null ? DOMAINS.findIndex((d) => d.key === initialDomain) : -1
  const [cur, setCur] = useState(initialIdx >= 0 ? initialIdx : 0)
  const [sel, setSel] = useState<number | null>(initialIdx >= 0 ? initialIdx : null)
  const isOpen = sel !== null

  /* ══════════════════════════════════════════
     PHYSICS CAROUSEL
     One scalar `position` on a ring of N cards. Wheel impulses add to
     `velocity`; velocity decays exponentially; near-rest engages a spring
     to snap onto the nearest whole card. Every frame we compute each
     card's shortest-path offset from position and imperatively write its
     transform — no CSS transitions, so there's nothing to misanimate.
     ══════════════════════════════════════════ */
  const N = DOMAINS.length
  // Tuning constants
  const DECAY = 5.0 // velocity decays as v *= exp(-DECAY*dt). Higher = faster settle.
  const SPRING = 55 // stiffness when settling to a snap
  const DAMP = 14 // damping on spring (critical ≈ 2*sqrt(SPRING) ≈ 14.8)
  const SETTLE_VEL = 0.6 // cards/sec — below this, engage spring to nearest
  const WHEEL_K = 0.03 // wheel delta → velocity (deltaY=100 → +3 cards/sec)
  const WHEEL_CLAMP = 18 // max velocity (cards/sec) a single event can add
  const MAX_VEL = 28 // hard ceiling on total velocity
  const CARD_SPACING = 370 // px between card centers (matches original)

  const positionRef = useRef<number>(initialIdx >= 0 ? initialIdx : 0)
  const velocityRef = useRef<number>(0)
  const targetRef = useRef<number | null>(null) // if set, spring pulls here (click nav)
  const rafRef = useRef<number>(0)
  const lastTsRef = useRef<number>(0)
  const lastIdxRef = useRef<number>(initialIdx >= 0 ? initialIdx : 0)
  const cardRefs = useRef<Array<HTMLDivElement | null>>([])

  const setCardRef = useCallback(
    (i: number) => (el: HTMLDivElement | null) => {
      cardRefs.current[i] = el
    },
    [],
  )

  /* ── shortest signed distance on a ring of N. Returns value in [-N/2, N/2). */
  const shortestDelta = useCallback(
    (from: number, to: number) => {
      let d = to - from
      d = ((((d + N / 2) % N) + N) % N) - N / 2
      return d
    },
    [N],
  )

  const modN = useCallback(
    (x: number) => {
      return ((x % N) + N) % N
    },
    [N],
  )

  /* ── apply every card's transform based on current `positionRef`. */
  const applyTransforms = useCallback(() => {
    for (let i = 0; i < N; i++) {
      const el = cardRefs.current[i]
      if (!el) continue
      const offset = shortestDelta(positionRef.current, i)
      const absU = Math.abs(offset)

      // Coverflow curve — matches the original design:
      //   absU 0 → scale 1, ry 0, op 1
      //   absU 1 → scale 0.85, ry ±8, op 0.6
      //   absU 2 → scale 0.68, ry ±16, op 0.2
      //   absU ≥ 2.5 → hidden
      const scale = Math.max(0.5, 1 - absU * 0.17)
      const rotY = -Math.sign(offset) * Math.min(absU, 2) * 8
      const opacity = Math.max(0, 1 - absU * 0.4)
      const blur = Math.min(5, absU * 1.8)
      const tx = offset * CARD_SPACING

      el.style.transform = `translate(-50%, 0) translateX(${tx}px) scale(${scale}) rotateY(${rotY}deg)`
      el.style.opacity = String(opacity)
      el.style.filter = blur > 0.1 ? `blur(${blur.toFixed(2)}px) brightness(.85)` : 'none'
      el.style.zIndex = String(10 - Math.round(absU))
      el.style.pointerEvents = absU < 2.5 ? 'auto' : 'none'
    }
  }, [N, shortestDelta])

  /* ── apply "open panel" frozen state: only selected card visible + zoomed.
     Uses a CSS transition for smooth open/close animation since rAF is off. */
  const applyOpenTransforms = useCallback(() => {
    for (let i = 0; i < N; i++) {
      const el = cardRefs.current[i]
      if (!el) continue
      const isSel = i === sel
      el.style.transition = 'all 500ms cubic-bezier(.4,0,.2,1)'
      el.style.transform = isSel
        ? 'translate(-50%, 0) scale(1.12) rotateY(0deg)'
        : 'translate(-50%, 0) scale(0.7) rotateY(0deg)'
      el.style.opacity = isSel ? '1' : '0'
      el.style.filter = 'none'
      el.style.zIndex = isSel ? '10' : '1'
      el.style.pointerEvents = isSel ? 'auto' : 'none'
    }
  }, [N, sel])

  /* ── main rAF loop. Mounted once; pauses itself when isOpen. */
  useEffect(() => {
    if (isOpen) {
      // Let CSS transitions handle the open-panel animation
      applyOpenTransforms()
      return
    }

    // Re-enable rAF mode: cards drive via imperative transforms, no CSS transition
    for (let i = 0; i < N; i++) {
      const el = cardRefs.current[i]
      if (el) el.style.transition = 'none'
    }

    let running = true

    function tick(now: number) {
      if (!running) return
      const dt = lastTsRef.current === 0 ? 0.016 : Math.min(0.05, (now - lastTsRef.current) / 1000)
      lastTsRef.current = now

      const pos = positionRef.current
      let vel = velocityRef.current
      const target = targetRef.current

      if (target !== null) {
        // User-directed: critically damped spring to explicit target
        const diff = shortestDelta(pos, target)
        const force = SPRING * diff - DAMP * vel
        vel += force * dt
        if (Math.abs(diff) < 0.005 && Math.abs(vel) < 0.05) {
          positionRef.current = target
          velocityRef.current = 0
          targetRef.current = null
          applyTransforms()
          maybeTick()
          rafRef.current = requestAnimationFrame(tick)
          return
        }
      } else if (Math.abs(vel) > SETTLE_VEL) {
        // Coasting: pure exponential decay. THIS is "spin then decelerate."
        vel *= Math.exp(-DECAY * dt)
      } else {
        // Slow: spring to nearest integer for clean settle
        const nearest = Math.round(pos)
        const diff = shortestDelta(pos, nearest)
        const force = SPRING * diff - DAMP * vel
        vel += force * dt
        if (Math.abs(diff) < 0.005 && Math.abs(vel) < 0.05) {
          positionRef.current = modN(nearest)
          velocityRef.current = 0
          applyTransforms()
          maybeTick()
          rafRef.current = requestAnimationFrame(tick)
          return
        }
      }

      // Clamp + integrate
      if (vel > MAX_VEL) vel = MAX_VEL
      if (vel < -MAX_VEL) vel = -MAX_VEL
      velocityRef.current = vel
      positionRef.current = modN(pos + vel * dt)

      applyTransforms()
      maybeTick()
      rafRef.current = requestAnimationFrame(tick)
    }

    function maybeTick() {
      const idxNow = modN(Math.round(positionRef.current))
      if (idxNow !== lastIdxRef.current) {
        lastIdxRef.current = idxNow
        carouselTick()
        setCur(idxNow)
      }
    }

    lastTsRef.current = 0
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [isOpen, N, SPRING, DAMP, DECAY, SETTLE_VEL, MAX_VEL, applyTransforms, applyOpenTransforms, modN, shortestDelta])

  /* ── wheel: impulse into velocity. No gesture/axis locking needed — the
     decay model naturally absorbs inertia tail noise. */
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      if (isOpen) return
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      const factor = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1
      let add = d * factor * WHEEL_K
      if (add > WHEEL_CLAMP) add = WHEEL_CLAMP
      if (add < -WHEEL_CLAMP) add = -WHEEL_CLAMP
      velocityRef.current += add
      targetRef.current = null // wheel cancels any pending snap-to-target
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [isOpen, WHEEL_K, WHEEL_CLAMP])

  /* ── navigate to specific card (click/key/dot) via spring-to-target. */
  const goTo = useCallback(
    (i: number) => {
      targetRef.current = modN(i)
    },
    [modN],
  )

  function onCardClick(i: number) {
    if (i === cur) {
      carouselSelect()
      setSel(i)
    } else {
      goTo(i)
    }
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
      if (isOpen) return
      if (e.key === 'ArrowRight') {
        velocityRef.current += 6 // one-card impulse
        targetRef.current = null
      }
      if (e.key === 'ArrowLeft') {
        velocityRef.current -= 6
        targetRef.current = null
      }
      if (e.key === 'Enter') {
        carouselSelect()
        setSel(cur)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const selDomain = sel !== null ? DOMAINS[sel] : null
  const selAccent = selDomain ? (MODULE_THEMES[selDomain.module]?.accent ?? '#64748b') : '#64748b'
  const selTreeRaw = selDomain ? (TREES[selDomain.key] ?? []) : []
  const [panelSearch, setPanelSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // Reset search when domain changes
  useEffect(() => {
    setPanelSearch('')
    setCollapsed(new Set())
  }, [sel])

  const toggleCollapsed = useCallback((code: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }, [])

  // Filter tree by search
  const selTree = panelSearch.trim()
    ? selTreeRaw
        .map((g) => ({
          ...g,
          children: g.children
            .map((c) => {
              const q = panelSearch.trim().toLowerCase()
              const matchSelf =
                c.entry.name.toLowerCase().includes(q) ||
                c.entry.description.toLowerCase().includes(q) ||
                c.entry.code.includes(q)
              const matchedSubs = c.subChildren.filter(
                (sc) =>
                  sc.name.toLowerCase().includes(q) || sc.description.toLowerCase().includes(q) || sc.code.includes(q),
              )
              if (matchSelf) return c
              if (matchedSubs.length > 0) return { ...c, subChildren: matchedSubs }
              return null
            })
            .filter((c): c is ChildNode => c !== null),
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
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-3 sm:px-5 pt-3 pb-1">
        <img
          src="/skyhub-logo.png"
          alt="SkyHub"
          style={{
            height: isPhone ? 36 : 52,
            filter: isOpen ? 'brightness(0) invert(1) drop-shadow(0 1px 8px rgba(0,0,0,.4))' : logoFilter,
          }}
        />
        <UserMenu tone={isDark || isOpen ? 'overlay' : 'palette'} align="right" compact={isPhone} />
      </div>

      {/* ═════════════════════════════════════
         CAROUSEL + PANEL LAYOUT
         ═════════════════════════════════════ */}
      <div className="relative z-10 h-full flex">
        {/* ── LEFT: Carousel ──
           On phone when a module is open, collapse this column entirely so the
           right panel gets the full viewport — phone doesn't show the card
           preview while inside a module (only the wallpaper behind the panel). */}
        {!(isPhone && isOpen) && (
          <div
            className="flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(.4,0,.2,1)] relative"
            style={{ width: isOpen ? '42%' : '100%', minWidth: isOpen ? '42%' : undefined }}
          >
            {/* Perspective stage. Each card is absolute-positioned at left:50%;
                the rAF loop writes its transform (translate + scale + rotateY)
                every frame. No Embla, no CSS transitions during scroll. */}
            <div
              className="relative"
              style={{
                width: isPhone ? 'min(100vw, 340px)' : '100%',
                height: isPhone ? 'min(120vw, 480px)' : 600,
                perspective: isPhone ? 800 : 1200,
                pointerEvents: isOpen ? 'none' : 'auto',
              }}
            >
              {DOMAINS.map((domain, i) => {
                const accent = MODULE_THEMES[domain.module]?.accent ?? '#64748b'
                const Icon = getIcon(domain.icon)
                const count = MODULE_REGISTRY.filter((m) => m.module === domain.module && m.level === 2).length

                return (
                  <div
                    key={domain.key}
                    ref={setCardRef(i)}
                    className="absolute top-0 rounded-[20px] overflow-hidden"
                    style={{
                      width: isPhone ? 'min(86vw, 340px)' : 440,
                      height: '100%',
                      left: '50%',
                      transform: 'translate(-50%, 0)', // rAF loop overrides
                      transformStyle: 'preserve-3d',
                      willChange: 'transform, opacity, filter',
                      border: `1px solid ${accent}40`,
                      boxShadow: `0 20px 60px rgba(0,0,0,.4), 0 0 60px ${accent}12`,
                      cursor: 'pointer',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onCardClick(i)}
                      className="absolute inset-0 focus:outline-none text-left"
                      aria-label={domain.label}
                    >
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${domain.image})` }}
                      />
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            'linear-gradient(180deg, rgba(0,0,0,.08) 0%, rgba(0,0,0,.25) 50%, rgba(0,0,0,.80) 100%)',
                        }}
                      />
                      <div
                        className="absolute bottom-0 left-0 right-0 h-40"
                        style={{
                          background: `linear-gradient(0deg, ${accent}20 0%, transparent 100%)`,
                          animation: 'hzGlow 4s ease-in-out infinite',
                        }}
                      />
                      <div
                        className="absolute top-0 left-0 right-0 h-[2px]"
                        style={{
                          background: `linear-gradient(90deg, transparent 5%, ${accent} 50%, transparent 95%)`,
                        }}
                      />

                      <div className="absolute inset-0 flex flex-col p-5">
                        <div className="flex items-start justify-between">
                          <div
                            className="flex items-center justify-center rounded-full text-[14px] font-bold"
                            style={{
                              width: 36,
                              height: 36,
                              background: accent,
                              color: '#fff',
                              boxShadow: `0 4px 20px ${accent}50`,
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
                              border: `1px solid ${accent}40`,
                            }}
                          >
                            <Icon size={20} strokeWidth={1.5} color="#fff" />
                          </div>
                        </div>

                        <div className="flex-1" />

                        <div className="text-left">
                          <div className="text-[22px] font-bold tracking-tight text-white mb-1.5 drop-shadow-lg">
                            {domain.label}
                          </div>
                          <div className="text-[13px] leading-[1.5] text-white/55 mb-3">{domain.description}</div>
                          <div className="flex items-center gap-3">
                            <span
                              className="text-[12px] font-semibold px-3 py-1 rounded-full"
                              style={{
                                background: `${accent}25`,
                                color: '#fff',
                                border: `1px solid ${accent}30`,
                              }}
                            >
                              {count} modules
                            </span>
                            <span className="text-[12px] text-white/30">Click to explore</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>

            {!isOpen && (
              <>
                <button
                  onClick={() => {
                    velocityRef.current -= 6
                    targetRef.current = null
                  }}
                  className={`absolute top-1/2 -translate-y-1/2 z-20 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform ${isPhone ? 'left-2 w-9 h-9' : 'left-4 w-11 h-11'}`}
                  style={{
                    background: isDark ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.55)',
                    backdropFilter: 'blur(12px)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'}`,
                  }}
                >
                  <LucideIcons.ChevronLeft
                    size={isPhone ? 18 : 20}
                    color={isDark ? 'rgba(255,255,255,.6)' : 'rgba(15,23,42,.65)'}
                  />
                </button>
                <button
                  onClick={() => {
                    velocityRef.current += 6
                    targetRef.current = null
                  }}
                  className={`absolute top-1/2 -translate-y-1/2 z-20 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform ${isPhone ? 'right-2 w-9 h-9' : 'right-4 w-11 h-11'}`}
                  style={{
                    background: isDark ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.55)',
                    backdropFilter: 'blur(12px)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'}`,
                  }}
                >
                  <LucideIcons.ChevronRight
                    size={isPhone ? 18 : 20}
                    color={isDark ? 'rgba(255,255,255,.6)' : 'rgba(15,23,42,.65)'}
                  />
                </button>
              </>
            )}

            {!isOpen && (
              <div
                className={`absolute left-1/2 -translate-x-1/2 z-20 flex gap-2 ${isPhone ? 'bottom-24' : 'bottom-14'}`}
              >
                {DOMAINS.map((d, i) => {
                  const ac = MODULE_THEMES[d.module]?.accent ?? '#64748b'
                  return (
                    <button
                      key={i}
                      onClick={() => goTo(i)}
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
        )}

        {/* ── RIGHT: Sub-module panel ── */}
        {isOpen && selDomain && (
          <div
            className={`flex-1 min-w-0 flex flex-col ${isPhone ? 'pt-14 pb-24 px-4' : 'py-20 pr-5 pl-2'}`}
            style={{ animation: 'hzSlide 400ms cubic-bezier(.4,0,.2,1) both' }}
          >
            {/* Back button — neutral glass chip */}
            <button
              onClick={() => {
                carouselDismiss()
                close()
              }}
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
                      {group.children.map((node, ci) => {
                        const child = node.entry
                        const CI = getIcon(child.icon)
                        const hasSubs = node.subChildren.length > 0
                        const isCollapsed = collapsed.has(child.code)
                        const rowClass =
                          'relative isolate w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left group transition-all duration-150'
                        const rowStyle = {
                          animation: `hzSlide 300ms ease-out ${gi * 60 + (ci + 1) * 40}ms both`,
                          '--loading-accent': selAccent,
                        } as React.CSSProperties

                        const innerContent = (
                          <>
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
                              <div className="flex items-baseline gap-2">
                                <span className="text-[14px] font-medium truncate text-white/90">{child.name}</span>
                                <span className="text-[11px] font-medium text-white/35 shrink-0 tabular-nums">
                                  {child.code}
                                </span>
                              </div>
                              <div className="text-[12px] mt-0.5 truncate text-white/35">{child.description}</div>
                            </div>
                          </>
                        )

                        return (
                          <div key={child.code}>
                            {hasSubs ? (
                              <button
                                type="button"
                                aria-expanded={!isCollapsed}
                                className={`${rowClass} active:scale-[0.99] cursor-default`}
                                style={rowStyle}
                                onClick={() => toggleCollapsed(child.code)}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(255,255,255,.04)'
                                  hoverTak()
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent'
                                }}
                              >
                                {innerContent}
                                <LucideIcons.ChevronDown
                                  size={16}
                                  color="rgba(255,255,255,.5)"
                                  className="shrink-0 transition-transform duration-200"
                                  style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                                />
                              </button>
                            ) : (
                              <button
                                data-nav-loading={pendingCode === child.code ? 'true' : undefined}
                                className={`${rowClass} active:scale-[0.985]`}
                                style={rowStyle}
                                disabled={pendingCode !== null}
                                onClick={(e) => go(child.route, selAccent, { x: e.clientX, y: e.clientY }, child.code)}
                                onMouseEnter={(e) => {
                                  if (pendingCode !== child.code) {
                                    e.currentTarget.style.background = 'rgba(255,255,255,.06)'
                                  }
                                  prefetch(child.route)
                                  hoverTak()
                                }}
                                onFocus={() => prefetch(child.route)}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent'
                                }}
                              >
                                {innerContent}
                                <LucideIcons.ChevronRight
                                  size={14}
                                  color="rgba(255,255,255,.3)"
                                  className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
                                />
                              </button>
                            )}

                            {/* Level-3 sub-items — compact, indented, text-only */}
                            {hasSubs && !isCollapsed && (
                              <div
                                className="ml-[46px] mr-2 mb-1 border-l"
                                style={{ borderColor: 'rgba(255,255,255,.08)' }}
                              >
                                {node.subChildren.map((sub, si) => (
                                  <button
                                    key={sub.code}
                                    data-nav-loading={pendingCode === sub.code ? 'true' : undefined}
                                    className="relative isolate w-full flex items-baseline gap-2 pl-3 pr-2 py-1.5 rounded-md text-left group transition-all duration-150 active:scale-[0.985]"
                                    style={
                                      {
                                        animation: `hzSlide 300ms ease-out ${gi * 60 + (ci + 1) * 40 + (si + 1) * 30}ms both`,
                                        '--loading-accent': selAccent,
                                      } as React.CSSProperties
                                    }
                                    disabled={pendingCode !== null}
                                    onClick={(e) => go(sub.route, selAccent, { x: e.clientX, y: e.clientY }, sub.code)}
                                    onMouseEnter={(e) => {
                                      if (pendingCode !== sub.code) {
                                        e.currentTarget.style.background = 'rgba(255,255,255,.05)'
                                      }
                                      prefetch(sub.route)
                                      hoverTak()
                                    }}
                                    onFocus={() => prefetch(sub.route)}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'transparent'
                                    }}
                                  >
                                    <span className="text-[11px] font-medium text-white/35 shrink-0 tabular-nums">
                                      {sub.code}
                                    </span>
                                    <span className="text-[13px] font-medium truncate text-white/75">{sub.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
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

      {/* ── Copyright footer — only on tablet/desktop landing. Phone always
         shows the bottom dock in its place; inside a module we hide it too. ── */}
      {!isOpen && !isPhone && (
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
