"use client";

import Link from "next/link";
import { Database, ShieldCheck, ArrowLeftRight, Building2, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { accentTint, type Palette as PaletteType } from "@skyhub/ui/theme";
import { WEB_FONTS as F } from "@/lib/fonts";

interface AdminCard {
  icon: LucideIcon;
  iconColor: string;
  title: string;
  subtitle: string;
  href?: string;
}

interface AdminSectionProps {
  palette: PaletteType;
  isDark: boolean;
  accent: string;
}

export function AdminSection({ palette, isDark, accent }: AdminSectionProps) {
  const cards: AdminCard[] = [
    { icon: Database, iconColor: accent, title: "Master Database", subtitle: "Airports, aircraft types, airlines, reference data", href: "/admin" },
    { icon: ShieldCheck, iconColor: "#7c3aed", title: "Users & Roles", subtitle: "User accounts, role assignment, RBAC permissions" },
    { icon: ArrowLeftRight, iconColor: "#0f766e", title: "Interface", subtitle: "AMOS, SSIM, MVT integrations and message hub" },
    { icon: Building2, iconColor: "#b45309", title: "Operator Config", subtitle: "Airline settings, base airports, fleet configuration" },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center mb-3">
        <div className="w-[3px] h-5 rounded-full mr-2.5" style={{ backgroundColor: "#7c3aed" }} />
        <h2 style={{ fontSize: F.md, fontWeight: 700, color: palette.text }}>Administration</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1" style={{ gridAutoRows: "1fr" }}>
        {cards.map((card) => (
          <AdminCardItem key={card.title} card={card} palette={palette} isDark={isDark} />
        ))}
      </div>
    </div>
  );
}

function AdminCardItem({ card, palette, isDark }: { card: AdminCard; palette: PaletteType; isDark: boolean }) {
  const Icon = card.icon;

  const content = (
    <div
      className="flex items-center cursor-pointer transition-all h-full"
      style={{
        padding: "20px 20px",
        borderRadius: 16,
        minHeight: 90,
        backgroundColor: palette.card,
        border: `1px solid ${palette.cardBorder}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
        e.currentTarget.style.borderColor = accentTint(card.iconColor, 0.2);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)";
        e.currentTarget.style.borderColor = palette.cardBorder;
      }}
    >
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          width: 48, height: 48, borderRadius: 24, marginRight: 16,
          backgroundColor: accentTint(card.iconColor, isDark ? 0.12 : 0.06),
        }}
      >
        <Icon style={{ width: 24, height: 24, color: card.iconColor }} strokeWidth={1.6} />
      </div>
      <div className="flex-1 min-w-0" style={{ marginRight: 8 }}>
        <div style={{ fontSize: F.md, fontWeight: 600, color: palette.text }}>{card.title}</div>
        <div style={{ fontSize: F.sm, color: palette.textSecondary, marginTop: 3 }}>{card.subtitle}</div>
      </div>
      <ChevronRight style={{ width: 20, height: 20, color: palette.textTertiary, flexShrink: 0 }} />
    </div>
  );

  return card.href ? <Link href={card.href}>{content}</Link> : content;
}
