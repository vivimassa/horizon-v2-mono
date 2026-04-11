'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTheme } from '@/components/theme-provider'
import { colors, accentTint, type Palette as PaletteType } from '@skyhub/ui/theme'
import {
  Globe,
  LayoutGrid,
  PenLine,
  GanttChart,
  Clock,
  Handshake,
  Link2,
  Plane,
  Send,
  MessageSquare,
  BarChart3,
  Calendar,
  CalendarDays,
  FileText,
  ArrowLeftRight,
  Grid3X3,
  PlaneTakeoff,
  TrendingUp,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/* ── Types ── */

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

interface ReportGroupDef {
  code: string
  label: string
  icon: LucideIcon
  cards: CardDef[]
}

/* ── Data ── */

const SECTIONS: SectionDef[] = [
  {
    num: 'I',
    label: 'Schedule Build',
    icon: PenLine,
    color: '#1e40af',
    cards: [
      {
        code: '1.1.1',
        label: 'Scheduling XL',
        desc: 'Excel-style flight schedule editor',
        icon: LayoutGrid,
        href: '/network/control/schedule-grid',
      },
      {
        code: '1.1.2',
        label: 'Gantt Chart',
        desc: 'Fleet utilization, tail assignment, conflicts',
        icon: GanttChart,
        href: '/network/schedule/gantt',
      },
      {
        code: '1.1.3',
        label: 'Slot Planning',
        desc: 'Airport slot allocations & IATA 80/20',
        icon: Clock,
        href: '/network/schedule/slot-manager',
      },
    ],
  },
  {
    num: 'II',
    label: 'Partners & Charter',
    icon: Handshake,
    color: '#7c3aed',
    cards: [
      {
        code: '1.2.1',
        label: 'Codeshare Manager',
        desc: 'Partner designators & marketing carriers',
        icon: Link2,
        href: '/network/control/codeshare-manager',
      },
      {
        code: '1.2.2',
        label: 'Charter Manager',
        desc: 'Ad-hoc and charter flight operations',
        icon: Plane,
        href: '/network/control/charter-manager',
      },
    ],
  },
  {
    num: 'III',
    label: 'Distribution',
    icon: Send,
    color: '#0f766e',
    cards: [
      {
        code: '1.3.1',
        label: 'Schedule Messaging',
        desc: 'ASM/SSM messages for partners and GDS',
        icon: MessageSquare,
        href: '/network/control/schedule-messaging',
      },
    ],
  },
]

const REPORT_SECTION_COLOR = '#b45309'

const REPORT_GROUPS: ReportGroupDef[] = [
  {
    code: '1.4.1',
    label: 'Schedule Reports',
    icon: Calendar,
    cards: [
      {
        code: '1.4.1.1',
        label: 'Daily Flight Schedule',
        desc: 'Daily flight list with times, tail & type assignment',
        icon: CalendarDays,
        href: '/network/reports/daily-schedule',
      },
      {
        code: '1.4.1.2',
        label: 'Frequency Analysis',
        desc: 'Flight frequencies by day-of-week & seasonal patterns',
        icon: BarChart3,
        href: '/network/reports/frequency-analysis',
      },
      {
        code: '1.4.1.3',
        label: 'Schedule Summary',
        desc: 'Season overview — fleet deployment & capacity trends',
        icon: FileText,
        href: '/network/reports/schedule-summary',
      },
      {
        code: '1.4.1.4',
        label: 'Public Timetable',
        desc: 'Passenger-facing timetable by route with local times',
        icon: Clock,
        href: '/network/reports/public-timetable',
      },
    ],
  },
  {
    code: '1.4.2',
    label: 'Route & Network',
    icon: Globe,
    cards: [
      {
        code: '1.4.2.1',
        label: 'Route Summary',
        desc: 'City pairs with block time, frequency & capacity',
        icon: ArrowLeftRight,
        href: '/network/reports/route-summary',
      },
      {
        code: '1.4.2.2',
        label: 'Route Matrix',
        desc: 'Station-pair heatmap — frequency, seats & ASK',
        icon: Grid3X3,
        href: '/network/reports/route-matrix',
      },
      {
        code: '1.4.2.3',
        label: 'Airport Activity',
        desc: 'Departures, arrivals & peak hours per station',
        icon: PlaneTakeoff,
        href: '/network/reports/airport-activity',
      },
    ],
  },
  {
    code: '1.4.3',
    label: 'Market',
    icon: TrendingUp,
    cards: [
      {
        code: '1.4.3.1',
        label: 'Market Analysis',
        desc: 'O&D market stats, competition & capacity analysis',
        icon: TrendingUp,
        href: '/network/reports/market-analysis',
      },
    ],
  },
]

/* ── Page ── */

export default function NetworkPage() {
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
          <Globe size={18} color="#1e40af" strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="text-[22px] font-bold leading-tight" style={{ color: palette.text }}>
            Network Control
          </h1>
          <p className="text-[13px] leading-tight" style={{ color: palette.textSecondary }}>
            Build, partner, distribute, and analyze your schedule
          </p>
        </div>
      </div>

      {/* Sections — 4 columns */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {SECTIONS.map((section) => (
          <DomainSection key={section.num} section={section} palette={palette} isDark={isDark} />
        ))}
        <ReportsSection palette={palette} isDark={isDark} />
      </div>
    </div>
  )
}

/* ── Standard section (I, II, III) ── */

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

/* ── Reports section (IV) with accordion sub-groups ── */

function ReportsSection({ palette, isDark }: { palette: PaletteType; isDark: boolean }) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  const toggle = (code: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-1 h-7 rounded-full" style={{ background: REPORT_SECTION_COLOR }} />
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ background: accentTint(REPORT_SECTION_COLOR, isDark ? 0.15 : 0.1) }}
        >
          <BarChart3 size={15} color={REPORT_SECTION_COLOR} strokeWidth={1.8} />
        </div>
        <span className="text-[15px] font-semibold" style={{ color: palette.text }}>
          Reports
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {REPORT_GROUPS.map((group) => (
          <ReportAccordion
            key={group.code}
            group={group}
            isOpen={openGroups.has(group.code)}
            onToggle={() => toggle(group.code)}
            palette={palette}
            isDark={isDark}
          />
        ))}
      </div>
    </section>
  )
}

