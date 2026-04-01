"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  Mail,
  Phone,
  MapPin,
  Globe,
  Hash,
  Briefcase,
  Edit3,
  Users,
  Shield,
  Save,
  X,
  Check,
} from "lucide-react";
import { colors, accentTint, type Palette as PaletteType } from "@skyhub/ui/theme";
import { useTheme } from "@/components/theme-provider";

const ACCENT = "#1e40af";

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  department: string;
  employeeId: string;
  phone: string;
  officePhone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  location: string;
  joinDate: string;
  role: string;
  status: string;
  lastLogin: string;
}

const INITIAL_DATA: ProfileData = {
  firstName: "Nguyen",
  lastName: "Van A",
  email: "nguyen.vana@skyhub.aero",
  jobTitle: "Operations Manager",
  department: "Flight Operations",
  employeeId: "EMP-20198",
  phone: "+84 912 345 678",
  officePhone: "+84 28 3847 1234 ext. 402",
  dateOfBirth: "1985-03-15",
  gender: "Male",
  address: "45 Nguyen Hue Blvd, District 1, Ho Chi Minh City",
  location: "SGN — Tan Son Nhat International",
  joinDate: "2019-04-01",
  role: "Administrator",
  status: "Active",
  lastLogin: "2026-03-31T14:22:00Z",
};

const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"];
const DEPARTMENT_OPTIONS = [
  "Flight Operations",
  "Ground Operations",
  "Crew Management",
  "Network Planning",
  "Engineering",
  "Safety & Compliance",
  "Administration",
];
const ROLE_OPTIONS = ["Administrator", "Manager", "Operator", "Viewer"];

const GLASS = {
  light: {
    card: "rgba(255,255,255,0.55)",
    cardBorder: "rgba(0,0,0,0.06)",
    blur: "blur(16px) saturate(160%)",
    shadow: "0 2px 12px rgba(0,0,0,0.04)",
    input: "rgba(0,0,0,0.03)",
    inputBorder: "rgba(0,0,0,0.1)",
    inputFocus: "rgba(30,64,175,0.15)",
  },
  dark: {
    card: "rgba(255,255,255,0.04)",
    cardBorder: "rgba(255,255,255,0.07)",
    blur: "blur(16px) saturate(140%)",
    shadow: "0 2px 12px rgba(0,0,0,0.2)",
    input: "rgba(255,255,255,0.05)",
    inputBorder: "rgba(255,255,255,0.12)",
    inputFocus: "rgba(30,64,175,0.25)",
  },
};

