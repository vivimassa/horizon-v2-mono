'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { resolveNavPath, buildBreadcrumbs, type BreadcrumbSegment } from '@skyhub/ui/navigation'
import { useTheme } from '../theme-provider'
import { colors, accentTint, type Palette as PaletteType } from '@skyhub/ui/theme'
import { useGroundOpsStore } from '@/stores/use-ground-ops-store'
import {
  Home,
  Globe,
  Plane,
  Truck,
  Users,
  Settings,
  Calendar,
  Clock,
  Handshake,
  Send,
  Radar,
  Wrench,
  ShieldCheck,
  CalendarDays,
  BarChart3,
  Database,
  UserCircle,
  FileText,
  GanttChart,
  Repeat,
  CalendarRange,
  Info,
  MessageSquare,
  Map,
  AlertTriangle,
  DoorOpen,
  LayoutGrid,
  PlaneTakeoff,
  Lock,
  Bell,
  Palette,
  ArrowLeftRight,
  Building2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  PackageCheck,
  Package,
  Armchair,
  Loader,
  Smartphone,
  Scale,
  FileBarChart,
  PenLine,
  BadgeCheck,
  History,
  TrendingUp,
  ShieldAlert,
  Timer,
  Tag,
  UserRound,
  FileCheck,
  MapPin,
  Activity,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ── Icon resolver ──
const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  Globe,
  Plane,
  Truck,
  Users,
  Settings,
  Calendar,
  Clock,
  Handshake,
  Send,
  Radar,
  Wrench,
  ShieldCheck,
  CalendarDays,
  BarChart3,
  Database,
  UserCircle,
  FileText,
  GanttChart,
  Repeat,
  CalendarRange,
  Info,
  MessageSquare,
  Map,
  AlertTriangle,
  DoorOpen,
  LayoutGrid,
  PlaneTakeoff,
  Lock,
  Bell,
  Palette,
  ArrowLeftRight,
  Building2,
  ClipboardCheck,
  ClipboardList,
  PackageCheck,
  Package,
  Armchair,
  Loader,
  Smartphone,
  Scale,
  FileBarChart,
  PenLine,
  BadgeCheck,
  History,
  TrendingUp,
  ShieldAlert,
  Timer,
  Tag,
  UserRound,
  FileCheck,
  MapPin,
  Activity,
}

function NavIcon({ name, size = 14, color }: { name: string; size?: number; color?: string }) {
  const Icon = ICON_MAP[name]
  if (!Icon) return null
  return <Icon size={size} color={color} strokeWidth={1.8} />
}

