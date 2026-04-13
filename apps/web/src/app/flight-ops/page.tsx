'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTheme } from '@/components/theme-provider'
import { colors, accentTint, type Palette as PaletteType } from '@skyhub/ui/theme'
import {
  Plane,
  Radar,
  Map,
  AlertTriangle,
  Wrench,
  Info,
  MessageSquare,
  FileText,
  ShieldCheck,
  BarChart3,
  CalendarDays,
  CalendarClock,
  ChevronRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/* ── Types ── */

interface SubPageDef {
  code: string
  label: string
  href: string
  icon: LucideIcon
}

interface CardDef {
  code: string
  label: string
  desc: string
  icon: LucideIcon
  href: string
  subPages?: SubPageDef[]
}

interface SectionDef {
  num: string
  label: string
  icon: LucideIcon
  color: string
  cards: CardDef[]
}

/* ── Data (sections follow V1 convention: I, II, III) ── */

const SECTIONS: SectionDef[] = [
  {
    num: 'I',
    label: 'Ops Control',
    icon: Radar,
    color: '#1e40af',
    cards: [
      {
        code: '2.1.1',
        label: 'Movement Control',
        desc: 'Real-time aircraft movement tracking & OOOI',
        icon: Radar,
        href: '/flight-ops/control/movement-control',
      },
      {
        code: '2.1.2',
        label: 'Aircraft Maintenance',
        desc: 'Maintenance check configuration & scheduling',
        icon: Wrench,
        href: '/flight-ops/control/aircraft-maintenance',
        subPages: [
          {
            code: '2.1.2.1',
            label: 'Maintenance Planning',
            href: '/flight-ops/control/aircraft-maintenance/planning',
            icon: CalendarClock,
          },
          {
            code: '2.1.2.2',
            label: 'Status Board',
            href: '/flight-ops/control/aircraft-maintenance/status-board',
            icon: BarChart3,
          },
        ],
      },
      {
        code: '2.1.3',
        label: 'World Map',
        desc: 'Global fleet positions & tracking',
        icon: Map,
        href: '/flight-ops/control/world-map',
      },
      {
        code: '2.1.4',
        label: 'Disruption Center',
        desc: 'IROPS management & recovery',
        icon: AlertTriangle,
        href: '/flight-ops/control/disruption-center',
      },
    ],
  },
  {
    num: 'II',
    label: 'Tools',
    icon: Wrench,
    color: '#7c3aed',
    cards: [
      {
        code: '2.2.1',
        label: 'Flight Info',
        desc: 'Detailed flight view & data',
        icon: Info,
        href: '/flight-ops/tools/flight-info',
      },
      {
        code: '2.2.2',
        label: 'Messages',
        desc: 'MVT/LDM message management',
        icon: MessageSquare,
        href: '/flight-ops/tools/messages',
      },
      {
        code: '2.2.3',
        label: 'Movement Log',
        desc: 'Historical movement records',
        icon: FileText,
        href: '/flight-ops/tools/movement-log',
      },
    ],
  },
  {
    num: 'III',
    label: 'Aircraft Status',
    icon: ShieldCheck,
    color: '#0f766e',
    cards: [
      {
        code: '2.3.1',
        label: 'Health Dashboard',
        desc: 'Aircraft health overview & alerts',
        icon: BarChart3,
        href: '/flight-ops/aircraft-status/health-dashboard',
      },
      {
        code: '2.3.2',
        label: 'Check Setup',
        desc: 'Maintenance check configuration',
        icon: ShieldCheck,
        href: '/admin/maintenance-checks',
      },
      {
        code: '2.3.3',
        label: 'Event Schedule',
        desc: 'Schedule maintenance events',
        icon: CalendarDays,
        href: '/flight-ops/aircraft-status/event-schedule',
      },
    ],
  },
]

/* ── Page ── */

export default function FlightOpsPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette: PaletteType = isDark ? colors.dark : colors.light

  return (
    <div className="px-6 py-5">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: accentTint('#1e40af', isDark ? 0.15 : 0.1) }}
        >
          <Plane size={18} color="#1e40af" strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="text-[22px] font-bold leading-tight" style={{ color: palette.text }}>
            Flight Operations
          </h1>
          <p className="text-[13px] leading-tight" style={{ color: palette.textSecondary }}>
            Real-time flight operations, movement management, and aircraft status
          </p>
        </div>
      </div>

      {/* Sections — 3 columns */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {SECTIONS.map((section) => (
          <DomainSection key={section.num} section={section} palette={palette} isDark={isDark} />
        ))}
      </div>
    </div>
  )
}

