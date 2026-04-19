'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Globe, Plane, Truck, Users, Database, ShieldCheck, ChevronUp, ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from './theme-provider'
import { revealNavigate } from '@/lib/nav-transition'
import { useDockStore } from '@/lib/dock-store'

const ACCENT_DEFAULT = '#1e40af'

/**
 * Dock tabs route back to the Home hub rather than standalone module
 * landing pages — clicking "Flight Ops" in the dock opens the Flight Ops
 * panel on Home (same view as clicking the Flight Ops card on Home). The
 * Home page reads `?domain=<key>` on mount to auto-open the relevant
 * panel. `pathMatch` is what we use to light up the active tab when the
 * user is on a module page under that domain. */
interface Tab {
  key: string
  label: string
  icon: LucideIcon
  href: string
  pathMatch?: string
}

const TABS: Tab[] = [
  { key: 'home', label: 'Home', icon: Home, href: '/hub' },
  { key: 'network', label: 'Network', icon: Globe, href: '/hub?domain=network', pathMatch: '/network' },
  { key: 'flightops', label: 'Flight Ops', icon: Plane, href: '/hub?domain=flightops', pathMatch: '/flight-ops' },
  { key: 'groundops', label: 'Ground Ops', icon: Truck, href: '/hub?domain=groundops', pathMatch: '/ground-ops' },
  { key: 'crewops', label: 'Crew Ops', icon: Users, href: '/hub?domain=crewops', pathMatch: '/crew-ops' },
  { key: 'database', label: 'Database', icon: Database, href: '/hub?domain=settings', pathMatch: '/settings' },
  { key: 'sysadmin', label: 'Admin', icon: ShieldCheck, href: '/hub?domain=sysadmin', pathMatch: '/sysadmin' },
]

function getActiveIndex(pathname: string): number {
  if (pathname === '/hub') return 0
  // Master-data routes live under /admin/* — light up the Database tab.
  if (pathname.startsWith('/admin')) return 5
  // Operator Profile lives under /settings/admin/* but belongs to Admin, not Database.
  if (pathname.startsWith('/settings/admin')) return 6
  // /sysadmin/* → Admin tab.
  if (pathname.startsWith('/sysadmin')) return 6
  const idx = TABS.findIndex((t) => t.pathMatch && pathname.startsWith(t.pathMatch))
  return idx >= 0 ? idx : 0
}

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

/** Returns which size bucket the current viewport falls into. Tablet (≥768)
   now uses the same collapse behaviour as desktop — only phone (<768) gets
   the legacy full-width always-expanded bottom bar. */
function useViewport() {
  const [state, setState] = useState({ isPhone: false, isTabletUp: true })
  useEffect(() => {
    const read = () => {
      const w = window.innerWidth
      setState({ isPhone: w < 768, isTabletUp: w >= 768 })
    }
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])
  return state
}