// ── Main BreadcrumbNav ──
export function BreadcrumbNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette: PaletteType = isDark ? colors.dark : colors.light
  const accent = isDark ? '#60a5fa' : '#1e40af'

  const navPath = resolveNavPath(pathname)
  const segments = navPath ? buildBreadcrumbs(navPath) : []

  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (openIndex === null) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenIndex(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openIndex])

  // Close on Escape
  useEffect(() => {
    if (openIndex === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenIndex(null)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [openIndex])

  // Close on route change
  useEffect(() => {
    setOpenIndex(null)
  }, [pathname])

  const handleSegmentClick = useCallback((idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx))
  }, [])

  const handleNavigate = useCallback(
    (route: string) => {
      setOpenIndex(null)
      router.push(route)
    },
    [router],
  )

  if (segments.length === 0) return null

  return (
    <nav ref={containerRef} aria-label="Breadcrumb" className="flex items-center gap-1 select-none">
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1
        const isOpen = openIndex === i
        const hasSiblings = seg.siblings.length > 1
        const isModule = seg.level === 'module'
        const isPage = seg.level === 'page'

        return (
          <div key={seg.num} className="flex items-center">
            {/* Separator */}
            {i > 0 && (
              <span
                className="text-[11px] mx-0.5 select-none"
                style={{ color: isDark ? '#888' : palette.textTertiary }}
              >
                ›
              </span>
            )}

            {/* Segment */}
            <div className="relative">
              <button
                onClick={() => {
                  if (isPage && !hasSiblings) return
                  if (isPage && hasSiblings) {
                    handleSegmentClick(i)
                    return
                  }
                  // Section and module segments always open dropdown when they have siblings
                  if (hasSiblings) handleSegmentClick(i)
                  else if (seg.level === 'section') handleNavigate(seg.route)
                  else handleNavigate(seg.route)
                }}
                aria-expanded={isOpen}
                aria-haspopup={hasSiblings ? 'listbox' : undefined}
                className="flex items-center gap-1 py-1.5 px-2.5 rounded-lg transition-colors duration-150"
                style={{
                  background: isPage
                    ? accentTint(accent, isDark ? 0.12 : 0.08)
                    : isOpen
                      ? accentTint(accent, isDark ? 0.12 : 0.06)
                      : 'transparent',
                  cursor: isPage && !hasSiblings ? 'default' : 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (isPage && !hasSiblings) return
                  if (!isOpen && !isPage) {
                    e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (isPage) {
                    e.currentTarget.style.background = accentTint(accent, isDark ? 0.12 : 0.08)
                    return
                  }
                  if (!isOpen) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                {/* Module icon pill */}
                {isModule && (
                  <div
                    className="w-[22px] h-[22px] rounded-md flex items-center justify-center"
                    style={{ background: accentTint(accent, isDark ? 0.15 : 0.1) }}
                  >
                    <NavIcon name={seg.iconName} size={14} color={accent} />
                  </div>
                )}

                {/* Section number (for module & section segments) */}
                {!isPage && !seg.hideNum && (
                  <span className="font-mono text-[10px] mr-0.5" style={{ opacity: 0.45, color: palette.text }}>
                    {seg.num}
                  </span>
                )}

                {/* Label */}
                <span
                  className="text-[13px] whitespace-nowrap"
                  style={{
                    fontWeight: isPage ? 600 : 500,
                    color: isPage ? accent : isDark ? '#c4c4cc' : palette.textSecondary,
                  }}
                >
                  {seg.label}
                </span>

                {/* Chevron — not on active page without siblings */}
                {hasSiblings && !isPage && (
                  <ChevronDown
                    size={10}
                    strokeWidth={2}
                    className="ml-0.5 transition-transform duration-150"
                    style={{
                      opacity: 0.4,
                      color: isOpen ? accent : palette.textTertiary,
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  />
                )}
                {isPage && hasSiblings && (
                  <ChevronDown
                    size={10}
                    strokeWidth={2}
                    className="ml-0.5 transition-transform duration-150"
                    style={{
                      opacity: 0.4,
                      color: accent,
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  />
                )}
              </button>

              {/* Dropdown */}
              {isOpen && (
                <SegmentDropdown
                  segment={seg}
                  palette={palette}
                  accent={accent}
                  isDark={isDark}
                  onItemClick={handleNavigate}
                />
              )}
            </div>
          </div>
        )
      })}

      <style>{`
        @keyframes bc-dropdown-in {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </nav>
  )
}

// ── Dropdown panel ──
function SegmentDropdown({
  segment,
  palette,
  accent,
  isDark,
  onItemClick,
}: {
  segment: BreadcrumbSegment
  palette: PaletteType
  accent: string
  isDark: boolean
  onItemClick: (route: string) => void
}) {
  const showDescs = segment.level === 'page' || segment.showDescriptions

  return (() => {
    // Check if items have groups — if so, render horizontal columns
    const hasGroups = segment.siblings.some((s) => s.group)

    // Build grouped structure
    const groups: { name: string; iconName?: string; items: typeof segment.siblings }[] = []
    if (hasGroups) {
      for (const item of segment.siblings) {
        const gName = item.group || 'Other'
        const existing = groups.find((g) => g.name === gName)
        if (existing) existing.items.push(item)
        else groups.push({ name: gName, iconName: item.groupIconName, items: [item] })
      }
    }

    const renderItem = (item: (typeof segment.siblings)[0]) => {
      const isCurrent = item.num === segment.num
      return (
        <a
          key={item.key}
          href={item.route}
          role="option"
          aria-selected={isCurrent}
          className="relative flex items-center gap-2 w-full px-3 py-2 rounded-lg transition-colors duration-100 cursor-pointer no-underline"
          style={{
            background: isCurrent ? accentTint(accent, isDark ? 0.1 : 0.06) : 'transparent',
          }}
          onClick={(e) => {
            if (!e.metaKey && !e.ctrlKey && e.button === 0) {
              e.preventDefault()
              onItemClick(item.route)
            }
          }}
          onMouseEnter={(e) => {
            if (!isCurrent) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
          }}
          onMouseLeave={(e) => {
            if (!isCurrent) e.currentTarget.style.background = 'transparent'
          }}
        >
          <div
            className="flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0"
            style={{
              background: isCurrent
                ? accentTint(accent, isDark ? 0.18 : 0.1)
                : isDark
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(0,0,0,0.04)',
            }}
          >
            <NavIcon name={item.iconName} size={13} color={isCurrent ? accent : palette.textSecondary} />
          </div>
          <div className="flex-1 text-left min-w-0">
            <span
              className="text-[13px] block"
              style={{
                fontWeight: isCurrent ? 600 : 400,
                color: isCurrent ? accent : palette.text,
              }}
            >
              {item.label}
            </span>
            {showDescs && item.desc && (
              <span className="text-[11px] block mt-0.5 truncate" style={{ color: palette.textTertiary }}>
                {item.desc}
              </span>
            )}
          </div>
          {isCurrent && <div className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ background: accent }} />}
        </a>
      )
    }

    return (
      <div
        role="listbox"
        className="absolute top-full left-0 mt-1.5"
        style={{
          minWidth: hasGroups ? undefined : 220,
          maxWidth: hasGroups ? undefined : segment.showDescriptions ? 340 : 300,
          borderRadius: 12,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          background: isDark ? '#18181b' : '#ffffff',
          boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.4)' : '0 8px 30px rgba(0,0,0,0.12)',
          padding: 6,
          zIndex: 50,
          animation: 'bc-dropdown-in 150ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Non-grouped: section header + flat list */}
        {!hasGroups && segment.parentLabel && (
          <div className="flex items-center gap-2 px-3 pt-1 pb-1.5 mb-0.5">
            <div className="w-0.5 h-3 rounded-full" style={{ background: accent }} />
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: palette.textTertiary }}
            >
              {segment.parentLabel}
            </span>
          </div>
        )}

        {hasGroups ? (
          /* Grouped: horizontal columns */
          <div className="flex gap-1">
            {groups.map((g, gi) => (
              <div key={g.name} className="flex-1" style={{ minWidth: 200 }}>
                {/* Group header */}
                <div className="flex items-center gap-2 px-3 pt-2 pb-2 mb-0.5">
                  {g.iconName && <NavIcon name={g.iconName} size={15} color={palette.textSecondary} />}
                  <span
                    className="text-[12px] font-bold uppercase tracking-wider"
                    style={{ color: palette.textSecondary }}
                  >
                    {g.name}
                  </span>
                </div>
                {/* Group items */}
                {g.items.map(renderItem)}
              </div>
            ))}
          </div>
        ) : (
          /* Non-grouped: flat list */
          segment.siblings.map(renderItem)
        )}
      </div>
    )
  })()
}

// ── Flight context pill (Ground Ops breadcrumb) ──
function FlightContextPill({ accent, palette, isDark }: { accent: string; palette: PaletteType; isDark: boolean }) {
  const selectedFlight = useGroundOpsStore((s) => s.selectedFlight)

  if (selectedFlight) {
    return (
      <div
        className="flex items-center gap-1.5 ml-auto"
        style={{
          background: accentTint(accent, 0.08),
          color: accent,
          border: `1px solid ${accentTint(accent, 0.15)}`,
          padding: '4px 10px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <Plane size={12} strokeWidth={2} style={{ transform: 'rotate(45deg)' }} />
        <span>
          {selectedFlight.id} {selectedFlight.dep}&rarr;{selectedFlight.arr}
        </span>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 ml-auto"
      style={{
        background: palette.backgroundHover,
        color: palette.textSecondary,
        border: `1px solid ${palette.border}`,
        padding: '4px 10px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <Plane size={12} strokeWidth={2} style={{ transform: 'rotate(45deg)' }} />
      <span>Select Flight</span>
    </div>
  )
}
