import React, { useState, useCallback } from 'react'
import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  ArrowLeft,
  Lock,
  ShieldCheck,
  ScanFace,
  Smartphone,
  Monitor,
  Globe,
  Eye,
  EyeOff,
  Clock,
  KeyRound,
  LogOut,
  AlertTriangle,
  Check,
  type LucideIcon,
} from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { api } from '@skyhub/api'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useUser } from '../../../providers/UserProvider'
import { tokenStorage } from '../../../src/lib/token-storage'
import { biometricLabel, checkBiometricAvailable, promptBiometric } from '../../../src/lib/biometric-gate'
import type { AuthenticationType } from 'expo-local-authentication'

const ACCENT = '#1e40af'

const MOCK_SESSIONS = [
  {
    device: 'MacBook Pro',
    browser: 'Chrome 124',
    location: 'Ho Chi Minh City',
    time: 'Active now',
    icon: Monitor,
    current: true,
  },
  {
    device: 'iPhone 15',
    browser: 'Safari',
    location: 'Ho Chi Minh City',
    time: '2 hours ago',
    icon: Smartphone,
    current: false,
  },
  { device: 'Windows PC', browser: 'Edge 123', location: 'Hanoi', time: '3 days ago', icon: Monitor, current: false },
]

const MOCK_ACTIVITY = [
  { text: 'Password changed', detail: '15 Mar 2026', icon: KeyRound },
  { text: 'New login from iPhone 15', detail: '31 Mar 2026, 19:40', icon: Smartphone },
  { text: '2FA disabled', detail: '10 Feb 2026', icon: AlertTriangle, color: '#b45309' },
  { text: 'New login from MacBook Pro', detail: '31 Mar 2026, 08:15', icon: Monitor },
]

