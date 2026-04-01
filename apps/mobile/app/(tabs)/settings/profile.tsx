import React, { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, Pressable, TextInput,
  useWindowDimensions, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  ArrowLeft, Camera, Mail, Phone, MapPin,
  Hash, Briefcase, Shield, Edit3, Save, X, Check,
  Users, Globe,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { api } from '@skyhub/api'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useUser } from '../../../providers/UserProvider'

const ACCENT = '#1e40af'
const TABLET_WIDTH = 768

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
  role: string
  status: string
  lastLogin: string
  location: string
}

const INITIAL: ProfileData = {
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
  role: 'Administrator',
  status: 'Active',
  lastLogin: '2026-03-31T14:22:00Z',
  location: 'SGN — Tan Son Nhat International',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  }) + ' ' + d.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
  })
}

export default function ProfileScreen() {
  const router = useRouter()
  const { isDark, palette, isTablet, fonts, fs } = useAppTheme()
  const { user, refetch } = useUser()
  const { width } = useWindowDimensions()

  const [data, setData] = useState<ProfileData>(INITIAL)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ProfileData>(INITIAL)

  // Sync from API
  React.useEffect(() => {
    if (user) {
      const fromApi: ProfileData = {
        firstName: user.profile.firstName,
        lastName: user.profile.lastName,
        email: user.profile.email,
        jobTitle: user.role,
        department: user.profile.department,
        employeeId: user.profile.employeeId,
        phone: user.profile.phone,
        officePhone: user.profile.officePhone,
        dateOfBirth: user.profile.dateOfBirth,
        gender: user.profile.gender,
        role: user.role,
        status: user.isActive ? 'Active' : 'Inactive',
        lastLogin: user.lastLoginUtc,
        location: user.profile.location,
      }
      setData(fromApi)
      setDraft(fromApi)
    }
  }, [user])

  const startEdit = useCallback(() => {
    setDraft({ ...data })
    setEditing(true)
  }, [data])

  const cancelEdit = useCallback(() => setEditing(false), [])

  const saveEdit = useCallback(async () => {
    try {
      await api.updateProfile({
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
      Alert.alert('Saved', 'Profile updated successfully.')
      refetch()
    } catch (err) {
      Alert.alert('Error', 'Failed to save profile.')
    }
  }, [draft, refetch])

  const update = useCallback((key: keyof ProfileData, val: string) => {
    setDraft((p) => ({ ...p, [key]: val }))
  }, [])

  const current = editing ? draft : data

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl active:opacity-70"
          style={{
            backgroundColor: accentTint(ACCENT, isDark ? 0.1 : 0.06),
            borderWidth: 1,
            borderColor: accentTint(ACCENT, 0.12),
          }}
        >
          <ArrowLeft size={15} color={palette.text} strokeWidth={2} />
          <Text className="text-[13px] font-semibold" style={{ color: palette.text }}>Settings</Text>
        </Pressable>

        {editing ? (
          <View className="flex-row gap-2">
            <Pressable
              onPress={cancelEdit}
              className="flex-row items-center gap-1 px-3 py-1.5 rounded-xl active:opacity-70"
              style={{ borderWidth: 1, borderColor: palette.border }}
            >
              <X size={14} color={palette.text} strokeWidth={2} />
              <Text className="text-[12px] font-semibold" style={{ color: palette.text }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={saveEdit}
              className="flex-row items-center gap-1 px-3 py-1.5 rounded-xl active:opacity-70"
              style={{ backgroundColor: ACCENT }}
            >
              <Save size={14} color="#fff" strokeWidth={2} />
              <Text className="text-[12px] font-semibold" style={{ color: '#fff' }}>Save</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={startEdit}
            className="flex-row items-center gap-1 px-3 py-1.5 rounded-xl active:opacity-70"
            style={{ backgroundColor: ACCENT }}
          >
            <Edit3 size={14} color="#fff" strokeWidth={2} />
            <Text className="text-[12px] font-semibold" style={{ color: '#fff' }}>Edit</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-24"
        showsVerticalScrollIndicator={false}
      >
        {isTablet ? (
          <View className="flex-row px-4 gap-4">
            <View style={{ width: 320 }}>
              <AvatarPanel current={current} palette={palette} isDark={isDark} isTablet fonts={fonts} fs={fs} />
            </View>
            <View className="flex-1">
              <FieldSections current={current} editing={editing} palette={palette} isDark={isDark} update={update} isTablet fonts={fonts} fs={fs} />
            </View>
          </View>
        ) : (
          <View className="px-4">
            <AvatarPanel current={current} palette={palette} isDark={isDark} fonts={fonts} fs={fs} />
            <FieldSections current={current} editing={editing} palette={palette} isDark={isDark} update={update} fonts={fonts} fs={fs} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Avatar panel ──
function AvatarPanel({ current, palette, isDark, isTablet, fonts, fs }: { current: ProfileData; palette: Palette; isDark: boolean; isTablet?: boolean; fonts: any; fs: (n: number) => number }) {
  const t = isTablet
  return (
    <View
      className="rounded-2xl border items-center mb-4"
      style={{ backgroundColor: palette.card, borderColor: palette.cardBorder, paddingVertical: t ? 32 : 24, paddingHorizontal: t ? 20 : 16 }}
    >
      <View className="relative" style={{ marginBottom: t ? 16 : 12 }}>
        <View
          className="rounded-full items-center justify-center"
          style={{
            width: t ? 100 : 80,
            height: t ? 100 : 80,
            backgroundColor: accentTint(ACCENT, isDark ? 0.15 : 0.08),
          }}
        >
          <Text style={{ fontSize: fonts.xxl, fontWeight: '700', color: ACCENT }}>
            {current.firstName[0]}{current.lastName[0]}
          </Text>
        </View>
        <View
          className="absolute bottom-0 right-0 rounded-full items-center justify-center"
          style={{ width: t ? 32 : 28, height: t ? 32 : 28, backgroundColor: ACCENT }}
        >
          <Camera size={t ? 15 : 13} color="#fff" strokeWidth={2} />
        </View>
      </View>
      <Text style={{ fontSize: fonts.xl, fontWeight: '700', color: palette.text }}>
        {current.firstName} {current.lastName}
      </Text>
      <Text style={{ fontSize: fonts.sm, color: palette.textSecondary, marginTop: 2 }}>
        {current.role}
      </Text>
      <View className="mt-2 px-3 py-1 rounded-full" style={{ backgroundColor: '#dcfce7' }}>
        <Text style={{ fontSize: fonts.xs, fontWeight: '600', color: '#166534' }}>{current.status}</Text>
      </View>

      <View className="w-full" style={{ marginTop: t ? 20 : 16, paddingTop: t ? 20 : 16, borderTopWidth: 0.5, borderTopColor: palette.border }}>
        <QuickRow icon={Briefcase} label="Department" value={current.department} palette={palette} fonts={fonts} />
        <QuickRow icon={Shield} label="Role" value={current.role} palette={palette} fonts={fonts} />
        <QuickRow icon={Hash} label="Employee ID" value={current.employeeId} palette={palette} fonts={fonts} />
        <QuickRow icon={Mail} label="Email" value={current.email} palette={palette} fonts={fonts} />
        <QuickRow icon={Phone} label="Phone" value={current.phone} palette={palette} fonts={fonts} />
        <QuickRow icon={MapPin} label="Location" value={current.location} palette={palette} fonts={fonts} />
      </View>

      <View className="w-full" style={{ marginTop: t ? 16 : 12, paddingTop: t ? 16 : 12, borderTopWidth: 0.5, borderTopColor: palette.border }}>
        <Text style={{ fontSize: fonts.xs, color: palette.textSecondary }}>
          Last login: {formatDateTime(current.lastLogin)}
        </Text>
      </View>
    </View>
  )
}

function QuickRow({ icon: Icon, label, value, palette, fonts }: { icon: LucideIcon; label: string; value: string; palette: Palette; fonts: any }) {
  return (
    <View className="flex-row items-center" style={{ gap: 10, marginBottom: 14 }}>
      <Icon size={fonts.sm} color={palette.textTertiary} strokeWidth={1.6} />
      <View className="flex-1">
        <Text className="uppercase" style={{ fontSize: fonts.xs, color: palette.textTertiary, letterSpacing: 0.5 }}>{label}</Text>
        <Text className="font-medium" style={{ fontSize: fonts.sm, color: palette.text }} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  )
}

// ── Field sections ──
function FieldSections({
  current, editing, palette, isDark, update, isTablet, fonts, fs,
}: {
  current: ProfileData; editing: boolean; palette: Palette; isDark: boolean;
  update: (key: keyof ProfileData, val: string) => void; isTablet?: boolean; fonts: any; fs: (n: number) => number;
}) {
  const cols = isTablet ? 2 : 1

  return (
    <>
      <SectionCard title="Personal Information" icon={Users} palette={palette} isDark={isDark} isTablet={isTablet} fonts={fonts}>
        <FieldGrid cols={cols}>
          <EditField label="First Name" field="firstName" value={current.firstName} editing={editing} palette={palette} isDark={isDark} onChange={update} isTablet={isTablet} fonts={fonts} />
          <EditField label="Last Name" field="lastName" value={current.lastName} editing={editing} palette={palette} isDark={isDark} onChange={update} isTablet={isTablet} fonts={fonts} />
          <EditField label="Date of Birth" field="dateOfBirth" value={formatDate(current.dateOfBirth)} editing={editing} palette={palette} isDark={isDark} onChange={update} isTablet={isTablet} fonts={fonts} />
          <EditField label="Gender" field="gender" value={current.gender} editing={editing} palette={palette} isDark={isDark} onChange={update} isTablet={isTablet} fonts={fonts} />
          <EditField label="Department" field="department" value={current.department} editing={editing} palette={palette} isDark={isDark} onChange={update} isTablet={isTablet} fonts={fonts} />
          <EditField label="Employee ID" field="employeeId" value={current.employeeId} editing={editing} palette={palette} isDark={isDark} onChange={update} isTablet={isTablet} fonts={fonts} />
        </FieldGrid>
      </SectionCard>

      <SectionCard title="Contact Information" icon={Mail} palette={palette} isDark={isDark} isTablet={isTablet} fonts={fonts}>
        <FieldGrid cols={cols}>
          <EditField label="Email Address" field="email" value={current.email} editing={editing} palette={palette} isDark={isDark} onChange={update} isTablet={isTablet} fonts={fonts} />
          <EditField label="Mobile Phone" field="phone" value={current.phone} editing={editing} palette={palette} isDark={isDark} onChange={update} isTablet={isTablet} fonts={fonts} />
          <EditField label="Office Phone" field="officePhone" value={current.officePhone} editing={editing} palette={palette} isDark={isDark} onChange={update} isTablet={isTablet} fonts={fonts} />
        </FieldGrid>
      </SectionCard>

      <SectionCard title="System & Preferences" icon={Globe} palette={palette} isDark={isDark} isTablet={isTablet} fonts={fonts}>
        <FieldGrid cols={cols}>
          <EditField label="System Role" field="role" value={current.role} editing={editing} palette={palette} isDark={isDark} onChange={update} isTablet={isTablet} fonts={fonts} />
          <EditField label="Last Login" field="lastLogin" value={formatDateTime(current.lastLogin)} editing={false} palette={palette} isDark={isDark} onChange={update} isTablet={isTablet} fonts={fonts} />
        </FieldGrid>
      </SectionCard>
    </>
  )
}

function SectionCard({
  title, icon: Icon, palette, isDark, children, isTablet, fonts,
}: {
  title: string; icon: LucideIcon; palette: Palette; isDark: boolean; children: React.ReactNode; isTablet?: boolean; fonts: any;
}) {
  return (
    <View
      className="rounded-2xl border mb-4 overflow-hidden"
      style={{ backgroundColor: palette.card, borderColor: palette.cardBorder }}
    >
      <View
        className="flex-row items-center"
        style={{ gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.border }}
      >
        <View
          className="rounded-lg items-center justify-center"
          style={{ width: 32, height: 32, backgroundColor: accentTint(ACCENT, isDark ? 0.15 : 0.08) }}
        >
          <Icon size={fonts.md} color={ACCENT} strokeWidth={1.8} />
        </View>
        <Text style={{ fontSize: fonts.lg, fontWeight: '700', color: palette.text, letterSpacing: -0.2 }}>
          {title}
        </Text>
      </View>
      <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>{children}</View>
    </View>
  )
}

function FieldGrid({ cols, children }: { cols: number; children: React.ReactNode }) {
  if (cols === 1) return <View>{children}</View>
  // For tablet: wrap children in rows of 2
  const items = React.Children.toArray(children)
  const rows: React.ReactNode[][] = []
  for (let i = 0; i < items.length; i += cols) {
    rows.push(items.slice(i, i + cols))
  }
  return (
    <View>
      {rows.map((row, i) => (
        <View key={i} className="flex-row gap-4">
          {row.map((child, j) => (
            <View key={j} className="flex-1">{child}</View>
          ))}
          {row.length < cols && <View className="flex-1" />}
        </View>
      ))}
    </View>
  )
}

function EditField({
  label, field, value, editing, palette, isDark, onChange, isTablet, fonts,
}: {
  label: string; field: keyof ProfileData; value: string; editing: boolean;
  palette: Palette; isDark: boolean; onChange: (key: keyof ProfileData, val: string) => void; isTablet?: boolean; fonts: any;
}) {
  return (
    <View style={{ paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: palette.border }}>
      <Text style={{ fontSize: fonts.xs, color: palette.textTertiary, marginBottom: 3 }}>{label}</Text>
      {editing ? (
        <TextInput
          value={value}
          onChangeText={(v) => onChange(field, v)}
          className="font-medium rounded-lg"
          style={{
            fontSize: fonts.md,
            color: palette.text,
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
          placeholderTextColor={palette.textTertiary}
        />
      ) : (
        <Text className="font-medium" style={{ fontSize: fonts.md, color: palette.text }}>{value}</Text>
      )}
    </View>
  )
}
