"use client";

import Link from "next/link";
import { Database, ShieldCheck, ArrowLeftRight, Building2, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { accentTint, type Palette as PaletteType } from "@skyhub/ui/theme";
import { useDisplay } from "@/components/display-provider";

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
  const { fonts: F } = useDisplay();
  const cards: AdminCard[] = [
    { icon: Database, iconColor: accent, title: "Master Database", subtitle: "Airports, aircraft types, airlines, reference data", href: "/admin" },
    { icon: ShieldCheck, iconColor: "#7c3aed", title: "Users & Roles", subtitle: "User accounts, role assignment, RBAC permissions" },
    { icon: ArrowLeftRight, iconColor: "#0f766e", title: "Interface", subtitle: "AMOS, SSIM, MVT integrations and message hub" },
    { icon: Building2, iconColor: "#b45309", title: "Operator Config", subtitle: "Airline settings, base airports, fleet configuration", href: "/settings/admin/operator-config" },
  ];

  return (
    <div
      className="flex flex-col h-full rounded-2xl border"
      style={{
        backgroundColor: palette.card,
        borderColor: palette.cardBorder,
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      <div className="flex items-center" style={{ padding: "clamp(14px, 1.2vw, 20px) clamp(18px, 1.5vw, 28px)" }}>
        <div className="w-[3px] h-5 rounded-full mr-2.5" style={{ backgroundColor: "#7c3aed" }} />
        <h2 style={{ fontSize: "clamp(15px, 1.2vw, 20px)", fontWeight: 700, color: palette.text }}>Administration</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 flex-1" style={{ gap: "clamp(10px, 1vw, 16px)", gridAutoRows: "1fr", padding: "0 clamp(14px, 1.2vw, 20px) clamp(14px, 1.2vw, 20px)" }}>
        {cards.map((card) => (
          <AdminCardItem key={card.title} card={card} palette={palette} isDark={isDark} />
        ))}
      </div>
    </div>
  );
}

function AdminCardItem({ card, palette, isDark }: { card: AdminCard; palette: PaletteType; isDark: boolean }) {
  const { fonts: F } = useDisplay();
  const Icon = card.icon;

  const content = (
    <div
      className="flex items-center cursor-pointer transition-all h-full"
      style={{
        padding: "clamp(14px, 1.2vw, 22px) clamp(16px, 1.2vw, 24px)",
        borderRadius: 14,
        minHeight: "clamp(64px, 5vw, 88px)",
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
          width: "clamp(38px, 2.8vw, 48px)", height: "clamp(38px, 2.8vw, 48px)", borderRadius: 24, marginRight: "clamp(12px, 1vw, 16px)",
          backgroundColor: accentTint(card.iconColor, isDark ? 0.12 : 0.06),
        }}
      >
        <Icon style={{ width: "clamp(18px, 1.5vw, 24px)", height: "clamp(18px, 1.5vw, 24px)", color: card.iconColor }} strokeWidth={1.6} />
      </div>
      <div className="flex-1 min-w-0" style={{ marginRight: 8 }}>
        <div style={{ fontSize: "clamp(14px, 1vw, 16px)", fontWeight: 600, color: palette.text }}>{card.title}</div>
        <div style={{ fontSize: "clamp(12px, 0.85vw, 14px)", color: palette.textSecondary, marginTop: 2 }}>{card.subtitle}</div>
      </div>
      <ChevronRight style={{ width: "clamp(18px, 1.4vw, 24px)", height: "clamp(18px, 1.4vw, 24px)", color: palette.textTertiary, flexShrink: 0 }} />
    </div>
  );

  return card.href ? <Link href={card.href}>{content}</Link> : content;
}
