'use client'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DatePicker } from '@/components/ui/date-picker'
import {
  ArrowLeft,
  Camera,
  Mail,
  Globe,
  Edit3,
  Users,
  Save,
  X,
  Check,
  Download,
  Clock,
  ShieldCheck,
  KeyRound,
  UserCheck,
} from 'lucide-react'
import { colors, accentTint, type Palette as PaletteType } from '@skyhub/ui/theme'
import { useTheme } from '@/components/theme-provider'
import { useUser } from '@/components/user-provider'
import { userApi } from '@/lib/api'
import { WEB_LAYOUT } from '@/lib/fonts'
import { useDisplay } from '@/components/display-provider'

const ACCENT = '#1e40af'

interface ProfileData {
  firstName: string
  lastName: string
  email: string
  jobTitle: string
  department: string
  employeeId: string
  phone: string
  officePhone: string
  dateOfBirth: string
  gender: string
  address: string
  location: string
  joinDate: string
  role: string
  status: string
  lastLogin: string
}

const INITIAL_DATA: ProfileData = {
  firstName: 'Nguyen',
  lastName: 'Van A',
  email: 'nguyen.vana@skyhub.aero',
  jobTitle: 'Operations Manager',
  department: 'Flight Operations',
  employeeId: 'EMP-20198',
  phone: '+84 912 345 678',
  officePhone: '+84 28 3847 1234 ext. 402',
  dateOfBirth: '1985-03-15',
  gender: 'Male',
  address: '45 Nguyen Hue Blvd, District 1, Ho Chi Minh City',
  location: 'SGN — Tan Son Nhat International',
  joinDate: '2019-04-01',
  role: 'Administrator',
  status: 'Active',
  lastLogin: '2026-03-31T14:22:00Z',
}

const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say']
const DEPARTMENT_OPTIONS = [
  'Flight Operations',
  'Ground Operations',
  'Crew Management',
  'Network Planning',
  'Engineering',
  'Safety & Compliance',
  'Administration',
]
const ROLE_OPTIONS = ['Administrator', 'Manager', 'Operator', 'Viewer']

const GLASS = {
  light: {
    card: 'rgba(255,255,255,0.55)',
    cardBorder: 'rgba(0,0,0,0.06)',
    blur: 'blur(16px) saturate(160%)',
    shadow: '0 2px 12px rgba(0,0,0,0.04)',
    input: 'rgba(0,0,0,0.03)',
    inputBorder: 'rgba(0,0,0,0.1)',
    inputFocus: 'rgba(30,64,175,0.15)',
  },
  dark: {
    card: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(255,255,255,0.07)',
    blur: 'blur(16px) saturate(140%)',
    shadow: '0 2px 12px rgba(0,0,0,0.2)',
    input: 'rgba(255,255,255,0.05)',
    inputBorder: 'rgba(255,255,255,0.12)',
    inputFocus: 'rgba(30,64,175,0.25)',
  },
}

// ── Completeness checklist ──
const COMPLETENESS_ITEMS: { label: string; check: (d: ProfileData, avatar: string | null) => boolean }[] = [
  { label: 'Add profile photo', check: (_d, a) => a !== null },
  { label: 'Add first and last name', check: (d) => d.firstName.length > 0 && d.lastName.length > 0 },
  { label: 'Add email address', check: (d) => d.email.length > 0 },
  { label: 'Add phone number', check: (d) => d.phone.length > 0 },
  { label: 'Set department', check: (d) => d.department.length > 0 },
  { label: 'Set employee ID', check: (d) => d.employeeId.length > 0 },
  { label: 'Add date of birth', check: (d) => d.dateOfBirth.length > 0 },
]

function computeCompleteness(data: ProfileData, avatarUrl: string | null): number {
  const done = COMPLETENESS_ITEMS.filter((item) => item.check(data, avatarUrl)).length
  return Math.round((done / COMPLETENESS_ITEMS.length) * 100)
}

