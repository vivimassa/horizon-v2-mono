"use client";

import { useState } from "react";
import {
  colors,
  accentTint,
  getStatusColors,
  typography,
  type StatusKey,
  type Palette,
} from "@skyhub/ui/theme";

const ALL_STATUSES: StatusKey[] = [
  "onTime",
  "delayed",
  "cancelled",
  "departed",
  "diverted",
  "scheduled",
];

const STATUS_LABELS: Record<StatusKey, string> = {
  onTime: "On Time",
  delayed: "Delayed",
  cancelled: "Cancelled",
  departed: "Departed",
  diverted: "Diverted",
  scheduled: "Scheduled",
};

export default function DesignSystemPage() {
  const [isDark, setIsDark] = useState(false);
  const [accentColor, setAccentColor] = useState<string>(colors.defaultAccent);

  const palette: Palette = isDark ? colors.dark : colors.light;

  return (
    <div
      className="min-h-screen p-6 transition-colors"
      style={{
        background: isDark
          ? "linear-gradient(180deg, #1a1a1a, #141414)"
          : "linear-gradient(180deg, #ffffff, #f5f5f5)",
        color: palette.text,
      }}
    >
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              style={{
                fontSize: typography.pageTitle.fontSize,
                fontWeight: typography.pageTitle.fontWeight,
              }}
            >
              Design System
            </h1>
            <p
              style={{
                fontSize: typography.caption.fontSize,
                color: palette.textSecondary,
              }}
            >
              SkyHub primitives — web preview
            </p>
          </div>
          <button
            onClick={() => setIsDark(!isDark)}
            className="rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer"
            style={{
              backgroundColor: palette.card,
              color: palette.text,
              border: `1px solid ${palette.border}`,
            }}
          >
            {isDark ? "Light" : "Dark"}
          </button>
        </div>

        {/* Accent Color Picker */}
        <SectionHeader title="Accent Color" accentColor={accentColor} palette={palette} />
        <Card palette={palette}>
          <div className="flex flex-wrap gap-2">
            {Object.entries(colors.accentPresets).map(([name, hex]) => (
              <button
                key={name}
                onClick={() => setAccentColor(hex)}
                className="rounded-lg px-3 py-2 text-center cursor-pointer"
                style={{
                  backgroundColor:
                    hex === accentColor ? accentTint(hex, 0.15) : "transparent",
                  border: `1px solid ${hex === accentColor ? hex : palette.border}`,
                }}
              >
                <div
                  className="w-4 h-4 rounded-full mx-auto mb-1"
                  style={{ backgroundColor: hex }}
                />
                <span style={{ fontSize: 11, fontWeight: 600, color: palette.text }}>
                  {name}
                </span>
              </button>
            ))}
          </div>
        </Card>

        {/* Cards */}
        <SectionHeader title="Cards" accentColor={accentColor} palette={palette} />
        <Card palette={palette}>
          <p style={{ fontSize: 14, color: palette.text }}>
            Standard card with shadow elevation and rounded-xl corners.
          </p>
        </Card>
        <div className="h-2" />
        <Card palette={palette} pressable>
          <p style={{ fontSize: 14, color: palette.text }}>
            Compact pressable card. Hover to see effect.
          </p>
        </Card>

        {/* List Items */}
        <SectionHeader title="List Items" accentColor={accentColor} palette={palette} />
        <Card palette={palette} padding="none">
          <ListItemRow
            title="Airport VVTS"
            subtitle="Ho Chi Minh City"
            palette={palette}
            showChevron
          />
          <ListItemRow
            title="Aircraft VN-A321"
            subtitle="Airbus A321"
            palette={palette}
            rightElement={
              <StatusChipEl status="onTime" isDark={isDark} />
            }
          />
          <ListItemRow
            title="Active Item"
            subtitle="Highlighted with accent tint"
            palette={palette}
            isActive
            accentColor={accentColor}
            isLast
          />
        </Card>

        {/* Status Chips */}
        <SectionHeader title="Status Chips" accentColor={accentColor} palette={palette} />
        <Card palette={palette}>
          <div className="flex flex-wrap gap-2">
            {ALL_STATUSES.map((s) => (
              <StatusChipEl key={s} status={s} isDark={isDark} />
            ))}
          </div>
        </Card>

        {/* Buttons */}
        <SectionHeader title="Buttons" accentColor={accentColor} palette={palette} />
        <Card palette={palette}>
          <div className="flex flex-col gap-3">
            <ButtonEl label="Assign Crew" variant="primary" accent={accentColor} palette={palette} />
            <ButtonEl label="Cancel" variant="secondary" accent={accentColor} palette={palette} />
            <ButtonEl label="View Details" variant="ghost" accent={accentColor} palette={palette} />
            <ButtonEl label="Remove" variant="destructive" accent={accentColor} palette={palette} />
            <ButtonEl label="Disabled" variant="primary" accent={accentColor} palette={palette} disabled />
          </div>
        </Card>

        {/* Typography */}
        <SectionHeader title="Typography Scale" accentColor={accentColor} palette={palette} />
        <Card palette={palette}>
          <div className="flex flex-col gap-3">
            {Object.entries(typography).map(([key, val]) => (
              <div key={key} className="flex items-baseline gap-4">
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: palette.textTertiary,
                    width: 110,
                    flexShrink: 0,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {key}
                </span>
                <span
                  style={{
                    fontSize: val.fontSize,
                    fontWeight: Number(val.fontWeight),
                    lineHeight: `${val.lineHeight}px`,
                    letterSpacing: (val as any).letterSpacing,
                    textTransform: (val as any).textTransform,
                    color: palette.text,
                  }}
                >
                  The quick brown fox ({val.fontSize}px / {val.fontWeight})
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Badges */}
        <SectionHeader title="Badges" accentColor={accentColor} palette={palette} />
        <Card palette={palette}>
          <div className="flex gap-2">
            <BadgeEl label="12" bg={isDark ? "rgba(255,255,255,0.10)" : "#e8e8e8"} textColor={palette.textSecondary} />
            <BadgeEl label="New" bg={accentTint(accentColor, 0.12)} textColor={accentColor} />
            <BadgeEl label="0" bg={isDark ? "rgba(255,255,255,0.06)" : "#f0f0f0"} textColor={palette.textTertiary} />
          </div>
        </Card>

        {/* Empty State */}
        <SectionHeader title="Empty State" accentColor={accentColor} palette={palette} />
        <Card palette={palette}>
          <div className="flex flex-col items-center py-10 px-6">
            <div style={{ color: palette.textTertiary, fontSize: 32 }}>?</div>
            <p
              className="mt-3 text-center"
              style={{ fontSize: 14, fontWeight: 500, color: palette.textSecondary }}
            >
              No results
            </p>
            <p
              className="mt-1 text-center"
              style={{ fontSize: 12, color: palette.textTertiary }}
            >
              Try adjusting your search
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ── Helper components (inline, web-only) ── */

function SectionHeader({
  title,
  accentColor,
  palette,
}: {
  title: string;
  accentColor: string;
  palette: Palette;
}) {
  return (
    <div className="flex items-center mt-6 mb-2">
      <div
        className="w-[3px] h-4 rounded-full mr-2"
        style={{ backgroundColor: accentColor }}
      />
      <span
        style={{
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: -0.3,
          color: palette.text,
        }}
      >
        {title}
      </span>
    </div>
  );
}

function Card({
  children,
  palette,
  pressable,
  padding,
}: {
  children: React.ReactNode;
  palette: Palette;
  pressable?: boolean;
  padding?: "none" | "standard";
}) {
  return (
    <div
      className={`rounded-xl border ${padding === "none" ? "" : "p-4"} ${
        pressable ? "cursor-pointer hover:scale-[0.99] transition-transform" : ""
      }`}
      style={{
        backgroundColor: palette.card,
        borderColor: palette.cardBorder,
        boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
      }}
    >
      {children}
    </div>
  );
}

function ListItemRow({
  title,
  subtitle,
  palette,
  showChevron,
  rightElement,
  isActive,
  accentColor,
  isLast,
}: {
  title: string;
  subtitle: string;
  palette: Palette;
  showChevron?: boolean;
  rightElement?: React.ReactNode;
  isActive?: boolean;
  accentColor?: string;
  isLast?: boolean;
}) {
  return (
    <div>
      <div
        className="flex items-center px-3 py-2.5 cursor-pointer hover:opacity-80"
        style={{
          minHeight: 44,
          backgroundColor: isActive && accentColor
            ? accentTint(accentColor, 0.08)
            : undefined,
        }}
      >
        <div className="flex-1 mr-2">
          <p style={{ fontSize: 13, fontWeight: 500, color: palette.text }}>
            {title}
          </p>
          <p style={{ fontSize: 11, color: palette.textSecondary, marginTop: 2 }}>
            {subtitle}
          </p>
        </div>
        {rightElement}
        {showChevron && (
          <span style={{ color: palette.textTertiary, fontSize: 14 }}>
            {">"}
          </span>
        )}
      </div>
      {!isLast && (
        <div
          className="ml-3 mr-3"
          style={{ height: 0.5, backgroundColor: palette.border }}
        />
      )}
    </div>
  );
}

function StatusChipEl({ status, isDark }: { status: StatusKey; isDark: boolean }) {
  const { bg, text } = getStatusColors(status, isDark);
  return (
    <span
      className="rounded-md px-2 py-0.5 inline-block"
      style={{ backgroundColor: bg, color: text, fontSize: 11, fontWeight: 600 }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function ButtonEl({
  label,
  variant,
  accent,
  palette,
  disabled,
}: {
  label: string;
  variant: "primary" | "secondary" | "ghost" | "destructive";
  accent: string;
  palette: Palette;
  disabled?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: accent,
      color: "#fff",
      border: "none",
      boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
    },
    secondary: {
      backgroundColor: "transparent",
      color: accent,
      border: `1px solid ${accent}`,
    },
    ghost: {
      backgroundColor: "transparent",
      color: accent,
      border: "none",
    },
    destructive: {
      backgroundColor: "rgba(220,38,38,0.1)",
      color: "#dc2626",
      border: "none",
    },
  };

  return (
    <button
      className="rounded-[10px] px-4 font-semibold text-sm cursor-pointer"
      style={{
        ...styles[variant],
        minHeight: 44,
        opacity: disabled ? 0.5 : 1,
      }}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

function BadgeEl({
  label,
  bg,
  textColor,
}: {
  label: string;
  bg: string;
  textColor: string;
}) {
  return (
    <span
      className="rounded-md px-2 py-0.5"
      style={{ backgroundColor: bg, color: textColor, fontSize: 11, fontWeight: 600 }}
    >
      {label}
    </span>
  );
}
