"use client";

import { Palette, Bell, Moon, Sun, Sparkles } from "lucide-react";
import { accentTint, type Palette as PaletteType } from "@skyhub/ui/theme";
import { WEB_FONTS as F } from "@/lib/fonts";

const ACCENT_PRESETS = [
  { name: "Green", hex: "#15803d" },
  { name: "Blue", hex: "#1e40af" },
  { name: "Violet", hex: "#7c3aed" },
  { name: "Teal", hex: "#0f766e" },
  { name: "Amber", hex: "#b45309" },
];

const THEME_PRESETS: { key: string; label: string; colors: [string, string] }[] = [
  { key: "aurora", label: "Aurora", colors: ["#c7d2fe", "#ddd6fe"] },
  { key: "ember", label: "Ember", colors: ["#fed7aa", "#fecaca"] },
  { key: "lagoon", label: "Lagoon", colors: ["#a5f3fc", "#bae6fd"] },
  { key: "prism", label: "Prism", colors: ["#fbcfe8", "#c4b5fd"] },
];

const THEME_PRESETS_DARK: Record<string, [string, string]> = {
  aurora: ["#312e81", "#1e1b4b"],
  ember: ["#451a03", "#3b0764"],
  lagoon: ["#064e3b", "#0c4a6e"],
  prism: ["#4a044e", "#1e1b4b"],
};

interface QuickSettingsProps {
  palette: PaletteType;
  isDark: boolean;
  accent: string;
  onToggleDark: () => void;
  onAccentChange: (hex: string) => void;
  dynamicBg: boolean;
  onToggleDynamic: () => void;
  themePreset: string;
  onPresetChange: (preset: string) => void;
  unreadCount: number;
}

export function QuickSettings({
  palette, isDark, accent, onToggleDark, onAccentChange,
  dynamicBg, onToggleDynamic, themePreset, onPresetChange, unreadCount,
}: QuickSettingsProps) {
  return (
    <div className="grid grid-cols-3 gap-4 mt-6">
      <AppearanceTile
        palette={palette} isDark={isDark} accent={accent}
        onAccentChange={onAccentChange} dynamicBg={dynamicBg}
        onToggleDynamic={onToggleDynamic}
        themePreset={themePreset} onPresetChange={onPresetChange}
      />
      <NotificationsTile palette={palette} isDark={isDark} unreadCount={unreadCount} />
      <DarkModeTile palette={palette} isDark={isDark} accent={accent} onToggle={onToggleDark} />
    </div>
  );
}

// ── Shared ──

