"use client";

import Link from "next/link";
import { useTheme } from "@/components/theme-provider";
import { colors, accentTint, type Palette as PaletteType } from "@skyhub/ui/theme";
import {
  Database,
  Globe,
  Plane,
  Truck,
  Users,
  PlaneTakeoff,
  Building2,
  ArrowLeftRight,
  Armchair,
  Timer,
  Tag,
  UserRound,
  FileCheck,
  MapPin,
  ChevronRight,
  PackageOpen,
  Activity,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Section & card definitions ──

interface CardDef {
  code: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  href: string;
}

interface SectionDef {
  num: string;
  code: string;
  label: string;
  icon: LucideIcon;
  color: string;
  cards: CardDef[];
}

const SECTIONS: SectionDef[] = [
  {
    num: "I",
    code: "5.1",
    label: "Network",
    icon: Globe,
    color: "#0f766e",
    cards: [
      { code: "5.1.1", label: "Countries", desc: "ISO codes, regions, currency", icon: Globe, href: "/admin/countries" },
      { code: "5.1.2", label: "Airports", desc: "ICAO/IATA codes, coordinates, facilities", icon: PlaneTakeoff, href: "/admin/airports" },
      { code: "5.1.3", label: "Citypairs", desc: "Routes, distances, block times", icon: ArrowLeftRight, href: "/admin/city-pairs" },
      { code: "5.1.4", label: "LOPA", desc: "Cabin classes and seat configurations", icon: Armchair, href: "/admin/lopa" },
      { code: "5.1.5", label: "Flight Service Types", desc: "Define flight service types for your operation", icon: Tag, href: "/admin/service-types" },
    ],
  },
  {
    num: "II",
    code: "5.2",
    label: "Flight Ops",
    icon: Plane,
    color: "#1e40af",
    cards: [
      { code: "5.2.1", label: "Aircraft Types", desc: "Fleet types, capacity, performance", icon: Plane, href: "/admin/aircraft-types" },
      { code: "5.2.2", label: "Aircraft Registrations", desc: "Tail numbers, MSN, status, home base", icon: PlaneTakeoff, href: "/admin/aircraft-registrations" },
      { code: "5.2.3", label: "Delay Codes", desc: "IATA standard & custom codes", icon: Timer, href: "/admin/delay-codes" },
    ],
  },
  {
    num: "III",
    code: "5.3",
    label: "Ground Ops",
    icon: Truck,
    color: "#b45309",
    cards: [],
  },
  {
    num: "IV",
    code: "5.4",
    label: "Crew Ops",
    icon: Users,
    color: "#7c3aed",
    cards: [
      { code: "5.4.1", label: "Crew Bases", desc: "Airport crew home bases & reporting times", icon: MapPin, href: "/admin/crew-bases" },
      { code: "5.4.2", label: "Crew Positions", desc: "Cockpit & cabin roles, rank order", icon: UserRound, href: "/admin/crew-positions" },
      { code: "5.4.3", label: "Expiry Codes", desc: "Qualification validity & formulas", icon: FileCheck, href: "/admin/expiry-codes" },
      { code: "5.4.4", label: "Activity Codes", desc: "Duty, standby, training & leave classification", icon: Activity, href: "/admin/activity-codes" },
    ],
  },
];

// ── Page ──

export default function AdminPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const palette: PaletteType = isDark ? colors.dark : colors.light;
  const accent = "#1e40af";

  return (
    <div className="px-6 py-5">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: accentTint(accent, isDark ? 0.15 : 0.1) }}
        >
          <Database size={18} color={accent} strokeWidth={1.8} />
        </div>
        <div>
          <h1
            className="text-[22px] font-bold leading-tight"
            style={{ color: palette.text }}
          >
            Master Database
          </h1>
          <p
            className="text-[13px] leading-tight"
            style={{ color: palette.textSecondary }}
          >
            Reference data across all operational domains
          </p>
        </div>
      </div>

      {/* Sections — 4 columns */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {SECTIONS.map((section) => (
          <DomainSection
            key={section.num}
            section={section}
            palette={palette}
            isDark={isDark}
          />
        ))}
      </div>
    </div>
  );
}

// ── Domain section ──

function DomainSection({
  section,
  palette,
  isDark,
}: {
  section: SectionDef;
  palette: PaletteType;
  isDark: boolean;
}) {
  const SectionIcon = section.icon;

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-1 h-7 rounded-full"
          style={{ background: section.color }}
        />
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ background: accentTint(section.color, isDark ? 0.15 : 0.1) }}
        >
          <SectionIcon size={15} color={section.color} strokeWidth={1.8} />
        </div>
        <span
          className="text-[15px] font-semibold"
          style={{ color: palette.text }}
        >
          {section.label}
        </span>
      </div>

      {/* Cards or empty state */}
      {section.cards.length > 0 ? (
        <div className="flex flex-col gap-3">
          {section.cards.map((card) => (
            <EntityCard
              key={card.code}
              card={card}
              sectionColor={section.color}
              palette={palette}
              isDark={isDark}
            />
          ))}
        </div>
      ) : (
        <div
          className="rounded-xl border border-dashed py-6 px-5 flex items-center gap-3"
          style={{
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
            background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
          }}
        >
          <PackageOpen
            size={20}
            strokeWidth={1.5}
            style={{ color: palette.textTertiary }}
          />
          <div>
            <p
              className="text-[13px] font-medium"
              style={{ color: palette.textSecondary }}
            >
              Coming soon
            </p>
            <p
              className="text-[11px] mt-0.5"
              style={{ color: palette.textTertiary }}
            >
              Gate config, handling agents, equipment types
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Entity card ──

function EntityCard({
  card,
  sectionColor,
  palette,
  isDark,
}: {
  card: CardDef;
  sectionColor: string;
  palette: PaletteType;
  isDark: boolean;
}) {
  const Icon = card.icon;

  return (
    <Link href={card.href}>
      <div
        className="group rounded-xl px-4 py-4 transition-all duration-150 cursor-pointer"
        style={{
          background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
          boxShadow: isDark
            ? "0 1px 3px rgba(0,0,0,0.3)"
            : "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = isDark
            ? "0 4px 12px rgba(0,0,0,0.4)"
            : "0 4px 12px rgba(0,0,0,0.08)";
          e.currentTarget.style.borderColor = accentTint(sectionColor, isDark ? 0.3 : 0.2);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = isDark
            ? "0 1px 3px rgba(0,0,0,0.3)"
            : "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)";
          e.currentTarget.style.borderColor = isDark
            ? "rgba(255,255,255,0.08)"
            : "rgba(0,0,0,0.06)";
        }}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: accentTint(sectionColor, isDark ? 0.15 : 0.1) }}
          >
            <Icon size={16} color={sectionColor} strokeWidth={1.8} />
          </div>
          {/* Label + desc */}
          <div className="flex-1 min-w-0">
            <div
              className="text-[13px] font-semibold leading-tight"
              style={{ color: palette.text }}
            >
              {card.label}
            </div>
            <div
              className="text-[11px] leading-snug mt-0.5 truncate"
              style={{ color: palette.textTertiary }}
            >
              {card.desc}
            </div>
          </div>
          {/* Code + chevron */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className="font-mono text-[10px] font-semibold"
              style={{ color: palette.textTertiary }}
            >
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
  );
}
