"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Lock,
  ShieldCheck,
  Smartphone,
  Monitor,
  Globe,
  ScanFace,
  Eye,
  EyeOff,
  Clock,
  KeyRound,
  LogOut,
  AlertTriangle,
  Check,
} from "lucide-react";
import { colors, accentTint, type Palette as PaletteType } from "@skyhub/ui/theme";
import { useTheme } from "@/components/theme-provider";
import { useUser } from "@/components/user-provider";
import { userApi } from "@/lib/api";
import { WEB_LAYOUT } from "@/lib/fonts";
import { useDisplay } from "@/components/display-provider";

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

const MOCK_SESSIONS = [
  { device: "MacBook Pro", browser: "Chrome 124", location: "Ho Chi Minh City", time: "Active now", icon: Monitor, current: true },
  { device: "iPhone 15", browser: "Safari", location: "Ho Chi Minh City", time: "2 hours ago", icon: Smartphone, current: false },
  { device: "Windows PC", browser: "Edge 123", location: "Hanoi", time: "3 days ago", icon: Monitor, current: false },
];

const MOCK_ACTIVITY = [
  { text: "Password changed", detail: "15 Mar 2026", icon: KeyRound },
  { text: "New login from iPhone 15", detail: "31 Mar 2026, 19:40", icon: Smartphone },
  { text: "2FA disabled", detail: "10 Feb 2026", icon: AlertTriangle, color: "#b45309" },
  { text: "New login from MacBook Pro", detail: "31 Mar 2026, 08:15", icon: Monitor },
];

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