/* ── Section column ── */

function DomainSection({ section, palette, isDark }: { section: SectionDef; palette: PaletteType; isDark: boolean }) {
  const SectionIcon = section.icon
  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-1 h-7 rounded-full" style={{ background: section.color }} />
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ background: accentTint(section.color, isDark ? 0.15 : 0.1) }}
        >
          <SectionIcon size={15} color={section.color} strokeWidth={1.8} />
        </div>
        <span className="text-[15px] font-semibold" style={{ color: palette.text }}>
          {section.label}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {section.cards.map((card) => (
          <EntityCard key={card.code} card={card} sectionColor={section.color} palette={palette} isDark={isDark} />
        ))}
      </div>
    </section>
  )
}

/* ── Card component ── */

function EntityCard({
  card,
  sectionColor,
  palette,
  isDark,
}: {
  card: CardDef
  sectionColor: string
  palette: PaletteType
  isDark: boolean
}) {
  const Icon = card.icon
  const [expanded, setExpanded] = useState(false)
  const hasSubPages = card.subPages && card.subPages.length > 0

  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const shadow = isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)'
  const hoverShadow = isDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.08)'

  const header = (
    <div className="flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: accentTint(sectionColor, isDark ? 0.15 : 0.1) }}
      >
        <Icon size={16} color={sectionColor} strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold leading-tight" style={{ color: palette.text }}>
          {card.label}
        </div>
        <div className="text-[13px] leading-snug mt-0.5 truncate" style={{ color: palette.textTertiary }}>
          {hasSubPages ? `${card.subPages!.length} pages` : card.desc}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="font-mono text-[13px] font-semibold" style={{ color: palette.textTertiary }}>
          {card.code}
        </span>
        <ChevronRight
          size={13}
          strokeWidth={1.8}
          className="transition-transform duration-150"
          style={{
            color: palette.textTertiary,
            transform: hasSubPages && expanded ? 'rotate(90deg)' : undefined,
          }}
        />
      </div>
    </div>
  )

  if (!hasSubPages) {
    return (
      <Link href={card.href}>
        <div
          className="group rounded-xl px-4 py-4 transition-all duration-150 cursor-pointer"
          style={{ background: cardBg, border: `1px solid ${cardBorder}`, boxShadow: shadow }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = hoverShadow
            e.currentTarget.style.borderColor = accentTint(sectionColor, isDark ? 0.3 : 0.2)
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = shadow
            e.currentTarget.style.borderColor = cardBorder
          }}
        >
          {header}
        </div>
      </Link>
    )
  }

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-150"
      style={{ background: cardBg, border: `1px solid ${cardBorder}`, boxShadow: shadow }}
    >
      {/* Expandable header */}
      <div
        className="px-4 py-4 cursor-pointer transition-colors"
        onClick={() => setExpanded((v) => !v)}
        onMouseEnter={(e) => {
          e.currentTarget.parentElement!.style.boxShadow = hoverShadow
          e.currentTarget.parentElement!.style.borderColor = accentTint(sectionColor, isDark ? 0.3 : 0.2)
        }}
        onMouseLeave={(e) => {
          e.currentTarget.parentElement!.style.boxShadow = shadow
          e.currentTarget.parentElement!.style.borderColor = cardBorder
        }}
      >
        {header}
      </div>

      {/* Sub-pages */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}` }}>
          {card.subPages!.map((sub) => {
            const SubIcon = sub.icon
            return (
              <Link key={sub.code} href={sub.href}>
                <div
                  className="flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer"
                  style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}` }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = ''
                  }}
                >
                  <SubIcon size={14} color={sectionColor} strokeWidth={1.8} className="ml-3" />
                  <span className="flex-1 text-[13px] font-medium" style={{ color: palette.text }}>
                    {sub.label}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono text-[13px] font-semibold" style={{ color: palette.textTertiary }}>
                      {sub.code}
                    </span>
                    <ChevronRight size={13} strokeWidth={1.8} style={{ color: palette.textTertiary }} />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
