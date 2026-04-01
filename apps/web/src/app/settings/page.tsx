"use client";

import { useState, useEffect, useCallback } from "react";
import { colors, type Palette as PaletteType } from "@skyhub/ui/theme";
import { useTheme } from "@/components/theme-provider";
import { getBgPreset, setBgPreset, isDynamicBgEnabled, toggleDynamicBg } from "@/components/AnimatedBodyBg";
import { ProfileHero } from "@/components/settings/ProfileHero";
import { QuickSettings } from "@/components/settings/QuickSettings";
import { AccountSection } from "@/components/settings/AccountSection";
import { AdminSection } from "@/components/settings/AdminSection";

const ACCENT_DEFAULT = "#1e40af";

const mockUser = {
  name: "Nguyen Van A",
  initials: "NV",
  email: "nguyen.a@skyhub.aero",
  isActive: true,
  isAdmin: true,
  department: "OCC",
  office: "SGN",
  profileComplete: true,
  twoFactorEnabled: false,
  unreadNotifications: 2,
};

export default function SettingsPage() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const palette: PaletteType = isDark ? colors.dark : colors.light;

  const [accent, setAccent] = useState(ACCENT_DEFAULT);
  const [dynamicBg, setDynamicBg] = useState(true);
  const [themePreset, setThemePreset] = useState<string>("aurora");

  // Sync with persisted background state on mount
  useEffect(() => {
    const preset = getBgPreset();
    setThemePreset(preset === "none" ? "aurora" : preset);
    setDynamicBg(preset !== "none");
  }, []);

  const handlePresetChange = useCallback((preset: string) => {
    setThemePreset(preset);
    setBgPreset(preset as any);
    setDynamicBg(true);
  }, []);

  const handleToggleDynamic = useCallback(() => {
    toggleDynamicBg();
    setDynamicBg((prev) => !prev);
  }, []);

  return (
    <div className="min-h-full" style={{ padding: "24px 40px", paddingTop: 8 }}>
      <ProfileHero
        palette={palette}
        isDark={isDark}
        accent={accent}
        user={mockUser}
      />

      <QuickSettings
        palette={palette}
        isDark={isDark}
        accent={accent}
        onToggleDark={toggle}
        onAccentChange={setAccent}
        dynamicBg={dynamicBg}
        onToggleDynamic={handleToggleDynamic}
        themePreset={themePreset}
        onPresetChange={handlePresetChange}
        unreadCount={mockUser.unreadNotifications}
      />

      <div
        className="mt-8"
        style={{
          display: "grid",
          gridTemplateColumns: mockUser.isAdmin ? "1fr 1fr" : "1fr",
          gap: 20,
          alignItems: "stretch",
        }}
      >
        <AccountSection
          palette={palette}
          isDark={isDark}
          accent={accent}
          profileComplete={mockUser.profileComplete}
          twoFactorEnabled={mockUser.twoFactorEnabled}
        />

        {mockUser.isAdmin && (
          <AdminSection
            palette={palette}
            isDark={isDark}
            accent={accent}
          />
        )}
      </div>
    </div>
  );
}
