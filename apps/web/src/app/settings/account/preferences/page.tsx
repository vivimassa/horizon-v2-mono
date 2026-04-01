"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  SlidersHorizontal,
  Languages,
  Clock,
  Calendar,
  Hash,
  Ruler,
  Save,
  Check,
} from "lucide-react";
import { colors, accentTint, type Palette as PaletteType } from "@skyhub/ui/theme";
import { useTheme } from "@/components/theme-provider";
import { WEB_FONTS as F, WEB_LAYOUT } from "@/lib/fonts";

const ACCENT = "#1e40af";

const GLASS = {
  light: {
    card: "rgba(255,255,255,0.55)",
    cardBorder: "rgba(0,0,0,0.06)",
    blur: "blur(16px) saturate(160%)",
    shadow: "0 2px 12px rgba(0,0,0,0.04)",
  },
  dark: {
    card: "rgba(255,255,255,0.04)",
    cardBorder: "rgba(255,255,255,0.07)",
    blur: "blur(16px) saturate(140%)",
    shadow: "0 2px 12px rgba(0,0,0,0.2)",
  },
};

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "vi", label: "Tiếng Việt" },
  { value: "zh", label: "中文 (Chinese)" },
  { value: "ja", label: "日本語 (Japanese)" },
  { value: "ko", label: "한국어 (Korean)" },
  { value: "th", label: "ไทย (Thai)" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
];

