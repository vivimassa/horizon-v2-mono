'use client'

import Link from 'next/link'
import { useTheme } from '@/components/theme-provider'
import { colors, accentTint, type Palette as PaletteType } from '@skyhub/ui/theme'
import {
  Truck,
  ClipboardList,
  Scale,
  BarChart3,
  Loader,
  PackageCheck,
  AlertTriangle,
  Package,
  Armchair,
  Plane,
  Smartphone,
  MessageSquare,
  PenLine,
  BadgeCheck,
  History,
  TrendingUp,
  ShieldAlert,
  ChevronRight,
  PackageOpen,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface CardDef {
  code: string
  label: string
  desc: string
  icon: LucideIcon
  href: string
}

interface SectionDef {
  num: string
  label: string
  icon: LucideIcon
  color: string
  cards: CardDef[]
}

const ACCENT = '#b45309'

const SECTIONS: SectionDef[] = [
  {
    num: 'I',
    label: 'Planning',
    icon: ClipboardList,
    color: ACCENT,
    cards: [
      {
        code: '4.1.1',
        label: 'Cargo Acceptance',
        desc: 'Review booked cargo, weigh, screen',
        icon: PackageCheck,
        href: '/ground-ops/planning/cargo-acceptance',
      },
      {
        code: '4.1.2',
        label: 'Dangerous Goods',
        desc: 'DG verification & NOTOC generation',
        icon: AlertTriangle,
        href: '/ground-ops/planning/dangerous-goods',
      },
      {
        code: '4.1.3',
        label: 'Loading Plan',
        desc: 'Assign cargo to compartments (LIR)',
        icon: Package,
        href: '/ground-ops/cargo/cargo-manifest',
      },
      {
        code: '4.1.4',
        label: 'Seat Plan',
        desc: 'Pax seating distribution for W&B zones',
        icon: Armchair,
        href: '/ground-ops/planning/seat-plan',
      },
    ],
  },
  {
    num: 'II',
    label: 'Live Loading',
    icon: Loader,
    color: '#d97706',
    cards: [
      {
        code: '4.2.1',
        label: 'SkyHub GO',
        desc: 'Station board, KPIs & flight ops',
        icon: Truck,
        href: '/ground-ops/loading/skyhub-go',
      },
      {
        code: '4.2.2',
        label: 'Flight Loading',
        desc: 'Unified cargo + pax live view',
        icon: Plane,
        href: '/ground-ops/loading/flight-loading',
      },
      {
        code: '4.2.3',
        label: 'Handler View',
        desc: 'Ground handler confirmation (SkyHub)',
        icon: Smartphone,
        href: '/ground-ops/loading/handler-view',
      },
    ],
  },
  {
    num: 'III',
    label: 'Load Control',
    icon: Scale,
    color: '#92400e',
    cards: [
      {
        code: '4.3.1',
        label: 'Load Summary',
        desc: 'Combined pax + cargo + bags dashboard',
        icon: BarChart3,
        href: '/ground-ops/load-control/load-summary',
      },
      {
        code: '4.3.2',
        label: 'Messages',
        desc: 'Generate LDM, CPM, NOTOC',
        icon: MessageSquare,
        href: '/ground-ops/load-control/messages',
      },
      {
        code: '4.3.3',
        label: 'Loadsheet',
        desc: 'Weight & Balance',
        icon: Scale,
        href: '/ground-ops/load-control/loadsheet',
      },
      {
        code: '4.3.4',
        label: 'Last Minute Changes',
        desc: 'Recalculate after late changes',
        icon: PenLine,
        href: '/ground-ops/load-control/lmc',
      },
      {
        code: '4.3.5',
        label: 'Captain Acceptance',
        desc: 'Digital sign-off, push to EFB',
        icon: BadgeCheck,
        href: '/ground-ops/load-control/captain-acceptance',
      },
    ],
  },
  {
    num: 'IV',
    label: 'Reports',
    icon: BarChart3,
    color: '#78350f',
    cards: [
      {
        code: '4.4.1',
        label: 'Loading History',
        desc: 'Archived loadsheets & messages',
        icon: History,
        href: '/ground-ops/reports/loading-history',
      },
      {
        code: '4.4.2',
        label: 'Ground Performance',
        desc: 'Turnaround times & load factors',
        icon: TrendingUp,
        href: '/ground-ops/reports/ground-performance',
      },
      {
        code: '4.4.3',
        label: 'DG Log',
        desc: 'Dangerous goods audit trail',
        icon: ShieldAlert,
        href: '/ground-ops/reports/dg-log',
      },
    ],
  },
]

export default function GroundOpsPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette: PaletteType = isDark ? colors.dark : colors.light

  return (
    <div className="px-6 py-5">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: accentTint(ACCENT, isDark ? 0.15 : 0.1) }}
        >
          <Truck size={18} color={ACCENT} strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="text-[22px] font-bold leading-tight" style={{ color: palette.text }}>
            Ground Ops
          </h1>
          <p className="text-[13px] leading-tight" style={{ color: palette.textSecondary }}>
            Cargo, loading, weight & balance, and loadsheet management
          </p>
        </div>
      </div>

      {/* Sections — 4 columns */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {SECTIONS.map((section) => (
          <DomainSection key={section.num} section={section} palette={palette} isDark={isDark} />
        ))}
      </div>
    </div>
  )
}

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
        {section.cards.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.code} href={card.href}>
              <div
                className="group rounded-xl px-4 py-4 transition-all duration-150 cursor-pointer"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                  boxShadow: isDark
                    ? '0 1px 3px rgba(0,0,0,0.3)'
                    : '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = isDark
                    ? '0 4px 12px rgba(0,0,0,0.4)'
                    : '0 4px 12px rgba(0,0,0,0.08)'
                  e.currentTarget.style.borderColor = accentTint(section.color, isDark ? 0.3 : 0.2)
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = isDark
                    ? '0 1px 3px rgba(0,0,0,0.3)'
                    : '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)'
                  e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: accentTint(section.color, isDark ? 0.15 : 0.1) }}
                  >
                    <Icon size={16} color={section.color} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold leading-tight" style={{ color: palette.text }}>
                      {card.label}
                    </div>
                    <div className="text-[11px] leading-snug mt-0.5 truncate" style={{ color: palette.textTertiary }}>
                      {card.desc}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono text-[10px] font-semibold" style={{ color: palette.textTertiary }}>
                      {card.code}
                    </span>
                    <ChevronRight
                      size={13}
                      strokeWidth={1.8}
                      className="transition-transform duration-150 group-hover:translate-x-0.5"
                      style={{ color: palette.textTertiary }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
