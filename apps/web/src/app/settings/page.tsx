"use client";

import { useState, useEffect, useCallback } from "react";
import { colors, type Palette as PaletteType } from "@skyhub/ui/theme";
import { useTheme } from "@/components/theme-provider";
import { useUser } from "@/components/user-provider";
import { getBgPreset, setBgPreset, toggleDynamicBg } from "@/components/AnimatedBodyBg";
import { QuickSettings } from "@/components/settings/QuickSettings";
import { AccountSection } from "@/components/settings/AccountSection";
import { AdminSection } from "@/components/settings/AdminSection";

const ACCENT_DEFAULT = "#1e40af";

export default function SettingsPage() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const palette: PaletteType = isDark ? colors.dark : colors.light;
  const { user, loading } = useUser();

  const isAdmin = user?.role === "administrator" || user?.role === "manager";
  const profileComplete = user ? !!(user.profile.firstName && user.profile.email && user.profile.phone && user.profile.department) : false;
  const twoFactorEnabled = user?.security?.twoFactorEnabled ?? false;

  const [accent, setAccent] = useState(ACCENT_DEFAULT);
  const [dynamicBg, setDynamicBg] = useState(true);
  const [themePreset, setThemePreset] = useState<string>("aurora");

  useEffect(() => {
    const preset = getBgPreset();
    setThemePreset(preset === "none" ? "aurora" : preset);
    setDynamicBg(preset !== "none");
  }, []);

  // Sync accent from user display settings
  useEffect(() => {
    if (user?.display?.accentColor) {
      setAccent(user.display.accentColor);
    }
  }, [user]);

  const handlePresetChange = useCallback((preset: string) => {
    setThemePreset(preset);
    setBgPreset(preset as any);
    setDynamicBg(true);
  }, []);

  const handleToggleDynamic = useCallback(() => {
    toggleDynamicBg();
    setDynamicBg((prev) => !prev);
  }, []);

  if (loading) return null;

  return (
    <div className="min-h-full" style={{ padding: "clamp(16px, 2vw, 32px) clamp(24px, 4vw, 60px)" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isAdmin ? "1fr 1fr" : "1fr",
          gap: "clamp(16px, 1.5vw, 28px)",
          alignItems: "stretch",
        }}
      >
        <AccountSection
          palette={palette}
          isDark={isDark}
          accent={accent}
          profileComplete={profileComplete}
          twoFactorEnabled={twoFactorEnabled}
        />

        {isAdmin && (
          <AdminSection
            palette={palette}
            isDark={isDark}
            accent={accent}
          />
        )}
      </div>

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
      />
    </div>
  );
}