export default function SecurityScreen() {
  const router = useRouter()
  const { isDark, palette, isTablet, fonts } = useAppTheme()
  const { user, refetch } = useUser()

  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [twoFactor, setTwoFactor] = useState(false)
  const [biometric, setBiometric] = useState(() => tokenStorage.isBiometricEnabled())
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricReason, setBiometricReason] = useState<'hardware' | 'enrollment' | null>(null)
  const [biometricName, setBiometricName] = useState('Biometrics')

  // Sync 2FA from API (biometric is local-first; see below)
  React.useEffect(() => {
    if (user) {
      setTwoFactor(user.security.twoFactorEnabled)
    }
  }, [user])

  // Device capability check — runs once on mount.
  React.useEffect(() => {
    let cancelled = false
    checkBiometricAvailable().then((cap) => {
      if (cancelled) return
      if (cap.available) {
        setBiometricAvailable(true)
        setBiometricReason(null)
        setBiometricName(biometricLabel(cap.types as AuthenticationType[]))
      } else {
        setBiometricAvailable(false)
        setBiometricReason(cap.reason)
        // If the device loses biometric support, clear the local flag so
        // the next boot doesn't block behind a prompt that can never succeed.
        if (tokenStorage.isBiometricEnabled()) {
          tokenStorage.setBiometricEnabled(false)
          setBiometric(false)
        }
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const toggleBiometric = useCallback(async () => {
    const next = !biometric
    if (next) {
      if (!biometricAvailable) {
        Alert.alert(
          `${biometricName} unavailable`,
          biometricReason === 'hardware'
            ? 'This device does not support biometric authentication.'
            : 'Enroll a face or fingerprint in your device settings first, then try again.',
        )
        return
      }
      const ok = await promptBiometric(`Enable ${biometricName} for SkyHub`)
      if (!ok) return // user cancelled — no state change
      tokenStorage.setBiometricEnabled(true)
      setBiometric(true)
      try {
        await api.updateSecurity({ biometricEnabled: true })
      } catch {
        // best effort — local flag is the source of truth for the boot gate
      }
    } else {
      tokenStorage.setBiometricEnabled(false)
      setBiometric(false)
      try {
        await api.updateSecurity({ biometricEnabled: false })
      } catch {
        // same
      }
    }
    refetch()
  }, [biometric, biometricAvailable, biometricReason, biometricName, refetch])
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')

  const passwordMatch = newPw.length > 0 && newPw === confirmPw
  const canSubmit = currentPw.length > 0 && newPw.length >= 8 && passwordMatch

  const handleSubmit = useCallback(() => {
    Alert.alert('Password Updated', 'Your password has been changed successfully.')
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
  }, [])

  const formSection = (
    <>
      <SectionCard
        title="Change Password"
        icon={Lock}
        iconColor="#dc2626"
        palette={palette}
        isDark={isDark}
        fonts={fonts}
      >
        <PasswordField
          label="Current Password"
          value={currentPw}
          onChange={setCurrentPw}
          show={showCurrent}
          onToggleShow={() => setShowCurrent(!showCurrent)}
          palette={palette}
          isDark={isDark}
          fonts={fonts}
        />
        <PasswordField
          label="New Password"
          value={newPw}
          onChange={setNewPw}
          show={showNew}
          onToggleShow={() => setShowNew(!showNew)}
          palette={palette}
          isDark={isDark}
          fonts={fonts}
          hint={newPw.length > 0 && newPw.length < 8 ? 'Minimum 8 characters' : undefined}
        />
        <PasswordField
          label="Confirm Password"
          value={confirmPw}
          onChange={setConfirmPw}
          show={showConfirm}
          onToggleShow={() => setShowConfirm(!showConfirm)}
          palette={palette}
          isDark={isDark}
          fonts={fonts}
          error={confirmPw.length > 0 && !passwordMatch ? 'Passwords do not match' : undefined}
          success={passwordMatch ? 'Passwords match' : undefined}
        />
        <Pressable
          onPress={canSubmit ? handleSubmit : undefined}
          className="w-full flex-row items-center justify-center rounded-xl mt-2 active:opacity-80"
          style={{
            paddingVertical: 12,
            backgroundColor: canSubmit ? ACCENT : palette.textTertiary,
            opacity: canSubmit ? 1 : 0.5,
          }}
        >
          <Lock size={fonts.sm} color="#fff" strokeWidth={2} />
          <Text style={{ fontSize: fonts.sm, fontWeight: '600', color: '#fff', marginLeft: 6 }}>Update Password</Text>
        </Pressable>
      </SectionCard>

      <AuthToggleCard
        icon={ShieldCheck}
        title={twoFactor ? '2FA Enabled' : '2FA Disabled'}
        subtitle={twoFactor ? 'Your account is protected' : 'Add an extra layer of security'}
        on={twoFactor}
        onToggle={async () => {
          const next = !twoFactor
          setTwoFactor(next)
          await api.updateSecurity({ twoFactorEnabled: next })
          refetch()
        }}
        color={twoFactor ? (isDark ? '#4ade80' : '#16a34a') : isDark ? '#fbbf24' : '#b45309'}
        palette={palette}
        isDark={isDark}
        fonts={fonts}
      />

      <AuthToggleCard
        icon={ScanFace}
        title={biometric ? `${biometricName} Enabled` : `${biometricName} Disabled`}
        subtitle={
          !biometricAvailable
            ? biometricReason === 'hardware'
              ? 'Not supported on this device'
              : 'Enroll a face or fingerprint in your device settings'
            : biometric
              ? `Use ${biometricName} on next sign-in`
              : `Sign in faster with ${biometricName}`
        }
        on={biometric}
        onToggle={toggleBiometric}
        disabled={!biometricAvailable}
        color={biometric ? ACCENT : palette.textSecondary}
        palette={palette}
        isDark={isDark}
        fonts={fonts}
      />
    </>
  )

  const sessionsSection = (
    <>
      <SectionCard
        title="Active Sessions"
        icon={Globe}
        iconColor={ACCENT}
        palette={palette}
        isDark={isDark}
        fonts={fonts}
      >
        {MOCK_SESSIONS.map((session, i) => {
          const SIcon = session.icon
          return (
            <React.Fragment key={i}>
              <View className="flex-row items-center" style={{ paddingVertical: 12 }}>
                <View
                  className="items-center justify-center rounded-xl mr-3"
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor: accentTint(session.current ? ACCENT : palette.textTertiary, isDark ? 0.12 : 0.06),
                  }}
                >
                  <SIcon size={18} color={session.current ? ACCENT : palette.textSecondary} strokeWidth={1.8} />
                </View>
                <View className="flex-1 mr-2">
                  <View className="flex-row items-center" style={{ gap: 6 }}>
                    <Text style={{ fontSize: fonts.sm, fontWeight: '500', color: palette.text }}>{session.device}</Text>
                    {session.current && (
                      <View
                        className="px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7' }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#4ade80' : '#16a34a' }}>
                          This device
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: fonts.xs, color: palette.textSecondary, marginTop: 2 }}>
                    {session.browser} · {session.location}
                  </Text>
                </View>
                <View className="items-end" style={{ gap: 4 }}>
                  <Text style={{ fontSize: fonts.xs, color: palette.textTertiary }}>{session.time}</Text>
                  {!session.current && (
                    <Pressable
                      className="flex-row items-center rounded-lg px-2.5 py-1 active:opacity-70"
                      style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.1)' : 'rgba(220,38,38,0.06)' }}
                    >
                      <LogOut size={12} color="#dc2626" strokeWidth={2} />
                      <Text style={{ fontSize: fonts.xs, fontWeight: '600', color: '#dc2626', marginLeft: 4 }}>
                        Revoke
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
              {i < MOCK_SESSIONS.length - 1 && (
                <View style={{ height: 0.5, backgroundColor: palette.border, marginLeft: 52 }} />
              )}
            </React.Fragment>
          )
        })}
      </SectionCard>

      <SectionCard
        title="Security Activity"
        icon={Clock}
        iconColor={ACCENT}
        palette={palette}
        isDark={isDark}
        fonts={fonts}
      >
        <View style={{ gap: 14 }}>
          {MOCK_ACTIVITY.map((item, i) => {
            const AIcon = item.icon
            const col = item.color ?? palette.textTertiary
            return (
              <View key={i} className="flex-row items-start" style={{ gap: 10 }}>
                <View
                  className="items-center justify-center rounded-full mt-0.5"
                  style={{ width: 32, height: 32, backgroundColor: accentTint(col, isDark ? 0.12 : 0.06) }}
                >
                  <AIcon size={14} color={col} strokeWidth={2} />
                </View>
                <View>
                  <Text style={{ fontSize: fonts.sm, fontWeight: '500', color: palette.text }}>{item.text}</Text>
                  <Text style={{ fontSize: fonts.xs, color: palette.textTertiary, marginTop: 1 }}>{item.detail}</Text>
                </View>
              </View>
            )
          })}
        </View>
      </SectionCard>
    </>
  )

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center gap-1.5 px-3.5 py-2 rounded-xl active:opacity-70"
          style={{
            backgroundColor: accentTint(ACCENT, isDark ? 0.1 : 0.06),
            borderWidth: 1,
            borderColor: accentTint(ACCENT, 0.12),
          }}
        >
          <ArrowLeft size={15} color={palette.text} strokeWidth={2} />
          <Text style={{ fontSize: fonts.xs, fontWeight: '600', color: palette.text }}>Settings</Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {isTablet ? (
          <View className="flex-row px-4" style={{ gap: 16 }}>
            <View style={{ width: 320 }}>{formSection}</View>
            <View className="flex-1">{sessionsSection}</View>
          </View>
        ) : (
          <View className="px-4">
            {formSection}
            {sessionsSection}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Sub-components ──

function SectionCard({
  title,
  icon: Icon,
  iconColor,
  palette,
  isDark,
  fonts,
  children,
}: {
  title: string
  icon: LucideIcon
  iconColor: string
  palette: Palette
  isDark: boolean
  fonts: any
  children: React.ReactNode
}) {
  return (
    <View
      className="rounded-2xl border mb-4 overflow-hidden"
      style={{ backgroundColor: palette.card, borderColor: palette.cardBorder }}
    >
      <View
        className="flex-row items-center"
        style={{
          gap: 10,
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
        }}
      >
        <View
          className="rounded-lg items-center justify-center"
          style={{ width: 32, height: 32, backgroundColor: accentTint(iconColor, isDark ? 0.15 : 0.08) }}
        >
          <Icon size={16} color={iconColor} strokeWidth={1.8} />
        </View>
        <Text style={{ fontSize: fonts.lg, fontWeight: '700', color: palette.text }}>{title}</Text>
      </View>
      <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>{children}</View>
    </View>
  )
}

function AuthToggleCard({
  icon: Icon,
  title,
  subtitle,
  on,
  onToggle,
  color,
  palette,
  isDark,
  fonts,
  disabled = false,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
  on: boolean
  onToggle: () => void
  color: string
  palette: Palette
  isDark: boolean
  fonts: any
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onToggle}
      className="flex-row items-center rounded-2xl border mb-4 active:opacity-80"
      style={{
        padding: 16,
        backgroundColor: on ? accentTint(color, isDark ? 0.1 : 0.05) : palette.card,
        borderColor: on ? accentTint(color, 0.2) : palette.cardBorder,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Icon size={22} color={color} strokeWidth={1.8} />
      <View className="flex-1 mx-3">
        <Text style={{ fontSize: fonts.sm, fontWeight: '600', color: palette.text }}>{title}</Text>
        <Text style={{ fontSize: fonts.xs, color: palette.textSecondary, marginTop: 2 }}>{subtitle}</Text>
      </View>
      <View
        className="rounded-full"
        style={{
          width: 44,
          height: 24,
          backgroundColor: on ? color : isDark ? '#444' : '#ddd',
          justifyContent: 'center',
        }}
      >
        <View className="rounded-full bg-white" style={{ width: 20, height: 20, marginLeft: on ? 22 : 2 }} />
      </View>
    </Pressable>
  )
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  palette,
  isDark,
  fonts,
  hint,
  error,
  success,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggleShow: () => void
  palette: Palette
  isDark: boolean
  fonts: any
  hint?: string
  error?: string
  success?: string
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: fonts.xs, color: palette.textTertiary, marginBottom: 6 }}>{label}</Text>
      <View
        className="flex-row items-center rounded-xl"
        style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          borderWidth: 1,
          borderColor: error ? '#dc2626' : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
          paddingHorizontal: 14,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show}
          className="flex-1"
          style={{ fontSize: fonts.sm, color: palette.text, paddingVertical: 12 }}
          placeholderTextColor={palette.textTertiary}
        />
        <Pressable onPress={onToggleShow} className="pl-2">
          {show ? (
            <EyeOff size={18} color={palette.textTertiary} strokeWidth={1.8} />
          ) : (
            <Eye size={18} color={palette.textTertiary} strokeWidth={1.8} />
          )}
        </Pressable>
      </View>
      {hint && <Text style={{ fontSize: 12, color: '#b45309', marginTop: 4 }}>{hint}</Text>}
      {error && <Text style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{error}</Text>}
      {success && (
        <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
          <Check size={12} color={isDark ? '#4ade80' : '#16a34a'} strokeWidth={2.5} />
          <Text style={{ fontSize: 12, color: isDark ? '#4ade80' : '#16a34a' }}>{success}</Text>
        </View>
      )}
    </View>
  )
}