/* ── Accordion group header + children ── */

function ReportAccordion({
  group,
  isOpen,
  onToggle,
  palette,
  isDark,
}: {
  group: ReportGroupDef
  isOpen: boolean
  onToggle: () => void
  palette: PaletteType
  isDark: boolean
}) {
  const Icon = group.icon
  return (
    <div
      className="rounded-xl transition-all duration-150"
      style={{
        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
        boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
      }}
    >
      {/* Accordion header */}
      <button onClick={onToggle} className="w-full px-4 py-4 cursor-pointer text-left">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: accentTint(REPORT_SECTION_COLOR, isDark ? 0.15 : 0.1) }}
          >
            <Icon size={16} color={REPORT_SECTION_COLOR} strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold leading-tight" style={{ color: palette.text }}>
              {group.label}
            </div>
            <div className="text-[13px] leading-snug mt-0.5" style={{ color: palette.textTertiary }}>
              {group.cards.length} report{group.cards.length > 1 ? 's' : ''}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-mono text-[13px] font-semibold" style={{ color: palette.textTertiary }}>
              {group.code}
            </span>
            <ChevronDown
              size={14}
              strokeWidth={1.8}
              className="transition-transform duration-200"
              style={{
                color: palette.textTertiary,
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </div>
        </div>
      </button>

      {/* Accordion children — inside the same card */}
      {isOpen && (
        <div
          className="flex flex-col px-4 pb-3 pt-0 pl-8 border-t"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
        >
          {group.cards.map((card) => (
            <ReportItem key={card.code} card={card} palette={palette} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Minimal report row ── */

function ReportItem({ card, palette }: { card: CardDef; palette: PaletteType }) {
  const Icon = card.icon
  return (
    <Link href={card.href} className="group flex items-center gap-2 py-1.5">
      <Icon size={13} color={REPORT_SECTION_COLOR} strokeWidth={1.8} className="shrink-0" />
      <span className="text-[13px] leading-tight flex-1 truncate" style={{ color: palette.text }}>
        {card.label}
      </span>
      <span className="font-mono text-[13px]" style={{ color: palette.textTertiary }}>
        {card.code}
      </span>
      <ChevronRight
        size={11}
        strokeWidth={1.8}
        className="transition-transform duration-150 group-hover:translate-x-0.5"
        style={{ color: palette.textTertiary }}
      />
    </Link>
  )
}

/* ── Shared card component ── */

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
  return (
    <Link href={card.href}>
      <div
        className="group rounded-xl px-4 py-4 transition-all duration-150 cursor-pointer"
        style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
          boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = isDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.08)'
          e.currentTarget.style.borderColor = accentTint(sectionColor, isDark ? 0.3 : 0.2)
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
            style={{ background: accentTint(sectionColor, isDark ? 0.15 : 0.1) }}
          >
            <Icon size={16} color={sectionColor} strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold leading-tight" style={{ color: palette.text }}>
              {card.label}
            </div>
            <div className="text-[13px] leading-snug mt-0.5 truncate" style={{ color: palette.textTertiary }}>
              {card.desc}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-mono text-[13px] font-semibold" style={{ color: palette.textTertiary }}>
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
}