const TIMEZONES = [
  { value: "Asia/Ho_Chi_Minh", label: "Ho Chi Minh City (UTC+7)" },
  { value: "Asia/Bangkok", label: "Bangkok (UTC+7)" },
  { value: "Asia/Singapore", label: "Singapore (UTC+8)" },
  { value: "Asia/Tokyo", label: "Tokyo (UTC+9)" },
  { value: "Asia/Seoul", label: "Seoul (UTC+9)" },
  { value: "Asia/Shanghai", label: "Shanghai (UTC+8)" },
  { value: "Europe/London", label: "London (UTC+0/+1)" },
  { value: "America/New_York", label: "New York (UTC-5/-4)" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
];

const DATE_FORMATS = [
  { value: "dd/MM/yyyy", label: "31/12/2026", example: "DD/MM/YYYY" },
  { value: "MM/dd/yyyy", label: "12/31/2026", example: "MM/DD/YYYY" },
  { value: "yyyy-MM-dd", label: "2026-12-31", example: "YYYY-MM-DD (ISO)" },
  { value: "dd MMM yyyy", label: "31 Dec 2026", example: "DD Mon YYYY" },
  { value: "MMM dd, yyyy", label: "Dec 31, 2026", example: "Mon DD, YYYY" },
];

const TIME_FORMATS = [
  { value: "24h", label: "24-hour", example: "14:30" },
  { value: "12h", label: "12-hour", example: "2:30 PM" },
];

const UNIT_SYSTEMS = [
  { value: "metric", label: "Metric", example: "kg, km, °C" },
  { value: "imperial", label: "Imperial", example: "lb, mi, °F" },
];

const NUMBER_FORMATS = [
  { value: "comma", label: "1,000.00", example: "Comma separator" },
  { value: "dot", label: "1.000,00", example: "Dot separator" },
  { value: "space", label: "1 000.00", example: "Space separator" },
];

interface Prefs {
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  units: string;
  numberFormat: string;
}

const INITIAL: Prefs = {
  language: "en",
  timezone: "Asia/Ho_Chi_Minh",
  dateFormat: "dd MMM yyyy",
  timeFormat: "24h",
  units: "metric",
  numberFormat: "comma",
};

export default function PreferencesPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const palette: PaletteType = isDark ? colors.dark : colors.light;
  const glass = isDark ? GLASS.dark : GLASS.light;

  const [prefs, setPrefs] = useState<Prefs>(INITIAL);
  const [saved, setSaved] = useState(false);

  const update = (key: keyof Prefs, value: string) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const hasChanges = JSON.stringify(prefs) !== JSON.stringify(INITIAL);

  // Current selections for preview
  const currentLang = LANGUAGES.find((l) => l.value === prefs.language)?.label ?? prefs.language;
  const currentTz = TIMEZONES.find((t) => t.value === prefs.timezone)?.label ?? prefs.timezone;
  const currentDate = DATE_FORMATS.find((d) => d.value === prefs.dateFormat)?.label ?? prefs.dateFormat;
  const currentTime = TIME_FORMATS.find((t) => t.value === prefs.timeFormat)?.example ?? prefs.timeFormat;
  const currentUnits = UNIT_SYSTEMS.find((u) => u.value === prefs.units)?.example ?? prefs.units;
  const currentNumber = NUMBER_FORMATS.find((n) => n.value === prefs.numberFormat)?.label ?? prefs.numberFormat;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 px-5 py-3 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl cursor-pointer group transition-all duration-150"
          style={{
            color: palette.text, fontSize: F.min, fontWeight: 600,
            background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.6)",
            backdropFilter: "blur(12px)",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"}`,
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.8)"}
          onMouseLeave={(e) => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.6)"}
        >
          <ArrowLeft size={15} strokeWidth={2} className="transition-transform group-hover:-translate-x-0.5" />
          Settings
        </button>

        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg"
              style={{ fontSize: F.min, fontWeight: 600, color: isDark ? "#4ade80" : "#16a34a", backgroundColor: isDark ? "rgba(22,163,74,0.15)" : "#dcfce7" }}>
              <Check size={13} strokeWidth={2.5} /> Saved
            </span>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-white cursor-pointer transition-opacity hover:opacity-90"
            style={{
              fontSize: F.min, backgroundColor: ACCENT,
              opacity: hasChanges ? 1 : 0.5,
              pointerEvents: hasChanges ? "auto" : "none",
            }}
          >
            <Save size={14} strokeWidth={2} />
            Save Preferences
          </button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden gap-4 px-4 pb-4">
        {/* ── Left Panel: Live Preview ── */}
        <aside
          className="shrink-0 flex flex-col rounded-2xl border overflow-y-auto"
          style={{
            width: WEB_LAYOUT.sidebarWidth,
            background: glass.card, borderColor: glass.cardBorder,
            backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur,
            boxShadow: glass.shadow,
          }}
        >
          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: accentTint("#0f766e", isDark ? 0.15 : 0.08) }}>
              <SlidersHorizontal size={20} style={{ color: "#0f766e" }} strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="font-bold" style={{ fontSize: F.xl, color: palette.text }}>Preferences</h1>
              <p style={{ fontSize: F.min, color: palette.textSecondary }}>Regional & display settings</p>
            </div>
          </div>

          <div className="mx-5" style={{ height: 0.5, backgroundColor: palette.border }} />

          {/* Live preview */}
          <div className="px-5 py-4 flex-1">
            <p className="uppercase tracking-wider mb-4"
              style={{ fontSize: 11, fontWeight: 600, color: palette.textTertiary }}>
              Current Settings
            </p>

            <PreviewRow icon={Languages} label="Language" value={currentLang} palette={palette} />
            <PreviewRow icon={Clock} label="Timezone" value={currentTz} palette={palette} />
            <PreviewRow icon={Calendar} label="Date Format" value={currentDate} palette={palette} />
            <PreviewRow icon={Clock} label="Time Format" value={currentTime} palette={palette} />
            <PreviewRow icon={Ruler} label="Units" value={currentUnits} palette={palette} />
            <PreviewRow icon={Hash} label="Numbers" value={currentNumber} palette={palette} />
          </div>

          <div className="mx-5" style={{ height: 0.5, backgroundColor: palette.border }} />

          {/* Example output */}
          <div className="px-5 py-4">
            <p className="uppercase tracking-wider mb-3"
              style={{ fontSize: 11, fontWeight: 600, color: palette.textTertiary }}>
              Example Output
            </p>
            <div className="rounded-xl p-3.5"
              style={{
                backgroundColor: accentTint(ACCENT, isDark ? 0.08 : 0.04),
                border: `1px solid ${accentTint(ACCENT, 0.12)}`,
              }}>
              <p style={{ fontSize: F.sm, color: palette.text, fontWeight: 500 }}>
                {currentDate} {currentTime}
              </p>
              <p style={{ fontSize: F.min, color: palette.textSecondary, marginTop: 4 }}>
                Distance: {prefs.units === "metric" ? "1,250 km" : "776 mi"} &middot;
                Weight: {prefs.units === "metric" ? "78,500 kg" : "173,063 lb"}
              </p>
              <p style={{ fontSize: F.min, color: palette.textSecondary, marginTop: 2 }}>
                Fuel: {currentNumber === "comma" ? "12,450.00" : currentNumber === "dot" ? "12.450,00" : "12 450.00"} {prefs.units === "metric" ? "L" : "gal"}
              </p>
            </div>
          </div>
        </aside>

        {/* ── Right Panel: Form ── */}
        <section className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4">
            {/* Language & Region */}
            <GlassCard title="Language & Region" icon={Languages} palette={palette} isDark={isDark} glass={glass}>
              <div className="grid grid-cols-2 gap-x-8">
                <SelectField
                  label="Display Language"
                  value={prefs.language}
                  options={LANGUAGES}
                  onChange={(v) => update("language", v)}
                  palette={palette} isDark={isDark}
                />
                <SelectField
                  label="Timezone"
                  value={prefs.timezone}
                  options={TIMEZONES}
                  onChange={(v) => update("timezone", v)}
                  palette={palette} isDark={isDark}
                />
              </div>
            </GlassCard>

            {/* Date & Time */}
            <GlassCard title="Date & Time" icon={Calendar} palette={palette} isDark={isDark} glass={glass}>
              <div className="grid grid-cols-2 gap-x-8">
                <SelectField
                  label="Date Format"
                  value={prefs.dateFormat}
                  options={DATE_FORMATS.map((d) => ({ value: d.value, label: `${d.label} (${d.example})` }))}
                  onChange={(v) => update("dateFormat", v)}
                  palette={palette} isDark={isDark}
                />
                <ToggleGroup
                  label="Time Format"
                  value={prefs.timeFormat}
                  options={TIME_FORMATS}
                  onChange={(v) => update("timeFormat", v)}
                  palette={palette} isDark={isDark} accent={ACCENT}
                />
              </div>
            </GlassCard>

            {/* Units & Numbers */}
            <GlassCard title="Units & Numbers" icon={Ruler} palette={palette} isDark={isDark} glass={glass}>
              <div className="grid grid-cols-2 gap-x-8">
                <ToggleGroup
                  label="Unit System"
                  value={prefs.units}
                  options={UNIT_SYSTEMS}
                  onChange={(v) => update("units", v)}
                  palette={palette} isDark={isDark} accent={ACCENT}
                />
                <ToggleGroup
                  label="Number Format"
                  value={prefs.numberFormat}
                  options={NUMBER_FORMATS}
                  onChange={(v) => update("numberFormat", v)}
                  palette={palette} isDark={isDark} accent={ACCENT}
                />
              </div>
            </GlassCard>
          </div>

          <div className="h-8" />
        </section>
      </div>
    </div>
  );
}

