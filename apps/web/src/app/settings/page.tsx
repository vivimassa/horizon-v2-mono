"use client";

import Link from "next/link";
import {
  UserCircle,
  Palette,
  Bell,
  Lock,
  SlidersHorizontal,
  Database,
  ShieldCheck,
  ArrowLeftRight,
  Building2,
  FileText,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { colors, accentTint, type Palette as PaletteType } from "@skyhub/ui/theme";
import { useTheme } from "@/components/theme-provider";

const ACCENT = "#1e40af";
const isAdmin = true;

interface SettingsItem {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  href?: string;
}

const ACCOUNT_ITEMS: SettingsItem[] = [
  { icon: UserCircle,       title: "Profile",             subtitle: "Manage your personal information, contact details, and employee profile", href: "/settings/account/profile" },
  { icon: Palette,           title: "Appearance",          subtitle: "Customize theme, dark mode, accent color, and interface preferences", href: "/settings/account/appearance" },
  { icon: Bell,              title: "Notifications",       subtitle: "Configure push notifications, email alerts, and in-app notification preferences" },
  { icon: Lock,              title: "Password & Security", subtitle: "Update your password, enable biometric authentication, and manage security settings" },
  { icon: SlidersHorizontal, title: "Preferences",         subtitle: "Set your preferred language, timezone, date format, and display units" },
];

const ADMIN_ITEMS: SettingsItem[] = [
  { icon: Database,       title: "Master Data",     subtitle: "Manage airports, aircraft types, airlines, and core reference data",   href: "/admin" },
  { icon: ShieldCheck,    title: "Users & Roles",   subtitle: "Create and manage user accounts, assign roles, and configure RBAC permissions" },
  { icon: ArrowLeftRight, title: "Interface",        subtitle: "Configure AMOS, SSIM, MVT integrations, and external message hub connections" },
  { icon: Building2,      title: "Operator Config",  subtitle: "Manage airline operator settings, base airports, and fleet configuration" },
  { icon: FileText,       title: "Reports",          subtitle: "Access operational reports, analytics dashboards, and data exports" },
];

function SectionHeader({ title, palette }: { title: string; palette: PaletteType }) {
  return (
    <div className="flex items-center mt-8 mb-2">
      <div className="w-[3px] h-4 rounded-full mr-2" style={{ backgroundColor: ACCENT }} />
      <h2 className="text-[15px] font-bold" style={{ color: palette.text, letterSpacing: -0.3 }}>
        {title}
      </h2>
    </div>
  );
}

function SettingsListItem({
  item,
  isLast,
  palette,
}: {
  item: SettingsItem;
  isLast: boolean;
  palette: PaletteType;
  isDark: boolean;
}) {
  const Icon = item.icon;

  const content = (
    <div
      className="flex items-start px-5 py-5 cursor-pointer transition-all rounded-2xl"
      style={{
        backgroundColor: palette.card,
        border: `1px solid ${palette.cardBorder}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = palette.backgroundHover;
        e.currentTarget.style.borderColor = accentTint(ACCENT, 0.2);
        e.currentTarget.style.boxShadow = `0 2px 8px ${accentTint(ACCENT, 0.08)}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = palette.card;
        e.currentTarget.style.borderColor = palette.cardBorder;
        e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)";
      }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mr-4 shrink-0 mt-0.5"
        style={{ backgroundColor: accentTint(ACCENT, 0.08) }}
      >
        <Icon className="h-6 w-6" style={{ color: ACCENT }} strokeWidth={1.6} />
      </div>
      <div className="flex-1 min-w-0 mr-2">
        <div className="text-[16px] font-semibold mb-1" style={{ color: palette.text }}>
          {item.title}
        </div>
        <div className="text-[13px] leading-relaxed" style={{ color: palette.textSecondary }}>
          {item.subtitle}
        </div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 mt-1" style={{ color: palette.textTertiary }} />
    </div>
  );

  if (item.href) {
    return <Link href={item.href}>{content}</Link>;
  }

  return content;
}

export default function SettingsPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const palette: PaletteType = isDark ? colors.dark : colors.light;

  return (
    <div className="min-h-full p-6 pt-2">
      <div className={`flex gap-6 ${isAdmin ? "flex-row items-start" : "flex-col"}`}>
        {/* User Account */}
        <div className="flex-1 min-w-0">
          <SectionHeader title="User Account" palette={palette} />
          <div className="flex flex-col gap-3">
            {ACCOUNT_ITEMS.map((item, i) => (
              <SettingsListItem
                key={item.title}
                item={item}
                isLast={i === ACCOUNT_ITEMS.length - 1}
                palette={palette}
                isDark={isDark}
              />
            ))}
          </div>
        </div>

        {/* System Configuration */}
        {isAdmin && (
          <div className="flex-1 min-w-0">
            <SectionHeader title="System Configuration" palette={palette} />
            <div className="flex flex-col gap-3">
              {ADMIN_ITEMS.map((item, i) => (
                <SettingsListItem
                  key={item.title}
                  item={item}
                  isLast={i === ADMIN_ITEMS.length - 1}
                  palette={palette}
                  isDark={isDark}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