export default function ProfilePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const palette: PaletteType = isDark ? colors.dark : colors.light;
  const glass = isDark ? GLASS.dark : GLASS.light;

  const [data, setData] = useState<ProfileData>(INITIAL_DATA);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileData>(INITIAL_DATA);
  const [saved, setSaved] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAvatarClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const [avatarError, setAvatarError] = useState<string | null>(null);

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Image must be under 5 MB");
      setTimeout(() => setAvatarError(null), 3000);
      return;
    }
    setAvatarError(null);
    const url = URL.createObjectURL(file);
    setAvatarUrl(url);
  }, []);

  const startEdit = useCallback(() => {
    setDraft({ ...data });
    setEditing(true);
    setSaved(false);
  }, [data]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const saveEdit = useCallback(() => {
    setData({ ...draft });
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [draft]);

  const updateField = useCallback((key: keyof ProfileData, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const current = editing ? draft : data;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 px-5 py-3 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer group transition-all duration-150"
          style={{
            color: palette.text,
            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.55)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.75)";
            e.currentTarget.style.borderColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.55)";
            e.currentTarget.style.borderColor = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";
          }}
        >
          <ArrowLeft
            size={15}
            strokeWidth={2}
            className="transition-transform group-hover:-translate-x-0.5"
          />
          <span className="text-[13px] font-semibold">Settings</span>
        </button>

        <div className="flex items-center gap-2">
          {saved && (
            <span
              className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-lg"
              style={{ color: "#166534", backgroundColor: "#dcfce7" }}
            >
              <Check size={13} strokeWidth={2.5} />
              Saved
            </span>
          )}
          {editing ? (
            <>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-colors"
                style={{
                  color: palette.text,
                  backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                  border: `1px solid ${palette.border}`,
                }}
              >
                <X size={14} strokeWidth={2} />
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-white cursor-pointer transition-opacity hover:opacity-90"
                style={{ backgroundColor: ACCENT }}
              >
                <Save size={14} strokeWidth={2} />
                Save Changes
              </button>
            </>
          ) : (
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-white cursor-pointer transition-opacity hover:opacity-90"
              style={{ backgroundColor: ACCENT }}
            >
              <Edit3 size={14} strokeWidth={2} />
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Main: left + right */}
      <div className="flex flex-1 overflow-hidden gap-4 px-4 pb-4">
        {/* ── Left Panel ── */}
        <aside
          className="w-[300px] shrink-0 flex flex-col rounded-2xl border overflow-y-auto"
          style={{
            background: glass.card,
            borderColor: glass.cardBorder,
            backdropFilter: glass.blur,
            WebkitBackdropFilter: glass.blur,
            boxShadow: glass.shadow,
          }}
        >
          <div className="flex flex-col items-center pt-4 pb-5 px-4">
            <div className="relative mb-4">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-[28px] font-bold"
                  style={{
                    backgroundColor: accentTint(ACCENT, isDark ? 0.15 : 0.08),
                    color: ACCENT,
                  }}
                >
                  {current.firstName[0]}{current.lastName[0]}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <button
                onClick={handleAvatarClick}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                style={{
                  backgroundColor: ACCENT,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                }}
              >
                <Camera size={14} color="#fff" strokeWidth={2} />
              </button>
            </div>
            {avatarError && (
              <p className="text-[11px] font-medium mb-1" style={{ color: "#991b1b" }}>
                {avatarError}
              </p>
            )}
            <h2 className="text-[17px] font-bold" style={{ color: palette.text }}>
              {current.firstName} {current.lastName}
            </h2>
            <p className="text-[12px] mt-0.5" style={{ color: palette.textSecondary }}>
              {current.role}
            </p>
            <div
              className="mt-3 px-3 py-1 rounded-full text-[11px] font-semibold"
              style={{ backgroundColor: "#dcfce7", color: "#166534" }}
            >
              {current.status}
            </div>
          </div>

          <div className="mx-4" style={{ height: 0.5, backgroundColor: palette.border }} />

          <div className="px-4 py-5 flex flex-col gap-4">
            <QuickInfoRow icon={Briefcase} label="Department" value={current.department} palette={palette} />
            <QuickInfoRow icon={Shield} label="Role" value={current.role} palette={palette} />
            <QuickInfoRow icon={Hash} label="Employee ID" value={current.employeeId} palette={palette} />
            <QuickInfoRow icon={Mail} label="Email" value={current.email} palette={palette} isSmall />
            <QuickInfoRow icon={Phone} label="Phone" value={current.phone} palette={palette} />
            <QuickInfoRow icon={MapPin} label="Location" value={current.location} palette={palette} isSmall />
          </div>

          <div className="mx-4" style={{ height: 0.5, backgroundColor: palette.border }} />

          <div className="px-4 py-4 flex flex-col gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: palette.textTertiary }}>
              Account
            </p>
            <p className="text-[12px]" style={{ color: palette.textSecondary }}>
              Last login: {formatDateTime(current.lastLogin)}
            </p>
          </div>
        </aside>

        {/* ── Right Panel ── */}
        <section className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4">
            {/* Personal Information */}
            <GlassCard title="Personal Information" icon={Users} palette={palette} isDark={isDark} glass={glass}>
              <div className="grid grid-cols-2 gap-x-8">
                <EditableField
                  label="First Name" fieldKey="firstName" value={current.firstName}
                  editing={editing} palette={palette} glass={glass} isDark={isDark}
                  onChange={updateField}
                />
                <EditableField
                  label="Last Name" fieldKey="lastName" value={current.lastName}
                  editing={editing} palette={palette} glass={glass} isDark={isDark}
                  onChange={updateField}
                />
                <EditableField
                  label="Date of Birth" fieldKey="dateOfBirth" value={current.dateOfBirth}
                  editing={editing} palette={palette} glass={glass} isDark={isDark}
                  onChange={updateField} type="date" displayValue={formatDate(current.dateOfBirth)}
                />
                <EditableField
                  label="Gender" fieldKey="gender" value={current.gender}
                  editing={editing} palette={palette} glass={glass} isDark={isDark}
                  onChange={updateField} type="select" options={GENDER_OPTIONS}
                />
                <EditableField
                  label="Department" fieldKey="department" value={current.department}
                  editing={editing} palette={palette} glass={glass} isDark={isDark}
                  onChange={updateField} type="select" options={DEPARTMENT_OPTIONS}
                />
                <EditableField
                  label="Employee ID" fieldKey="employeeId" value={current.employeeId}
                  editing={editing} palette={palette} glass={glass} isDark={isDark}
                  onChange={updateField}
                />
              </div>
            </GlassCard>

            {/* Contact Information */}
            <GlassCard title="Contact Information" icon={Mail} palette={palette} isDark={isDark} glass={glass}>
              <div className="grid grid-cols-2 gap-x-8">
                <EditableField
                  label="Email Address" fieldKey="email" value={current.email}
                  editing={editing} palette={palette} glass={glass} isDark={isDark}
                  onChange={updateField} type="email"
                />
                <EditableField
                  label="Mobile Phone" fieldKey="phone" value={current.phone}
                  editing={editing} palette={palette} glass={glass} isDark={isDark}
                  onChange={updateField} type="tel"
                />
                <EditableField
                  label="Office Phone" fieldKey="officePhone" value={current.officePhone}
                  editing={editing} palette={palette} glass={glass} isDark={isDark}
                  onChange={updateField} type="tel"
                />
              </div>
            </GlassCard>

            {/* System & Preferences */}
            <GlassCard title="System & Preferences" icon={Globe} palette={palette} isDark={isDark} glass={glass}>
              <div className="grid grid-cols-2 gap-x-8">
                <EditableField
                  label="System Role" fieldKey="role" value={current.role}
                  editing={editing} palette={palette} glass={glass} isDark={isDark}
                  onChange={updateField} type="select" options={ROLE_OPTIONS}
                />
                <EditableField
                  label="Last Login" fieldKey="lastLogin" value={current.lastLogin}
                  editing={false} palette={palette} glass={glass} isDark={isDark}
                  onChange={updateField} displayValue={formatDateTime(current.lastLogin)}
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

// ── Helpers ──

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  }) + " " + d.toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Sub-components ──

