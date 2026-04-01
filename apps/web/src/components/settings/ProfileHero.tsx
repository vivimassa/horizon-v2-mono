"use client";

import { Camera, Mail } from "lucide-react";
import { accentTint, type Palette as PaletteType } from "@skyhub/ui/theme";
import { WEB_FONTS as F } from "@/lib/fonts";

interface ProfileHeroProps {
  palette: PaletteType;
  isDark: boolean;
  accent: string;
  user: {
    name: string;
    initials: string;
    email: string;
    isActive: boolean;
    isAdmin: boolean;
    department: string;
    office: string;
  };
}

export function ProfileHero({ palette, isDark, accent, user }: ProfileHeroProps) {
  const heroGradient = isDark
    ? "linear-gradient(135deg, rgba(30,64,175,0.12), rgba(124,58,237,0.08))"
    : "linear-gradient(135deg, rgba(30,64,175,0.07), rgba(124,58,237,0.05))";
  const heroBorder = isDark ? "rgba(255,255,255,0.06)" : "rgba(30,64,175,0.08)";

  return (
    <div
      className="relative overflow-hidden rounded-[20px] p-4 md:py-5 md:px-8"
      style={{ background: heroGradient, border: `1px solid ${heroBorder}` }}
    >
      {/* Decorative blob */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: -30, right: -30, width: 120, height: 120,
          background: `radial-gradient(circle, ${accentTint(accent, 0.06)}, transparent 70%)`,
          borderRadius: "50%",
        }}
      />

      <div className="flex flex-col md:flex-row md:items-center gap-5">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div
              className="w-14 h-14 md:w-16 md:h-16 rounded-2xl md:rounded-[18px] flex items-center justify-center"
              style={{ backgroundColor: accent }}
            >
              <span style={{ fontSize: F.xxl, fontWeight: 700, color: "#fff" }}>
                {user.initials}
              </span>
            </div>
            <button
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer"
              style={{
                backgroundColor: palette.card,
                border: `2px solid ${isDark ? "#1a1a1a" : "#f5f5f5"}`,
              }}
            >
              <Camera size={10} style={{ color: accent }} strokeWidth={2.5} />
            </button>
          </div>

          {/* Name + email + badges */}
          <div className="min-w-0">
            <div style={{ fontSize: F.xxl, fontWeight: 600, color: palette.text }}>
              {user.name}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <Mail size={14} style={{ color: palette.textSecondary }} strokeWidth={1.8} />
              <span className="truncate" style={{ fontSize: F.sm, color: palette.textSecondary }}>
                {user.email}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              {user.isActive && (
                <span
                  className="font-semibold px-2.5 py-0.5 rounded-full"
                  style={{
                    fontSize: F.min,
                    backgroundColor: isDark ? "rgba(22,163,74,0.15)" : "#dcfce7",
                    color: isDark ? "#4ade80" : "#166534",
                  }}
                >
                  Active
                </span>
              )}
              {user.isAdmin && (
                <span
                  className="font-semibold px-2.5 py-0.5 rounded-full"
                  style={{
                    fontSize: F.min,
                    backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08),
                    color: isDark ? "#60a5fa" : accent,
                  }}
                >
                  Administrator
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: desktop stats */}
        <div className="hidden md:flex items-center gap-8 shrink-0 pr-2">
          <StatItem label="Department" value={user.department} accent={accent} palette={palette} />
          <div style={{ width: 1, height: 36, backgroundColor: palette.border }} />
          <StatItem label="Office" value={user.office} accent={accent} palette={palette} />
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value, accent, palette }: { label: string; value: string; accent: string; palette: PaletteType }) {
  return (
    <div className="text-center">
      <div style={{ fontSize: F.xl, fontWeight: 700, color: accent }}>{value}</div>
      <div style={{ fontSize: F.min, fontWeight: 500, color: palette.textSecondary }}>{label}</div>
    </div>
  );
}