function Tile({
  children, palette, isDark, blobColor,
}: {
  children: React.ReactNode; palette: PaletteType; isDark: boolean; blobColor: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 pb-4 transition-all duration-150"
      style={{
        backgroundColor: palette.card,
        border: `1px solid ${palette.cardBorder}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)";
      }}
    >
      <div
        className="absolute pointer-events-none"
        style={{
          top: -20, right: -20, width: 80, height: 80,
          background: `radial-gradient(circle, ${accentTint(blobColor, 0.08)}, transparent 70%)`,
          borderRadius: "50%",
        }}
      />
      {children}
    </div>
  );
}

function Toggle({
  on, onToggle, accent, isDark,
}: {
  on: boolean; onToggle: () => void; accent: string; isDark: boolean;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="relative rounded-full cursor-pointer transition-colors shrink-0"
      style={{
        width: 44, height: 24,
        backgroundColor: on ? accent : isDark ? "#444" : "#ddd",
      }}
    >
      <div
        className="absolute top-[2px] rounded-full bg-white transition-all"
        style={{
          width: 20, height: 20,
          left: on ? 22 : 2,
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        }}
      />
    </button>
  );
}

function SectionLabel({ label, palette }: { label: string; palette: PaletteType }) {
  return (
    <div
      className="uppercase tracking-wider"
      style={{ fontSize: 11, fontWeight: 600, color: palette.textTertiary, marginBottom: 8 }}
    >
      {label}
    </div>
  );
}

// ── Appearance ──

function AppearanceTile({
  palette, isDark, accent, onAccentChange, dynamicBg, onToggleDynamic,
  themePreset, onPresetChange,
}: {
  palette: PaletteType; isDark: boolean; accent: string;
  onAccentChange: (hex: string) => void; dynamicBg: boolean; onToggleDynamic: () => void;
  themePreset: string; onPresetChange: (preset: string) => void;
}) {
  const currentPresetLabel = THEME_PRESETS.find((p) => p.key === themePreset)?.label ?? "Aurora";

  return (
    <Tile palette={palette} isDark={isDark} blobColor="#7c3aed">
      <div style={{ fontSize: F.lg, fontWeight: 600, color: palette.text }}>Appearance</div>
      <div style={{ fontSize: F.sm, color: palette.textSecondary, marginTop: 2, marginBottom: 16 }}>
        {dynamicBg ? `${currentPresetLabel} theme` : "Static background"}
      </div>

      {/* Dynamic Theme */}
      <SectionLabel label="Dynamic Theme" palette={palette} />
      <div className="flex items-center gap-2.5">
        <span style={{ fontSize: F.sm, fontWeight: 500, color: dynamicBg ? palette.text : palette.textSecondary }}>
          {dynamicBg ? "On" : "Off"}
        </span>
        {/* Preset thumbnails — only when on */}
        {dynamicBg && (
          <div className="flex gap-1 flex-1">
            {THEME_PRESETS.map((preset) => {
              const active = preset.key === themePreset;
              const gradColors = isDark ? (THEME_PRESETS_DARK[preset.key] ?? preset.colors) : preset.colors;
              return (
                <button
                  key={preset.key}
                  onClick={(e) => { e.stopPropagation(); onPresetChange(preset.key); }}
                  className="cursor-pointer"
                  style={{ flex: 1 }}
                  title={preset.label}
                >
                  <div
                    className="w-full rounded transition-all"
                    style={{
                      height: 16,
                      background: `linear-gradient(135deg, ${gradColors[0]}, ${gradColors[1]})`,
                      border: active ? `2px solid ${accent}` : `1.5px solid transparent`,
                      boxShadow: active ? `0 0 0 1px ${accentTint(accent, 0.3)}` : "none",
                      opacity: active ? 1 : 0.45,
                    }}
                  />
                </button>
              );
            })}
          </div>
        )}
        {!dynamicBg && <div className="flex-1" />}
        <Toggle on={dynamicBg} onToggle={onToggleDynamic} accent={accent} isDark={isDark} />
      </div>

      {/* Accent Color */}
      <div style={{ marginTop: dynamicBg ? 14 : 12 }}>
        <SectionLabel label="Accent Color" palette={palette} />
        <div className="flex items-center gap-2">
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.hex}
              onClick={(e) => { e.stopPropagation(); onAccentChange(p.hex); }}
              className="cursor-pointer transition-transform hover:scale-110 shrink-0"
              style={{
                width: 22, height: 22, borderRadius: 11,
                backgroundColor: p.hex,
                border: p.hex === accent ? "2.5px solid white" : "2.5px solid transparent",
                boxShadow: p.hex === accent ? `0 0 0 1.5px ${p.hex}` : "none",
              }}
              title={p.name}
            />
          ))}
        </div>
      </div>
    </Tile>
  );
}

// ── Notifications ──

function NotificationsTile({
  palette, isDark, unreadCount,
}: {
  palette: PaletteType; isDark: boolean; unreadCount: number;
}) {
  return (
    <Tile palette={palette} isDark={isDark} blobColor="#b45309">
      {unreadCount > 0 && (
        <div
          className="absolute flex items-center justify-center"
          style={{
            top: 16, right: 16,
            fontSize: F.min, fontWeight: 700, color: "#fff",
            backgroundColor: "#dc2626",
            padding: "2px 8px",
            borderRadius: 8,
          }}
        >
          {unreadCount}
        </div>
      )}
      <div style={{ fontSize: F.lg, fontWeight: 600, color: palette.text }}>Notifications</div>
      <div style={{ fontSize: F.sm, color: palette.textSecondary, marginTop: 2 }}>Push & email alerts</div>
      <div style={{ fontSize: F.sm, color: palette.textTertiary, marginTop: 16 }}>
        {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
      </div>
    </Tile>
  );
}

// ── Dark Mode ──

function DarkModeTile({
  palette, isDark, accent, onToggle,
}: {
  palette: PaletteType; isDark: boolean; accent: string; onToggle: () => void;
}) {
  return (
    <Tile palette={palette} isDark={isDark} blobColor="#555">
      <div style={{ fontSize: F.lg, fontWeight: 600, color: palette.text }}>
        {isDark ? "Dark Mode" : "Light Mode"}
      </div>
      <div style={{ fontSize: F.sm, color: palette.textSecondary, marginTop: 2 }}>
        Currently {isDark ? "on" : "off"}
      </div>
      <div className="flex items-center justify-between" style={{ marginTop: 16 }}>
        <div className="flex items-center gap-2">
          {isDark
            ? <Moon size={16} style={{ color: accent }} strokeWidth={1.8} />
            : <Sun size={16} style={{ color: palette.textSecondary }} strokeWidth={1.8} />
          }
          <span style={{ fontSize: F.sm, fontWeight: 500, color: isDark ? accent : palette.textSecondary }}>
            {isDark ? "Dark" : "Light"}
          </span>
        </div>
        <Toggle on={isDark} onToggle={onToggle} accent={accent} isDark={isDark} />
      </div>
    </Tile>
  );
}