function QuickInfoRow({
  icon: Icon, label, value, palette, isSmall,
}: {
  icon: typeof Mail; label: string; value: string; palette: PaletteType; isSmall?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon size={15} strokeWidth={1.6} style={{ color: palette.textTertiary }} className="shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider" style={{ color: palette.textTertiary }}>{label}</p>
        <p className={`${isSmall ? "text-[12px]" : "text-[13px]"} font-medium truncate`} style={{ color: palette.text }}>
          {value}
        </p>
      </div>
    </div>
  );
}

function GlassCard({
  title, icon: Icon, palette, isDark, glass, children,
}: {
  title: string; icon: typeof Mail; palette: PaletteType; isDark: boolean;
  glass: typeof GLASS.light; children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        background: glass.card,
        borderColor: glass.cardBorder,
        backdropFilter: glass.blur,
        WebkitBackdropFilter: glass.blur,
        boxShadow: glass.shadow,
      }}
    >
      <div
        className="flex items-center gap-2.5 px-5 py-3"
        style={{ borderBottom: `1px solid ${palette.border}` }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: accentTint(ACCENT, isDark ? 0.15 : 0.08) }}
        >
          <Icon size={14} style={{ color: ACCENT }} strokeWidth={1.8} />
        </div>
        <h3 className="text-[14px] font-bold" style={{ color: palette.text, letterSpacing: -0.2 }}>
          {title}
        </h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function EditableField({
  label,
  fieldKey,
  value,
  displayValue,
  editing,
  palette,
  glass,
  isDark,
  onChange,
  type = "text",
  options,
}: {
  label: string;
  fieldKey: keyof ProfileData;
  value: string;
  displayValue?: string;
  editing: boolean;
  palette: PaletteType;
  glass: typeof GLASS.light;
  isDark: boolean;
  onChange: (key: keyof ProfileData, value: string) => void;
  type?: "text" | "email" | "tel" | "date" | "select";
  options?: string[];
}) {
  const inputStyle: React.CSSProperties = {
    width: "100%",
    fontSize: 13,
    fontWeight: 500,
    color: palette.text,
    backgroundColor: glass.input,
    border: `1px solid ${glass.inputBorder}`,
    borderRadius: 10,
    padding: "8px 12px",
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };

  if (!editing) {
    return (
      <div className="py-2.5" style={{ borderBottom: `0.5px solid ${palette.border}` }}>
        <p className="text-[11px] mb-0.5" style={{ color: palette.textTertiary }}>{label}</p>
        <p className="text-[13px] font-medium" style={{ color: palette.text }}>
          {displayValue ?? value}
        </p>
      </div>
    );
  }

  if (type === "select" && options) {
    return (
      <div className="py-2.5" style={{ borderBottom: `0.5px solid ${palette.border}` }}>
        <label className="text-[11px] mb-1.5 block" style={{ color: palette.textTertiary }}>{label}</label>
        <select
          value={value}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          style={{
            ...inputStyle,
            appearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${isDark ? '%23888' : '%23999'}' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 12px center",
            paddingRight: 32,
            cursor: "pointer",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = ACCENT;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${glass.inputFocus}`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = glass.inputBorder;
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="py-2.5" style={{ borderBottom: `0.5px solid ${palette.border}` }}>
      <label className="text-[11px] mb-1.5 block" style={{ color: palette.textTertiary }}>{label}</label>
      <input
        type={type}
        value={type === "date" ? value : value}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        style={inputStyle}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = ACCENT;
          e.currentTarget.style.boxShadow = `0 0 0 3px ${glass.inputFocus}`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = glass.inputBorder;
          e.currentTarget.style.boxShadow = "none";
        }}
      />
    </div>
  );
}
