"use client";

import { Palette, Moon, Sun, Sparkles, Type } from "lucide-react";
import { accentTint, type Palette as PaletteType } from "@skyhub/ui/theme";
import { useDisplay } from "@/components/display-provider";
import { TEXT_SCALE_OPTIONS, type TextScale } from "@/lib/fonts";

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
}

export function QuickSettings({
  palette, isDark, accent, onToggleDark, onAccentChange,
  dynamicBg, onToggleDynamic, themePreset, onPresetChange,
}: QuickSettingsProps) {
  return (
    <div className="mt-6">
      <AppearanceDisplayTile
        palette={palette} isDark={isDark} accent={accent}
        onAccentChange={onAccentChange} dynamicBg={dynamicBg}
        onToggleDynamic={onToggleDynamic}
        themePreset={themePreset} onPresetChange={onPresetChange}
        onToggleDark={onToggleDark}
      />
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
      className="relative overflow-hidden rounded-2xl transition-all duration-150"
      style={{
        padding: "clamp(18px, 1.5vw, 28px)",
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
    <div className="uppercase tracking-wider"
      style={{ fontSize: 11, fontWeight: 600, color: palette.textTertiary, marginBottom: 8 }}>
      {label}
    </div>
  );
}

// ── Appearance + Display merged ──

function AppearanceDisplayTile({
  palette, isDark, accent, onAccentChange, dynamicBg, onToggleDynamic,
  themePreset, onPresetChange, onToggleDark,
}: {
  palette: PaletteType; isDark: boolean; accent: string;
  onAccentChange: (hex: string) => void; dynamicBg: boolean; onToggleDynamic: () => void;
  themePreset: string; onPresetChange: (preset: string) => void;
  onToggleDark: () => void;
}) {
  const { fonts: F, textScale, setTextScale, contrast, setContrast, brightness, setBrightness } = useDisplay();
  const scaleIndex = TEXT_SCALE_OPTIONS.findIndex((o) => o.value === textScale);

  return (
    <Tile palette={palette} isDark={isDark} blobColor="#7c3aed">
      <div className="flex items-center" style={{ marginBottom: "clamp(12px, 1vw, 18px)" }}>
        <div className="w-[3px] h-5 rounded-full mr-2.5" style={{ backgroundColor: "#7c3aed" }} />
        <h2 style={{ fontSize: "clamp(15px, 1.2vw, 20px)", fontWeight: 700, color: palette.text }}>Appearance & Display</h2>
      </div>

      <div className="flex gap-6">
        {/* ── Left column: Theme controls ── */}
        <div className="flex-1 min-w-0">
          {/* Color Mode + Accent Color — same row */}
          <div className="flex items-center justify-between mb-1">
            <SectionLabel label="Accent Color" palette={palette} />
            <SectionLabel label="Color Mode" palette={palette} />
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {ACCENT_PRESETS.map((p) => (
                <button
                  key={p.hex}
                  onClick={(e) => { e.stopPropagation(); onAccentChange(p.hex); }}
                  className="cursor-pointer transition-transform hover:scale-110 shrink-0"
                  style={{
                    width: 24, height: 24, borderRadius: 12,
                    backgroundColor: p.hex,
                    border: p.hex === accent ? "2.5px solid white" : "2.5px solid transparent",
                    boxShadow: p.hex === accent ? `0 0 0 1.5px ${p.hex}` : "none",
                  }}
                  title={p.name}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {isDark ? <Moon size={15} style={{ color: accent }} strokeWidth={1.8} /> : <Sun size={15} style={{ color: accent }} strokeWidth={1.8} />}
              <Toggle on={isDark} onToggle={onToggleDark} accent={accent} isDark={isDark} />
            </div>
          </div>

          {/* Dynamic Theme */}
          <SectionLabel label="Dynamic Theme" palette={palette} />
          <div className="flex items-center gap-3">
            <span style={{ fontSize: F.sm, fontWeight: 500, color: dynamicBg ? palette.text : palette.textSecondary }}>
              {dynamicBg ? "On" : "Off"}
            </span>
            {dynamicBg && (
              <div className="flex gap-2 flex-1">
                {THEME_PRESETS.map((preset) => {
                  const active = preset.key === themePreset;
                  const gradColors = isDark ? (THEME_PRESETS_DARK[preset.key] ?? preset.colors) : preset.colors;
                  return (
                    <button
                      key={preset.key}
                      onClick={(e) => { e.stopPropagation(); onPresetChange(preset.key); }}
                      className="cursor-pointer flex flex-col items-center gap-1" style={{ flex: 1 }} title={preset.label}
                    >
                      <div
                        className="w-full rounded-lg transition-all"
                        style={{
                          height: 40,
                          background: `linear-gradient(135deg, ${gradColors[0]}, ${gradColors[1]})`,
                          border: active ? `2.5px solid ${accent}` : `2px solid transparent`,
                          boxShadow: active ? `0 0 0 1.5px ${accentTint(accent, 0.3)}` : "none",
                          opacity: active ? 1 : 0.4,
                        }}
                      />
                      <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? accent : palette.textTertiary }}>
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {!dynamicBg && <div className="flex-1" />}
            <Toggle on={dynamicBg} onToggle={onToggleDynamic} accent={accent} isDark={isDark} />
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, backgroundColor: palette.border, alignSelf: "stretch" }} />

        {/* ── Right column: Display controls ── */}
        <div className="flex-1 min-w-0">
          {/* Text Size */}
          <SectionLabel label="Text Size" palette={palette} />
          <div className="flex items-center gap-3">
            <Type size={13} style={{ color: palette.textTertiary }} strokeWidth={2} />
            <input
              type="range" min={0} max={TEXT_SCALE_OPTIONS.length - 1} step={1}
              value={scaleIndex}
              onChange={(e) => { e.stopPropagation(); setTextScale(TEXT_SCALE_OPTIONS[Number(e.target.value)].value); }}
              className="flex-1 cursor-pointer"
              onClick={(e) => e.stopPropagation()}
              style={{ accentColor: accent, height: 6 }}
            />
            <Type size={22} style={{ color: palette.textTertiary }} strokeWidth={2} />
          </div>

          {/* Contrast */}
          <div style={{ marginTop: 12 }}>
            <SectionLabel label="Contrast" palette={palette} />
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 11, color: palette.textTertiary }}>Low</span>
              <input
                type="range" min={0} max={2} step={1} value={contrast}
                onChange={(e) => { e.stopPropagation(); setContrast(Number(e.target.value)); }}
                className="flex-1 cursor-pointer display-slider"
                onClick={(e) => e.stopPropagation()}
                style={{ accentColor: accent, height: 6 }}
              />
              <span style={{ fontSize: 11, color: palette.textTertiary }}>High</span>
            </div>
          </div>

          {/* Brightness */}
          <div style={{ marginTop: 12 }}>
            <SectionLabel label="Brightness" palette={palette} />
            <div className="flex items-center gap-3">
              <Sun size={13} style={{ color: palette.textTertiary }} strokeWidth={2} />
              <input
                type="range" min={0} max={100} step={1} value={brightness}
                onChange={(e) => { e.stopPropagation(); setBrightness(Number(e.target.value)); }}
                className="flex-1 cursor-pointer display-slider"
                onClick={(e) => e.stopPropagation()}
                style={{ accentColor: accent, height: 6 }}
              />
              <Sun size={18} style={{ color: palette.textTertiary }} strokeWidth={2} />
            </div>
          </div>
        </div>
      </div>
    </Tile>
  );
}

// ── Notifications ──