// ── Sub-components ──

function PreviewRow({
  icon: Icon, label, value, palette,
}: {
  icon: typeof Clock; label: string; value: string; palette: PaletteType;
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <Icon size={15} style={{ color: palette.textTertiary, marginTop: 2 }} strokeWidth={1.8} />
      <div>
        <p style={{ fontSize: F.min, color: palette.textTertiary }}>{label}</p>
        <p className="font-medium" style={{ fontSize: F.sm, color: palette.text }}>{value}</p>
      </div>
    </div>
  );
}

function GlassCard({
  title, icon: Icon, palette, isDark, glass, children,
}: {
  title: string; icon: typeof Clock; palette: PaletteType; isDark: boolean;
  glass: typeof GLASS.light; children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        background: glass.card, borderColor: glass.cardBorder,
        backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur,
        boxShadow: glass.shadow,
      }}
    >
      <div className="flex items-center gap-2.5 px-5 py-3.5"
        style={{ borderBottom: `1px solid ${palette.border}` }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: accentTint(ACCENT, isDark ? 0.15 : 0.08) }}>
          <Icon size={16} style={{ color: ACCENT }} strokeWidth={1.8} />
        </div>
        <h3 className="font-bold" style={{ fontSize: F.lg, color: palette.text, letterSpacing: -0.2 }}>
          {title}
        </h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function SelectField({
  label, value, options, onChange, palette, isDark,
}: {
  label: string; value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  palette: PaletteType; isDark: boolean;
}) {
  return (
    <div className="py-3" style={{ borderBottom: `0.5px solid ${palette.border}` }}>
      <label className="block mb-2" style={{ fontSize: F.min, color: palette.textTertiary }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl font-medium cursor-pointer"
        style={{
          fontSize: F.sm,
          color: palette.text,
          backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}`,
          padding: "10px 14px",
          outline: "none",
          appearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${isDark ? '%23888' : '%23999'}' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 14px center",
          paddingRight: 36,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = ACCENT;
          e.currentTarget.style.boxShadow = `0 0 0 3px ${accentTint(ACCENT, isDark ? 0.2 : 0.12)}`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function ToggleGroup({
  label, value, options, onChange, palette, isDark, accent,
}: {
  label: string; value: string;
  options: { value: string; label: string; example: string }[];
  onChange: (v: string) => void;
  palette: PaletteType; isDark: boolean; accent: string;
}) {
  return (
    <div className="py-3" style={{ borderBottom: `0.5px solid ${palette.border}` }}>
      <label className="block mb-2" style={{ fontSize: F.min, color: palette.textTertiary }}>{label}</label>
      <div className="flex gap-2">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className="flex-1 flex flex-col items-center py-2.5 rounded-xl cursor-pointer transition-all"
              style={{
                backgroundColor: active
                  ? accentTint(accent, isDark ? 0.12 : 0.06)
                  : isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                border: `1.5px solid ${active ? accent : palette.border}`,
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.borderColor = palette.textTertiary;
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.borderColor = palette.border;
              }}
            >
              <span className="font-semibold" style={{ fontSize: F.sm, color: active ? accent : palette.text }}>
                {opt.label}
              </span>
              <span style={{ fontSize: F.min, color: palette.textSecondary, marginTop: 2 }}>
                {opt.example}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
