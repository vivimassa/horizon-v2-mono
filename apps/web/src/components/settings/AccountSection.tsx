"use client";

import Link from "next/link";
import { UserCircle, Lock, SlidersHorizontal, Bell, ChevronRight, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { accentTint, type Palette as PaletteType } from "@skyhub/ui/theme";
import { useDisplay } from "@/components/display-provider";

interface AccountSectionProps {
  palette: PaletteType;
  isDark: boolean;
  accent: string;
  profileComplete: boolean;
  twoFactorEnabled: boolean;
}

interface AccountItem {
  icon: LucideIcon;
  iconColor: string;
  title: string;
  subtitle: string;
  href?: string;
  badge?: { label: string; color: string };
}

export function AccountSection({ palette, isDark, accent, profileComplete, twoFactorEnabled }: AccountSectionProps) {
  const { fonts: F } = useDisplay();
  const items: AccountItem[] = [
    {
      icon: UserCircle, iconColor: accent,
      title: "Profile", subtitle: "Personal information and contact details",
      href: "/settings/account/profile",
      badge: profileComplete ? { label: "Complete", color: isDark ? "#4ade80" : "#16a34a" } : undefined,
    },
    {
      icon: Lock, iconColor: "#dc2626",
      title: "Password & Security", subtitle: "Password, biometrics, two-factor",
      href: "/settings/account/security",
      badge: twoFactorEnabled
        ? { label: "2FA on", color: isDark ? "#4ade80" : "#16a34a" }
        : { label: "2FA off", color: isDark ? "#fbbf24" : "#b45309" },
    },
    {
      icon: Bell, iconColor: "#b45309",
      title: "Notifications", subtitle: "Push notifications, email alerts, in-app",
    },
    {
      icon: SlidersHorizontal, iconColor: "#0f766e",
      title: "Preferences", subtitle: "Language, timezone, date format, units",
      href: "/settings/account/preferences",
    },
  ];

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        backgroundColor: palette.card,
        borderColor: palette.cardBorder,
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      <div className="flex items-center" style={{ padding: "clamp(14px, 1.2vw, 20px) clamp(18px, 1.5vw, 28px)" }}>
        <div className="w-[3px] h-5 rounded-full mr-2.5" style={{ backgroundColor: accent }} />
        <h2 style={{ fontSize: "clamp(15px, 1.2vw, 20px)", fontWeight: 700, color: palette.text }}>Account</h2>
      </div>
        {items.map((item, i) => (
          <AccountListItem
            key={item.title}
            item={item}
            isLast={i === items.length - 1}
            palette={palette}
            isDark={isDark}
          />
        ))}
    </div>
  );
}

function AccountListItem({
  item, isLast, palette, isDark,
}: {
  item: AccountItem; isLast: boolean; palette: PaletteType; isDark: boolean;
}) {
  const { fonts: F } = useDisplay();
  const Icon = item.icon;

  const content = (
    <div
      className="flex items-center cursor-pointer transition-colors"
      style={{ padding: "clamp(12px, 1vw, 18px) clamp(16px, 1.2vw, 24px)", minHeight: "clamp(48px, 4vw, 64px)" }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = palette.backgroundHover)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
    >
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          width: "clamp(38px, 2.8vw, 48px)", height: "clamp(38px, 2.8vw, 48px)", borderRadius: 12, marginRight: "clamp(12px, 1vw, 16px)",
          backgroundColor: accentTint(item.iconColor, isDark ? 0.12 : 0.06),
        }}
      >
        <Icon style={{ width: "clamp(18px, 1.5vw, 24px)", height: "clamp(18px, 1.5vw, 24px)", color: item.iconColor }} strokeWidth={1.6} />
      </div>
      <div className="flex-1 min-w-0" style={{ marginRight: 12 }}>
        <div style={{ fontSize: "clamp(14px, 1vw, 16px)", fontWeight: 500, color: palette.text }}>{item.title}</div>
        <div style={{ fontSize: "clamp(12px, 0.85vw, 14px)", color: palette.textSecondary, marginTop: 2 }}>{item.subtitle}</div>
      </div>
      <div className="flex items-center shrink-0" style={{ gap: 8 }}>
        {item.badge && (
          <div className="flex items-center" style={{ gap: 4 }}>
            {item.badge.label === "Complete" && <Check size={14} style={{ color: item.badge.color }} strokeWidth={2.5} />}
            <span style={{ fontSize: F.min, fontWeight: 600, color: item.badge.color }}>
              {item.badge.label}
            </span>
          </div>
        )}
        <ChevronRight style={{ width: 20, height: 20, color: palette.textTertiary }} />
      </div>
    </div>
  );

  return (
    <>
      {item.href ? <Link href={item.href}>{content}</Link> : content}
      {!isLast && (
        <div style={{ height: 1, backgroundColor: palette.border, marginLeft: 84, marginRight: 20 }} />
      )}
    </>
  );
}