export default function SecurityPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const palette: PaletteType = isDark ? colors.dark : colors.light;
  const { fonts: F } = useDisplay();
  const glass = isDark ? GLASS.dark : GLASS.light;
  const { user, refetch } = useUser();

  const [biometric, setBiometric] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [sessions, setSessions] = useState(MOCK_SESSIONS);

  // Sync from API
  React.useEffect(() => {
    if (user) {
      setTwoFactor(user.security.twoFactorEnabled);
      setBiometric(user.security.biometricEnabled);
      if (user.security.sessions?.length) {
        setSessions(user.security.sessions.map((s) => ({
          device: s.device,
          browser: s.browser,
          location: s.location,
          time: s.isCurrent ? "Active now" : formatTimeAgo(s.lastActive),
          icon: s.device.includes("iPhone") || s.device.includes("Android") ? Smartphone : Monitor,
          current: s.isCurrent,
        })));
      }
    }
  }, [user]);

  const passwordMatch = newPw.length > 0 && newPw === confirmPw;
  const canSubmit = currentPw.length > 0 && newPw.length >= 8 && passwordMatch;

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
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden gap-4 px-4 pb-4">
        {/* ── Left Panel: Change Password + 2FA ── */}
        <aside
          className="shrink-0 flex flex-col rounded-2xl border overflow-y-auto"
          style={{
            width: WEB_LAYOUT.sidebarWidth,
            background: glass.card, borderColor: glass.cardBorder,
            backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur,
            boxShadow: glass.shadow,
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: accentTint("#dc2626", isDark ? 0.15 : 0.08) }}
            >
              <Lock size={20} style={{ color: "#dc2626" }} strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="font-bold" style={{ fontSize: F.xl, color: palette.text }}>Security</h1>
              <p style={{ fontSize: F.min, color: palette.textSecondary }}>Password & authentication</p>
            </div>
          </div>

          <div className="mx-5" style={{ height: 0.5, backgroundColor: palette.border }} />

          {/* Change Password Form */}
          <div className="px-5 py-4">
            <p className="uppercase tracking-wider mb-3"
              style={{ fontSize: 11, fontWeight: 600, color: palette.textTertiary }}>
              Change Password
            </p>

            <PasswordField
              label="Current Password" value={currentPw} onChange={setCurrentPw}
              show={showCurrent} onToggleShow={() => setShowCurrent(!showCurrent)}
              palette={palette} isDark={isDark}
            />
            <PasswordField
              label="New Password" value={newPw} onChange={setNewPw}
              show={showNew} onToggleShow={() => setShowNew(!showNew)}
              palette={palette} isDark={isDark}
              hint={newPw.length > 0 && newPw.length < 8 ? "Minimum 8 characters" : undefined}
            />
            <PasswordField
              label="Confirm Password" value={confirmPw} onChange={setConfirmPw}
              show={showConfirm} onToggleShow={() => setShowConfirm(!showConfirm)}
              palette={palette} isDark={isDark}
              error={confirmPw.length > 0 && !passwordMatch ? "Passwords do not match" : undefined}
              success={passwordMatch ? "Passwords match" : undefined}
            />

            <button
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold text-white cursor-pointer transition-opacity mt-3"
              style={{
                fontSize: F.sm,
                backgroundColor: canSubmit ? ACCENT : palette.textTertiary,
                opacity: canSubmit ? 1 : 0.5,
                pointerEvents: canSubmit ? "auto" : "none",
              }}
            >
              <Lock size={14} strokeWidth={2} />
              Update Password
            </button>
          </div>

          <div className="mx-5" style={{ height: 0.5, backgroundColor: palette.border }} />

          {/* Two-Factor Authentication */}
          <div className="px-5 py-4">
            <p className="uppercase tracking-wider mb-3"
              style={{ fontSize: 11, fontWeight: 600, color: palette.textTertiary }}>
              Two-Factor Authentication
            </p>

            <div
              className="flex items-center justify-between rounded-xl p-4"
              style={{
                backgroundColor: twoFactor
                  ? accentTint("#16a34a", isDark ? 0.1 : 0.05)
                  : accentTint("#b45309", isDark ? 0.1 : 0.05),
                border: `1px solid ${twoFactor
                  ? accentTint("#16a34a", 0.2)
                  : accentTint("#b45309", 0.15)}`,
              }}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck
                  size={20}
                  style={{ color: twoFactor ? (isDark ? "#4ade80" : "#16a34a") : (isDark ? "#fbbf24" : "#b45309") }}
                  strokeWidth={1.8}
                />
                <div>
                  <p className="font-semibold" style={{ fontSize: F.sm, color: palette.text }}>
                    {twoFactor ? "2FA Enabled" : "2FA Disabled"}
                  </p>
                  <p style={{ fontSize: F.min, color: palette.textSecondary }}>
                    {twoFactor ? "Your account is protected" : "Add an extra layer of security"}
                  </p>
                </div>
              </div>
              <button
                onClick={async () => { const next = !twoFactor; setTwoFactor(next); await userApi.updateSecurity({ twoFactorEnabled: next }); refetch(); }}
                className="relative rounded-full cursor-pointer transition-colors shrink-0"
                style={{
                  width: 44, height: 24,
                  backgroundColor: twoFactor ? (isDark ? "#4ade80" : "#16a34a") : (isDark ? "#444" : "#ddd"),
                }}
              >
                <div
                  className="absolute top-[2px] rounded-full bg-white transition-all"
                  style={{
                    width: 20, height: 20,
                    left: twoFactor ? 22 : 2,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                  }}
                />
              </button>
            </div>
          </div>

          <div className="mx-5" style={{ height: 0.5, backgroundColor: palette.border }} />

          {/* Biometric Login */}
          <div className="px-5 py-4">
            <p className="uppercase tracking-wider mb-3"
              style={{ fontSize: 11, fontWeight: 600, color: palette.textTertiary }}>
              Biometric Login
            </p>

            <div
              className="flex items-center justify-between rounded-xl p-4"
              style={{
                backgroundColor: biometric
                  ? accentTint(ACCENT, isDark ? 0.1 : 0.05)
                  : isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                border: `1px solid ${biometric
                  ? accentTint(ACCENT, 0.2)
                  : palette.border}`,
              }}
            >
              <div className="flex items-center gap-3">
                <ScanFace
                  size={20}
                  style={{ color: biometric ? ACCENT : palette.textSecondary }}
                  strokeWidth={1.8}
                />
                <div>
                  <p className="font-semibold" style={{ fontSize: F.sm, color: palette.text }}>
                    {biometric ? "Biometric Enabled" : "Biometric Disabled"}
                  </p>
                  <p style={{ fontSize: F.min, color: palette.textSecondary }}>
                    {biometric ? "Face ID or fingerprint active" : "Use Face ID or fingerprint to sign in"}
                  </p>
                </div>
              </div>
              <button
                onClick={async () => { const next = !biometric; setBiometric(next); await userApi.updateSecurity({ biometricEnabled: next }); refetch(); }}
                className="relative rounded-full cursor-pointer transition-colors shrink-0"
                style={{
                  width: 44, height: 24,
                  backgroundColor: biometric ? ACCENT : (isDark ? "#444" : "#ddd"),
                }}
              >
                <div
                  className="absolute top-[2px] rounded-full bg-white transition-all"
                  style={{
                    width: 20, height: 20,
                    left: biometric ? 22 : 2,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                  }}
                />
              </button>
            </div>
          </div>
        </aside>

        {/* ── Right Panel: Sessions + Activity ── */}
        <section className="flex-1 flex flex-col gap-4">
            {/* Active Sessions */}
            <GlassCard title="Active Sessions" icon={Globe} palette={palette} isDark={isDark} glass={glass}>
              <div className="flex flex-col">
                {MOCK_SESSIONS.map((session, i) => {
                  const Icon = session.icon;
                  return (
                    <React.Fragment key={i}>
                      <div className="flex items-center py-3.5">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center mr-3.5 shrink-0"
                          style={{ backgroundColor: accentTint(session.current ? ACCENT : palette.textTertiary, isDark ? 0.12 : 0.06) }}
                        >
                          <Icon size={18} style={{ color: session.current ? ACCENT : palette.textSecondary }} strokeWidth={1.8} />
                        </div>
                        <div className="flex-1 min-w-0 mr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ fontSize: F.sm, color: palette.text }}>
                              {session.device}
                            </span>
                            {session.current && (
                              <span className="px-2 py-0.5 rounded-full font-semibold"
                                style={{
                                  fontSize: 11,
                                  backgroundColor: isDark ? "rgba(22,163,74,0.15)" : "#dcfce7",
                                  color: isDark ? "#4ade80" : "#16a34a",
                                }}>
                                This device
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: F.min, color: palette.textSecondary, marginTop: 2 }}>
                            {session.browser} &middot; {session.location}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span style={{ fontSize: F.min, color: palette.textTertiary }}>
                            {session.time}
                          </span>
                          {!session.current && (
                            <button
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                              style={{
                                fontSize: F.min, fontWeight: 600,
                                color: "#dc2626",
                                backgroundColor: isDark ? "rgba(220,38,38,0.1)" : "rgba(220,38,38,0.06)",
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? "rgba(220,38,38,0.2)" : "rgba(220,38,38,0.12)"}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isDark ? "rgba(220,38,38,0.1)" : "rgba(220,38,38,0.06)"}
                            >
                              <LogOut size={14} strokeWidth={2} />
                              Revoke
                            </button>
                          )}
                        </div>
                      </div>
                      {i < MOCK_SESSIONS.length - 1 && (
                        <div style={{ height: 0.5, backgroundColor: palette.border, marginLeft: 54 }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </GlassCard>

            {/* Security Activity — grows to fill remaining height */}
            <div className="flex-1">
              <GlassCard title="Security Activity" icon={Clock} palette={palette} isDark={isDark} glass={glass} fillHeight>
                <div className="flex flex-col gap-3">
                  {MOCK_ACTIVITY.map((item, i) => {
                    const Icon = item.icon;
                    const col = item.color ?? palette.textTertiary;
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                          style={{ backgroundColor: accentTint(col, isDark ? 0.12 : 0.06) }}
                        >
                          <Icon size={14} style={{ color: col }} strokeWidth={2} />
                        </div>
                        <div>
                          <p className="font-medium" style={{ fontSize: F.sm, color: palette.text }}>{item.text}</p>
                          <p style={{ fontSize: F.min, color: palette.textTertiary, marginTop: 1 }}>{item.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            </div>
        </section>
      </div>
    </div>
  );
}

// ── Sub-components ──

function PasswordField({
  label, value, onChange, show, onToggleShow, palette, isDark, hint, error, success,
}: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggleShow: () => void;
  palette: PaletteType; isDark: boolean;
  hint?: string; error?: string; success?: string;
}) {
  const { fonts: F } = useDisplay();
  return (
    <div className="mb-3">
      <label className="block mb-1.5" style={{ fontSize: F.min, color: palette.textTertiary }}>{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl font-medium"
          style={{
            fontSize: F.sm,
            color: palette.text,
            backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
            border: `1px solid ${error ? "#dc2626" : isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}`,
            padding: "10px 40px 10px 14px",
            outline: "none",
          }}
          onFocus={(e) => {
            if (!error) {
              e.currentTarget.style.borderColor = ACCENT;
              e.currentTarget.style.boxShadow = `0 0 0 3px ${accentTint(ACCENT, isDark ? 0.2 : 0.12)}`;
            }
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? "#dc2626" : isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
        <button
          onClick={onToggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
          style={{ color: palette.textTertiary }}
        >
          {show ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
        </button>
      </div>
      {hint && <p style={{ fontSize: 12, color: "#b45309", marginTop: 4 }}>{hint}</p>}
      {error && <p style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>{error}</p>}
      {success && (
        <p className="flex items-center gap-1" style={{ fontSize: 12, color: isDark ? "#4ade80" : "#16a34a", marginTop: 4 }}>
          <Check size={12} strokeWidth={2.5} /> {success}
        </p>
      )}
    </div>
  );
}

function GlassCard({
  title, icon: Icon, palette, isDark, glass, children, fillHeight,
}: {
  title: string; icon: typeof Lock; palette: PaletteType; isDark: boolean;
  glass: typeof GLASS.light; children: React.ReactNode; fillHeight?: boolean;
}) {
  const { fonts: F } = useDisplay();
  return (
    <div
      className={`rounded-2xl border overflow-hidden ${fillHeight ? "flex flex-col h-full" : ""}`}
      style={{
        background: glass.card, borderColor: glass.cardBorder,
        backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur,
        boxShadow: glass.shadow,
      }}
    >
      <div
        className="flex items-center gap-2.5 px-5 py-3.5"
        style={{ borderBottom: `1px solid ${palette.border}` }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: accentTint(ACCENT, isDark ? 0.15 : 0.08) }}
        >
          <Icon size={16} style={{ color: ACCENT }} strokeWidth={1.8} />
        </div>
        <h3 className="font-bold" style={{ fontSize: F.lg, color: palette.text, letterSpacing: -0.2 }}>
          {title}
        </h3>
      </div>
      <div className={`px-5 py-4 ${fillHeight ? "flex-1" : ""}`}>{children}</div>
    </div>
  );
}