export default function ProfilePage() {
  const router = useRouter()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette: PaletteType = isDark ? colors.dark : colors.light
  const { fonts: F } = useDisplay()
  const glass = isDark ? GLASS.dark : GLASS.light
  const { user, loading, refetch } = useUser()

  // Map API user to local ProfileData shape
  const apiToLocal = useCallback((u: typeof user): ProfileData => {
    if (!u) return INITIAL_DATA
    return {
      firstName: u.profile.firstName,
      lastName: u.profile.lastName,
      email: u.profile.email,
      jobTitle: u.role,
      department: u.profile.department,
      employeeId: u.profile.employeeId,
      phone: u.profile.phone,
      officePhone: u.profile.officePhone,
      dateOfBirth: u.profile.dateOfBirth,
      gender: u.profile.gender,
      address: u.profile.location,
      location: u.profile.location,
      joinDate: u.createdAt,
      role: u.role,
      status: u.isActive ? 'Active' : 'Inactive',
      lastLogin: u.lastLoginUtc,
    }
  }, [])

  const [data, setData] = useState<ProfileData>(INITIAL_DATA)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ProfileData>(INITIAL_DATA)
  const [saved, setSaved] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Sync from API on load
  React.useEffect(() => {
    if (user) {
      const mapped = apiToLocal(user)
      setData(mapped)
      setDraft(mapped)
      if (user.profile.avatarUrl) {
        const url = user.profile.avatarUrl
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'
        setAvatarUrl(url.startsWith('/uploads/') ? `${API_BASE}${url}` : url)
      }
    }
  }, [user, apiToLocal])

  const handleAvatarClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const [avatarError, setAvatarError] = useState<string | null>(null)

  const handleAvatarChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (!file.type.startsWith('image/')) return
      if (file.size > 5 * 1024 * 1024) {
        setAvatarError('Image must be under 5 MB')
        setTimeout(() => setAvatarError(null), 3000)
        return
      }
      setAvatarError(null)
      // Show instant preview
      const previewUrl = URL.createObjectURL(file)
      setAvatarUrl(previewUrl)

      // Upload to server
      try {
        const formData = new FormData()
        formData.append('avatar', file)
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'
        const res = await fetch(`${API_BASE}/users/me/avatar?userId=skyhub-admin-001`, {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Upload failed' }))
          setAvatarError(data.error || 'Could not upload avatar')
          setTimeout(() => setAvatarError(null), 3000)
          return
        }
        // Refetch user so avatarUrl persists across refreshes
        refetch()
      } catch (err: any) {
        setAvatarError(err.message || 'Could not upload avatar')
        setTimeout(() => setAvatarError(null), 3000)
      }
    },
    [refetch],
  )

  const current = editing ? draft : data
  const profilePercent = computeCompleteness(current, avatarUrl)

  const startEdit = useCallback(() => {
    setDraft({ ...data })
    setEditing(true)
    setSaved(false)
  }, [data])

  const cancelEdit = useCallback(() => {
    setEditing(false)
  }, [])

  const saveEdit = useCallback(async () => {
    try {
      await userApi.updateProfile({
        firstName: draft.firstName,
        lastName: draft.lastName,
        email: draft.email,
        phone: draft.phone,
        officePhone: draft.officePhone,
        dateOfBirth: draft.dateOfBirth,
        gender: draft.gender,
        department: draft.department,
        employeeId: draft.employeeId,
        location: draft.location,
      })
      setData({ ...draft })
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      refetch() // Sync global user context
    } catch (err) {
      console.error('Save failed:', err)
    }
  }, [draft, refetch])

  const updateField = useCallback((key: keyof ProfileData, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 px-5 py-3 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl cursor-pointer group transition-all duration-150"
          style={{
            color: palette.text,
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.6)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.6)'
          }}
        >
          <ArrowLeft size={15} strokeWidth={2} className="transition-transform group-hover:-translate-x-0.5" />
          <span style={{ fontSize: F.min, fontWeight: 600 }}>Settings</span>
        </button>

        <div className="flex items-center gap-2">
          {saved && (
            <span
              className="flex items-center gap-1 font-medium px-3 py-1.5 rounded-lg"
              style={{ fontSize: 13, color: '#166534', backgroundColor: '#dcfce7' }}
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
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-white cursor-pointer transition-opacity hover:opacity-90"
              style={{ fontSize: F.min, backgroundColor: ACCENT }}
            >
              <Edit3 size={14} strokeWidth={2} />
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Main: left + right */}
      <div className="flex flex-1 overflow-hidden gap-4 px-4 pb-4">
        {/* ── Left Panel: Identity + Navigation + Activity ── */}
        <aside
          className="shrink-0 flex flex-col rounded-2xl border overflow-y-auto"
          style={{
            width: WEB_LAYOUT.sidebarWidth,
            background: glass.card,
            borderColor: glass.cardBorder,
            backdropFilter: glass.blur,
            WebkitBackdropFilter: glass.blur,
            boxShadow: glass.shadow,
          }}
        >
          {/* Avatar with progress ring */}
          <div className="flex flex-col items-center pt-6 pb-4 px-4">
            <ProfileRing
              percent={profilePercent}
              accent={ACCENT}
              isDark={isDark}
              avatarUrl={avatarUrl}
              initials={`${current.firstName[0]}${current.lastName[0]}`}
              onCameraClick={handleAvatarClick}
            />
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            {avatarError && (
              <p className="font-medium mb-1" style={{ fontSize: F.min, color: '#991b1b' }}>
                {avatarError}
              </p>
            )}
            <h2 className="font-bold mt-3" style={{ fontSize: F.xl, color: palette.text }}>
              {current.firstName} {current.lastName}
            </h2>
            <p style={{ fontSize: F.sm, color: palette.textSecondary, marginTop: 2, textTransform: 'capitalize' }}>
              {current.role}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <span
                className="px-2.5 py-0.5 rounded-full font-semibold"
                style={{ fontSize: 11, backgroundColor: '#dcfce7', color: '#166534' }}
              >
                {current.status}
              </span>
            </div>
          </div>

          <div className="mx-4" style={{ height: 0.5, backgroundColor: palette.border }} />

          {/* Profile completeness checklist */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <p
                className="uppercase tracking-wider"
                style={{ fontSize: 11, fontWeight: 600, color: palette.textTertiary }}
              >
                Profile Completeness
              </p>
              <span style={{ fontSize: F.min, fontWeight: 700, color: ACCENT }}>{profilePercent}%</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {COMPLETENESS_ITEMS.map((item) => {
                const done = item.check(current, avatarUrl)
                return (
                  <div key={item.label} className="flex items-center gap-2.5 py-1">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: done
                          ? isDark
                            ? 'rgba(22,163,74,0.15)'
                            : '#dcfce7'
                          : isDark
                            ? 'rgba(255,255,255,0.05)'
                            : 'rgba(0,0,0,0.04)',
                      }}
                    >
                      {done ? (
                        <Check size={11} style={{ color: isDark ? '#4ade80' : '#16a34a' }} strokeWidth={2.5} />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: palette.textTertiary }} />
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: F.min,
                        fontWeight: done ? 500 : 400,
                        color: done ? palette.text : palette.textSecondary,
                        textDecoration: done ? 'none' : 'none',
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mx-4" style={{ height: 0.5, backgroundColor: palette.border }} />

          {/* Recent activity */}
          <div className="px-4 py-3 flex-1">
            <p
              className="uppercase tracking-wider mb-3"
              style={{ fontSize: 11, fontWeight: 600, color: palette.textTertiary }}
            >
              Recent Activity
            </p>
            <div className="flex flex-col gap-2.5">
              <ActivityItem icon={Clock} text="Last login" detail="31 Mar 2026, 21:22" palette={palette} />
              <ActivityItem icon={UserCheck} text="Profile updated" detail="28 Mar 2026" palette={palette} />
              <ActivityItem icon={KeyRound} text="Password changed" detail="15 Mar 2026" palette={palette} />
              <ActivityItem
                icon={ShieldCheck}
                text="2FA disabled"
                detail="10 Feb 2026"
                palette={palette}
                color="#b45309"
              />
            </div>
          </div>

          <div className="mx-4" style={{ height: 0.5, backgroundColor: palette.border }} />

          {/* Quick actions */}
          <div className="px-4 py-3">
            <button
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl cursor-pointer transition-colors"
              style={{
                fontSize: F.min,
                fontWeight: 600,
                color: palette.text,
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                border: `1px solid ${palette.border}`,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = palette.backgroundHover)}
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)')
              }
            >
              <Download size={14} style={{ color: palette.textSecondary }} strokeWidth={2} />
              Export Data
            </button>
          </div>
        </aside>

        {/* ── Right Panel ── */}
        <section className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4">
            {/* Personal Information */}
            <GlassCard title="Personal Information" icon={Users} palette={palette} isDark={isDark} glass={glass}>
              <div className="grid grid-cols-2 gap-x-8">
                <EditableField
                  label="First Name"
                  fieldKey="firstName"
                  value={current.firstName}
                  editing={editing}
                  palette={palette}
                  glass={glass}
                  isDark={isDark}
                  onChange={updateField}
                />
                <EditableField
                  label="Last Name"
                  fieldKey="lastName"
                  value={current.lastName}
                  editing={editing}
                  palette={palette}
                  glass={glass}
                  isDark={isDark}
                  onChange={updateField}
                />
                <EditableField
                  label="Date of Birth"
                  fieldKey="dateOfBirth"
                  value={current.dateOfBirth}
                  editing={editing}
                  palette={palette}
                  glass={glass}
                  isDark={isDark}
                  onChange={updateField}
                  type="date"
                  displayValue={formatDate(current.dateOfBirth)}
                />
                <EditableField
                  label="Gender"
                  fieldKey="gender"
                  value={current.gender}
                  editing={editing}
                  palette={palette}
                  glass={glass}
                  isDark={isDark}
                  onChange={updateField}
                  type="select"
                  options={GENDER_OPTIONS}
                />
                <EditableField
                  label="Department"
                  fieldKey="department"
                  value={current.department}
                  editing={editing}
                  palette={palette}
                  glass={glass}
                  isDark={isDark}
                  onChange={updateField}
                  type="select"
                  options={DEPARTMENT_OPTIONS}
                />
                <EditableField
                  label="Employee ID"
                  fieldKey="employeeId"
                  value={current.employeeId}
                  editing={editing}
                  palette={palette}
                  glass={glass}
                  isDark={isDark}
                  onChange={updateField}
                />
              </div>
            </GlassCard>

            {/* Contact Information */}
            <GlassCard title="Contact Information" icon={Mail} palette={palette} isDark={isDark} glass={glass}>
              <div className="grid grid-cols-2 gap-x-8">
                <EditableField
                  label="Email Address"
                  fieldKey="email"
                  value={current.email}
                  editing={editing}
                  palette={palette}
                  glass={glass}
                  isDark={isDark}
                  onChange={updateField}
                  type="email"
                />
                <EditableField
                  label="Mobile Phone"
                  fieldKey="phone"
                  value={current.phone}
                  editing={editing}
                  palette={palette}
                  glass={glass}
                  isDark={isDark}
                  onChange={updateField}
                  type="tel"
                />
                <EditableField
                  label="Office Phone"
                  fieldKey="officePhone"
                  value={current.officePhone}
                  editing={editing}
                  palette={palette}
                  glass={glass}
                  isDark={isDark}
                  onChange={updateField}
                  type="tel"
                />
              </div>
            </GlassCard>

            {/* System & Preferences */}
            <GlassCard title="System & Preferences" icon={Globe} palette={palette} isDark={isDark} glass={glass}>
              <div className="grid grid-cols-2 gap-x-8">
                <EditableField
                  label="System Role"
                  fieldKey="role"
                  value={current.role}
                  displayValue={current.role.charAt(0).toUpperCase() + current.role.slice(1)}
                  editing={editing}
                  palette={palette}
                  glass={glass}
                  isDark={isDark}
                  onChange={updateField}
                  type="select"
                  options={ROLE_OPTIONS}
                />
                <EditableField
                  label="Last Login"
                  fieldKey="lastLogin"
                  value={current.lastLogin}
                  editing={false}
                  palette={palette}
                  glass={glass}
                  isDark={isDark}
                  onChange={updateField}
                  displayValue={formatDateTime(current.lastLogin)}
                />
              </div>
            </GlassCard>
          </div>

          <div className="h-8" />
        </section>
      </div>
    </div>
  )
}