export function SpotlightDock() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const accent = ACCENT_DEFAULT
  const activeIndex = getActiveIndex(pathname)
  const { isPhone, isTabletUp } = useViewport()
  // Tablet (≥768) now shares the desktop collapse UX. The "isDesktop" name
  // stays for the internal style branch that toggles pill vs. bottom bar.
  const isDesktop = isTabletUp

  // Collapse state is now driven by a global store — any component on any
  // page can fold the dock via collapseDock() (typical use: page-level "Go"
  // CTAs that take the user into a focus workspace). The dock auto-expands
  // on every pathname change so fresh navigations always show nav chrome.
  const collapsed = useDockStore((s) => s.collapsed)
  const setCollapsed = useDockStore((s) => s.setCollapsed)
  const expand = useDockStore((s) => s.expand)
  const initForViewport = useDockStore((s) => s.initForViewport)

  const isHome = pathname === '/hub'

  // One-shot: seed the collapse state from the initial viewport so tablet +
  // desktop land with the dock tucked away (matches the design spec).
  useEffect(() => {
    if (typeof window !== 'undefined') initForViewport(window.innerWidth)
  }, [initForViewport])

  // Phone has no collapse affordance — the dock is the primary nav, always
  // visible at the bottom row. Force-expand so any residual collapsed state
  // from a previous tablet/desktop session doesn't leak across resize.
  useEffect(() => {
    if (isPhone && collapsed) expand()
  }, [isPhone, collapsed, expand])

  // Auto-expand whenever the user navigates to a new page — but only on
  // phone, where the dock is the navigation surface. On tablet/desktop we
  // respect the user's collapsed preference across route changes.
  useEffect(() => {
    if (isPhone) expand()
  }, [pathname, isPhone, expand])

  // Mirror the collapse state onto <body> so CSS can reclaim bottom padding
  // on collapse. The dock is always visible on non-home pages; the padding
  // is only removed when the dock is folded away.
  useEffect(() => {
    if (isHome) {
      document.body.classList.remove('dock-collapsed')
      return
    }
    document.body.classList.toggle('dock-collapsed', collapsed && isDesktop)
    return () => document.body.classList.remove('dock-collapsed')
  }, [collapsed, isDesktop, isHome])

  const toggleCollapsed = useCallback(() => setCollapsed(!collapsed), [collapsed, setCollapsed])

  const indicatorColor = isDark ? '#ffffff' : accent
  const glowColor = isDark ? 'rgba(255,255,255,0.25)' : hexToRgba(accent, 0.2)
  const activeIconColor = isDark ? '#ffffff' : accent
  const inactiveIconColor = isDark ? 'rgba(255,255,255,0.50)' : 'rgba(0,0,0,0.45)'
  const activeLabelColor = isDark ? 'rgba(255,255,255,0.90)' : accent
  const inactiveLabelColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.40)'

  // Active tab info for collapsed pill
  const activeTab = TABS[activeIndex]
  const ActiveIcon = activeTab.icon

  const isCollapsedDesktop = collapsed && isDesktop

  // ── Shared glass styles ──
  const glassBg = isDark ? 'rgba(18,18,22,0.78)' : 'rgba(255,255,255,0.62)'
  const glassBorder = `0.5px solid ${isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.08)'}`
  const glassBlur = 'blur(24px) saturate(1.5)'
  const dockShadow = isDark
    ? '0 8px 32px rgba(0,0,0,0.30), inset 0 0.5px 0 rgba(255,255,255,0.06)'
    : '0 8px 32px rgba(0,0,0,0.08), inset 0 0.5px 0 rgba(255,255,255,0.9)'
  const pillShadow = isDark ? '0 4px 16px rgba(0,0,0,0.25)' : '0 4px 16px rgba(0,0,0,0.06)'

  return (
    <>
      {/* ── Collapsed "Navigation" button ── */}
      {isDesktop && (
        <button
          onClick={toggleCollapsed}
          className="fixed flex items-center gap-1.5 cursor-pointer select-none"
          style={{
            bottom: 12,
            left: '50%',
            zIndex: 50,
            padding: '6px 14px',
            borderRadius: 12,
            color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)',
            fontSize: 12,
            fontWeight: 600,
            background: glassBg,
            backdropFilter: glassBlur,
            WebkitBackdropFilter: glassBlur,
            border: glassBorder,
            boxShadow: pillShadow,
            // Animate in/out
            transform: isCollapsedDesktop ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(20px)',
            opacity: isCollapsedDesktop ? 1 : 0,
            pointerEvents: isCollapsedDesktop ? 'auto' : 'none',
            transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
          }}
        >
          <ChevronUp size={12} strokeWidth={2} />
          <span>Navigation</span>
        </button>
      )}

      {/* ── Full dock ── */}
      <nav
        className="flex items-center"
        style={
          isDesktop
            ? {
                position: 'fixed',
                bottom: 16,
                left: '50%',
                zIndex: 50,
                height: 76,
                borderRadius: 22,
                padding: '0 16px',
                background: glassBg,
                backdropFilter: glassBlur,
                WebkitBackdropFilter: glassBlur,
                border: glassBorder,
                boxShadow: dockShadow,
                // Animate in/out
                transform: isCollapsedDesktop ? 'translateX(-50%) translateY(100px)' : 'translateX(-50%) translateY(0)',
                opacity: isCollapsedDesktop ? 0 : 1,
                pointerEvents: isCollapsedDesktop ? 'none' : 'auto',
                transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease',
              }
            : {
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 50,
                height: 76,
                borderRadius: 0,
                background: glassBg,
                backdropFilter: glassBlur,
                WebkitBackdropFilter: glassBlur,
                borderTop: glassBorder,
              }
        }
      >
        {/* Collapse chevron — top center (desktop only) */}
        {isDesktop && (
          <button
            onClick={toggleCollapsed}
            className="absolute flex items-center justify-center cursor-pointer"
            style={{
              top: -16,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 44,
              height: 16,
              borderRadius: '8px 8px 0 0',
              color: inactiveIconColor,
              background: glassBg,
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderTop: glassBorder,
              borderLeft: glassBorder,
              borderRight: glassBorder,
              borderBottom: 'none',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = inactiveIconColor
            }}
            title="Collapse dock"
          >
            <ChevronDown size={12} strokeWidth={2} />
          </button>
        )}

        {TABS.map((tab, index) => {
          const Icon = tab.icon
          const active = index === activeIndex
          const btnWidth = isDesktop ? 76 : undefined

          return (
            <Link
              key={tab.key}
              href={tab.href}
              onClick={(e) => {
                if (active) return // clicking the already-active tab = no-op
                e.preventDefault()
                const rect = e.currentTarget.getBoundingClientRect()
                const origin = {
                  x: rect.left + rect.width / 2,
                  y: rect.top + rect.height / 2,
                }
                // Every dock tab now routes back to the Home hub (pure Home
                // for the Home tab, Home with ?domain=<key> for the others),
                // so the transition is always a radial close toward the
                // clicked tab — the module page collapses into the tab.
                revealNavigate(router, tab.href, { origin, accent, direction: 'out' })
              }}
              className="relative flex flex-col items-center justify-center overflow-hidden"
              style={{
                width: btnWidth,
                flex: isDesktop ? undefined : 1,
                height: 76,
                gap: 3,
              }}
            >
              {/* Indicator line */}
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2"
                style={{
                  width: 28,
                  height: 2.5,
                  borderRadius: '0 0 3px 3px',
                  backgroundColor: indicatorColor,
                  opacity: active ? 1 : 0,
                  transform: active ? 'scaleX(1)' : 'scaleX(0)',
                  transition: 'opacity 0.35s ease, transform 0.35s ease',
                }}
              />

              {/* Spotlight glow */}
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
                style={{
                  width: 56,
                  height: 48,
                  background: `radial-gradient(ellipse 100% 90% at 50% 0%, ${glowColor} 0%, transparent 65%)`,
                  filter: 'blur(4px)',
                  opacity: active ? 1 : 0,
                  transition: 'opacity 0.4s ease',
                }}
              />

              {/* Icon */}
              <Icon
                style={{
                  width: 24,
                  height: 24,
                  color: active ? activeIconColor : inactiveIconColor,
                  position: 'relative',
                  transform: active ? 'scale(1.08)' : 'scale(1)',
                  transition: 'color 0.3s ease, transform 0.3s ease',
                }}
                strokeWidth={1.75}
              />

              {/* Label */}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: active ? 700 : 500,
                  letterSpacing: 0.1,
                  color: active ? activeLabelColor : inactiveLabelColor,
                  lineHeight: 1,
                  position: 'relative',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.3s ease',
                }}
              >
                {tab.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
