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
  Sun,
  Moon,
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
  action?: "toggle-theme";
}

const ACCOUNT_ITEMS: SettingsItem[] = [
  { icon: UserCircle,       title: "Profile",             subtitle: "Name, email, crew ID" },
  { icon: Palette,           title: "Appearance",          subtitle: "Theme, dark mode, accent color", action: "toggle-theme" },
  { icon: Bell,              title: "Notifications",       subtitle: "Push, email, alert preferences" },
  { icon: Lock,              title: "Password & Security", subtitle: "Change password, biometrics" },
  { icon: SlidersHorizontal, title: "Preferences",         subtitle: "Language, timezone, units" },
];

const ADMIN_ITEMS: SettingsItem[] = [
  { icon: Database,       title: "Master Data",     subtitle: "Airports, aircraft, airlines",   href: "/admin" },
  { icon: ShieldCheck,    title: "Users & Roles",   subtitle: "Manage user accounts and RBAC" },
  { icon: ArrowLeftRight, title: "Interface",        subtitle: "AMOS, SSIM, MVT, message hub" },
  { icon: Building2,      title: "Operator Config",  subtitle: "Airline settings, base airports" },
  { icon: FileText,       title: "Reports",          subtitle: "Operational reports & exports" },
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
  isDark,
  onToggleTheme,
}: {
  item: SettingsItem;
  isLast: boolean;
  palette: PaletteType;
  isDark: boolean;
  onToggleTheme?: () => void;
}) {
  const Icon = item.icon;
  const isThemeToggle = item.action === "toggle-theme";

  const handleClick = () => {
    if (isThemeToggle && onToggleTheme) {
      onToggleTheme();
    }
  };

  const content = (
    <div>
      <div
        className="flex items-center px-3 py-2.5 cursor-pointer transition-colors min-h-[44px]"
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = palette.backgroundHover)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        onClick={isThemeToggle ? handleClick : undefined}
      >
        <div
          className="w-9 h-9 rounded-[10px] flex items-center justify-center mr-3 shrink-0"
          style={{ backgroundColor: accentTint(ACCENT, 0.08) }}
        >
          <Icon className="h-5 w-5" style={{ color: ACCENT }} strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0 mr-2">
          <div className="text-[13px] font-medium" style={{ color: palette.text }}>
            {item.title}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: palette.textSecondary }}>
            {item.subtitle}
          </div>
        </div>
        {isThemeToggle ? (
          <div className="flex items-center gap-1.5 mr-1">
            {isDark ? (
              <Moon className="h-3.5 w-3.5" style={{ color: ACCENT }} />
            ) : (
              <Sun className="h-3.5 w-3.5" style={{ color: ACCENT }} />
            )}
            <span className="text-[11px] font-medium" style={{ color: ACCENT }}>
              {isDark ? "Dark" : "Light"}
            </span>
          </div>
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" style={{ color: palette.textTertiary }} />
        )}
      </div>
      {!isLast && (
        <div className="ml-[52px] mr-3" style={{ height: 0.5, backgroundColor: palette.border }} />
      )}
    </div>
  );

  if (item.href) {
    return <Link href={item.href}>{content}</Link>;
  }

  return content;
}

export default function SettingsPage() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const palette: PaletteType = isDark ? colors.dark : colors.light;

  return (
    <div className="min-h-full p-6">
      <h1 className="text-xl font-semibold mb-0.5" style={{ color: palette.text }}>
        Settings
      </h1>
      <p className="text-sm mb-2" style={{ color: palette.textSecondary }}>
        {isAdmin ? "Administrator" : "User"} &mdash; Nguyen Van A
      </p>

      <SectionHeader title="Account" palette={palette} />
      <div
        className="rounded-xl border shadow-sm overflow-hidden"
        style={{ backgroundColor: palette.card, borderColor: palette.cardBorder }}
      >
        {ACCOUNT_ITEMS.map((item, i) => (
          <SettingsListItem
            key={item.title}
            item={item}
            isLast={i === ACCOUNT_ITEMS.length - 1}
            palette={palette}
            isDark={isDark}
            onToggleTheme={toggle}
          />
        ))}
      </div>

      {isAdmin && (
        <>
          <SectionHeader title="Administration" palette={palette} />
          <div
            className="rounded-xl border shadow-sm overflow-hidden"
            style={{ backgroundColor: palette.card, borderColor: palette.cardBorder }}
          >
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
        </>
      )}
    </div>
  );
}