// ── Helpers ──

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) +
    ' ' +
    d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })
  )
}

// ── Sub-components ──

function ProfileRing({
  percent,
  accent,
  isDark,
  avatarUrl,
  initials,
  onCameraClick,
}: {
  percent: number
  accent: string
  isDark: boolean
  avatarUrl: string | null
  initials: string
  onCameraClick: () => void
}) {
  const size = 120
  const stroke = 4
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference
  const trackColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* SVG ring */}
      <svg width={size} height={size} className="absolute top-0 left-0" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accent}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      {/* Avatar centered inside ring */}
      <div
        className="absolute flex items-center justify-center"
        style={{ top: stroke + 4, left: stroke + 4, right: stroke + 4, bottom: stroke + 4 }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
        ) : (
          <div
            className="w-full h-full rounded-full flex items-center justify-center"
            style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}
          >
            <span style={{ fontSize: 32, fontWeight: 700, color: accent }}>{initials}</span>
          </div>
        )}
      </div>
      {/* Camera button */}
      <button
        onClick={onCameraClick}
        className="absolute flex items-center justify-center cursor-pointer"
        style={{
          bottom: 2,
          right: 2,
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: accent,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        <Camera size={13} color="#fff" strokeWidth={2} />
      </button>
    </div>
  )
}

