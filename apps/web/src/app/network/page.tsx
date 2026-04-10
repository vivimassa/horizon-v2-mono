"use client";

import Link from "next/link";
import { useTheme } from "@/components/theme-provider";
import { colors, accentTint, type Palette as PaletteType } from "@skyhub/ui/theme";
import {
  Globe,
  LayoutGrid,
  PenLine,
  GanttChart,
  Clock,
  PlayCircle,
  Link2,
  Timer,
  Plane,
  MessageSquare,
  PackageOpen,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface CardDef {
  code: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  href: string;
}

interface SectionDef {
  num: string;
  label: string;
  icon: LucideIcon;
  color: string;
  cards: CardDef[];
}

const SECTIONS: SectionDef[] = [
  {
    num: "I",
    label: "Schedule Planning",
    icon: PenLine,
    color: "#1e40af",
    cards: [
      { code: "1.1.1", label: "Scheduling XL", desc: "Excel-style flight schedule editor", icon: LayoutGrid, href: "/network/control/schedule-grid" },
      { code: "1.1.2", label: "Gantt Chart", desc: "Fleet utilization, tail assignment, conflicts", icon: GanttChart, href: "/network/schedule/gantt" },
      { code: "1.1.3", label: "Slot Planning", desc: "Airport slot allocations & IATA 80/20", icon: Clock, href: "/network/schedule/slot-manager" },
    ],
  },
  {
    num: "II",
    label: "Schedule Administration",
    icon: PlayCircle,
    color: "#7c3aed",
    cards: [
      { code: "1.1.4", label: "Codeshare Manager", desc: "Partner designators & marketing carriers", icon: Link2, href: "/network/control/codeshare-manager" },
      { code: "1.1.5", label: "Charter Manager", desc: "Ad-hoc and charter flight operations", icon: Plane, href: "/network/control/charter-manager" },
    ],
  },
  {
    num: "III",
    label: "Schedule Distribution",
    icon: MessageSquare,
    color: "#0f766e",
    cards: [
      { code: "1.1.7", label: "Schedule Messaging", desc: "ASM/SSM messages for partners and GDS", icon: MessageSquare, href: "/network/distribution/messaging" },
    ],
  },
];

export default function NetworkPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const palette: PaletteType = isDark ? colors.dark : colors.light;

  return (
    <div className="px-6 py-5">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: accentTint("#1e40af", isDark ? 0.15 : 0.1) }}
        >
          <Globe size={18} color="#1e40af" strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="text-[22px] font-bold leading-tight" style={{ color: palette.text }}>
            Network Control
          </h1>
          <p className="text-[13px] leading-tight" style={{ color: palette.textSecondary }}>
            Schedule planning, administration, and distribution
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
  );
}

function DomainSection({ section, palette, isDark }: { section: SectionDef; palette: PaletteType; isDark: boolean }) {
  const SectionIcon = section.icon;
  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-1 h-7 rounded-full" style={{ background: section.color }} />
        <div className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ background: accentTint(section.color, isDark ? 0.15 : 0.1) }}>
          <SectionIcon size={15} color={section.color} strokeWidth={1.8} />
        </div>
        <span className="text-[15px] font-semibold" style={{ color: palette.text }}>{section.label}</span>
      </div>
      <div className="flex flex-col gap-3">
        {section.cards.map((card) => (
          <EntityCard key={card.code} card={card} sectionColor={section.color} palette={palette} isDark={isDark} />
        ))}
      </div>
    </section>
  );
}

function EntityCard({ card, sectionColor, palette, isDark }: { card: CardDef; sectionColor: string; palette: PaletteType; isDark: boolean }) {
  const Icon = card.icon;
  return (
    <Link href={card.href}>
      <div
        className="group rounded-xl px-4 py-4 transition-all duration-150 cursor-pointer"
        style={{
          background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
          boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.3)" : "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = isDark ? "0 4px 12px rgba(0,0,0,0.4)" : "0 4px 12px rgba(0,0,0,0.08)";
          e.currentTarget.style.borderColor = accentTint(sectionColor, isDark ? 0.3 : 0.2);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = isDark ? "0 1px 3px rgba(0,0,0,0.3)" : "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)";
          e.currentTarget.style.borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: accentTint(sectionColor, isDark ? 0.15 : 0.1) }}>
            <Icon size={16} color={sectionColor} strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold leading-tight" style={{ color: palette.text }}>{card.label}</div>
            <div className="text-[11px] leading-snug mt-0.5 truncate" style={{ color: palette.textTertiary }}>{card.desc}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-mono text-[10px] font-semibold" style={{ color: palette.textTertiary }}>{card.code}</span>
            <ChevronRight size={13} strokeWidth={1.8}
              className="transition-transform duration-150 group-hover:translate-x-0.5"
              style={{ color: palette.textTertiary }} />
          </div>
        </div>
      </div>
    </Link>
  );
}