function ActivityItem({
  icon: Icon,
  text,
  detail,
  palette,
  color,
}: {
  icon: typeof Mail
  text: string
  detail: string
  palette: PaletteType
  color?: string
}) {
  const { fonts: F } = useDisplay()
  return (
    <div className="flex items-start gap-2.5">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: accentTint(color ?? palette.textTertiary, 0.1) }}
      >
        <Icon size={12} style={{ color: color ?? palette.textTertiary }} strokeWidth={2} />
      </div>
      <div>
        <p style={{ fontSize: F.min, fontWeight: 500, color: palette.text }}>{text}</p>
        <p style={{ fontSize: 12, color: palette.textTertiary }}>{detail}</p>
      </div>
    </div>
  )
}

function GlassCard({
  title,
  icon: Icon,
  palette,
  isDark,
  glass,
  children,
}: {
  title: string
  icon: typeof Mail
  palette: PaletteType
  isDark: boolean
  glass: typeof GLASS.light
  children: React.ReactNode
}) {
  const { fonts: F } = useDisplay()
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
      <div className="flex items-center gap-2.5 px-5 py-3" style={{ borderBottom: `1px solid ${palette.border}` }}>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: accentTint(ACCENT, isDark ? 0.15 : 0.08) }}
        >
          <Icon size={14} style={{ color: ACCENT }} strokeWidth={1.8} />
        </div>
        <h3 className="font-bold" style={{ fontSize: F.lg, color: palette.text, letterSpacing: -0.2 }}>
          {title}
        </h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
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
  type = 'text',
  options,
}: {
  label: string
  fieldKey: keyof ProfileData
  value: string
  displayValue?: string
  editing: boolean
  palette: PaletteType
  glass: typeof GLASS.light
  isDark: boolean
  onChange: (key: keyof ProfileData, value: string) => void
  type?: 'text' | 'email' | 'tel' | 'date' | 'select'
  options?: string[]
}) {
  const { fonts: F } = useDisplay()
  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontSize: F.md,
    fontWeight: 500,
    color: palette.text,
    backgroundColor: glass.input,
    border: `1px solid ${glass.inputBorder}`,
    borderRadius: 10,
    padding: '8px 12px',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  if (!editing) {
    return (
      <div className="py-2.5" style={{ borderBottom: `0.5px solid ${palette.border}` }}>
        <p style={{ fontSize: F.min, color: palette.textTertiary, marginBottom: 4 }}>{label}</p>
        <p className="font-medium" style={{ fontSize: F.md, color: palette.text }}>
          {displayValue ?? value}
        </p>
      </div>
    )
  }

  if (type === 'select' && options) {
    return (
      <div className="py-2.5" style={{ borderBottom: `0.5px solid ${palette.border}` }}>
        <label className="block" style={{ fontSize: F.min, color: palette.textTertiary, marginBottom: 6 }}>
          {label}
        </label>
        <select
          value={value}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          style={{
            ...inputStyle,
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${isDark ? '%23888' : '%23999'}' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            paddingRight: 32,
            cursor: 'pointer',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = ACCENT
            e.currentTarget.style.boxShadow = `0 0 0 3px ${glass.inputFocus}`
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = glass.inputBorder
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (type === 'date') {
    return (
      <div className="py-2.5" style={{ borderBottom: `0.5px solid ${palette.border}` }}>
        <label className="block" style={{ fontSize: F.min, color: palette.textTertiary, marginBottom: 6 }}>
          {label}
        </label>
        <DatePicker value={value} onChange={(v) => onChange(fieldKey, v)} />
      </div>
    )
  }

  return (
    <div className="py-2.5" style={{ borderBottom: `0.5px solid ${palette.border}` }}>
      <label className="block" style={{ fontSize: F.min, color: palette.textTertiary, marginBottom: 6 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        style={inputStyle}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = ACCENT
          e.currentTarget.style.boxShadow = `0 0 0 3px ${glass.inputFocus}`
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = glass.inputBorder
          e.currentTarget.style.boxShadow = 'none'
        }}
      />
    </div>
  )
}
