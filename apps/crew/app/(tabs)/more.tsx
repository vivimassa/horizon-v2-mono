import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  Award,
  Bell,
  Book,
  ChevronRight,
  FileText,
  Globe,
  LifeBuoy,
  LogOut,
  Moon,
  Palette,
  RefreshCw,
  Shield,
  Smartphone,
  Sun,
  Trash2,
  Wallet,
} from 'lucide-react-native'
import { Chip, Glass } from '../../src/components/primitives'
import { useTheme } from '../../src/theme/use-theme'
import type { Theme } from '../../src/theme/tokens'
import { TYPE } from '../../src/theme/tokens'
import { useCrewAuthStore } from '../../src/stores/use-crew-auth-store'
import { useCrewOperatorStore } from '../../src/stores/use-crew-operator-store'
import { useThemeStore, type ThemeMode } from '../../src/stores/use-theme-store'
import { useDatabase } from '../../src/providers/DatabaseProvider'
import { secureTokenStorage } from '../../src/lib/secure-token-storage'
import { crewApi } from '../../src/lib/api-client'
import { unregisterPush } from '../../src/lib/push-register'
import { initials } from '../../src/data/format'
import { useFullProfile } from '../../src/data/use-full-profile'
import { resetAndResync, syncCrewData } from '../../src/sync/sync-trigger'
import { useSyncStore } from '../../src/stores/use-sync-store'

export default function MoreTab() {
  const t = useTheme()
  const router = useRouter()
  const profile = useCrewAuthStore((s) => s.profile)
  const operator = useCrewOperatorStore((s) => s.selectedOperator)
  const pushToken = useCrewAuthStore((s) => s.expoPushToken)
  const database = useDatabase()
  const themeMode = useThemeStore((s) => s.mode)
  const setThemeMode = useThemeStore((s) => s.setMode)

  const [biometric, setBiometric] = useState(secureTokenStorage.isBiometricEnabled())
  const [pushOn, setPushOn] = useState(true)
  const fullProfileQ = useFullProfile()
  const fp = fullProfileQ.data
  const ratings = fp?._ratings ?? []
  const expiringSoonCount = (fp?.expiries ?? []).filter(
    (e) => e.daysUntil != null && e.daysUntil >= 0 && e.daysUntil <= 30,
  ).length
  const expiredCount = (fp?.expiries ?? []).filter((e) => e.isExpired).length
  const syncStatus = useSyncStore()

  const onSyncNow = () => {
    void syncCrewData(database, true)
  }
  const onResetLocal = () => {
    Alert.alert(
      'Reset local data?',
      'Wipes the offline cache on this device and pulls a fresh copy from the server. You stay signed in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            void resetAndResync(database)
          },
        },
      ],
    )
  }

  const toggleBiometric = (v: boolean) => {
    secureTokenStorage.setBiometricEnabled(v)
    setBiometric(v)
  }

  const logout = async () => {
    if (pushToken) {
      try {
        await crewApi.logout(pushToken)
        await unregisterPush(pushToken)
      } catch {
        // network failure shouldn't block local logout
      }
    }
    await database.write(async () => {
      await database.unsafeResetDatabase()
    })
    secureTokenStorage.clearSession()
    useCrewAuthStore.getState().logout()
    router.replace('/login/eid-pin')
  }

  const init = initials(profile?.firstName, profile?.lastName)
  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'Crew Member'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ ...TYPE.pageTitle, color: t.text }}>More</Text>

        {/* Profile hero */}
        <Glass tier="hero" padding={16} onPress={() => router.push('/profile/contact')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 56,
                backgroundColor: t.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 20, letterSpacing: 0.5 }}>{init}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: t.text, fontWeight: '700', fontSize: 16, letterSpacing: -0.3 }} numberOfLines={1}>
                {fullName}
              </Text>
              <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 3 }} numberOfLines={1}>
                {profile?.position ?? '—'} · {profile?.employeeId} · {profile?.base ?? operator?.code ?? 'BASE'} base
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                <Chip t={t} kind="ontime">
                  Active
                </Chip>
                {ratings.map((r) => (
                  <Chip key={r} t={t} kind="departed">
                    {r}
                  </Chip>
                ))}
              </View>
            </View>
            <ChevronRight color={t.textTer} size={18} />
          </View>
        </Glass>

        {/* Account */}
        <Eyebrow t={t}>ACCOUNT</Eyebrow>
        <Glass tier="standard" padding={0}>
          <NavRow
            t={t}
            icon={<Award color={t.accent} size={18} />}
            title="Licenses & Certificates"
            sub={ratings.length > 0 ? ratings.join(' · ') : 'ATPL · ratings'}
            badge={
              expiredCount > 0
                ? { text: `${expiredCount} expired`, kind: 'cancelled' }
                : expiringSoonCount > 0
                  ? { text: `${expiringSoonCount} expiring 30d`, kind: 'delayed' }
                  : undefined
            }
            onPress={() => router.push('/documents/licenses')}
          />
          <Divider t={t} />
          <NavRow
            t={t}
            icon={<Book color={t.accent} size={18} />}
            title="Training records"
            sub="Recurrent due 14 Jun"
          />
          <Divider t={t} />
          <NavRow t={t} icon={<Wallet color={t.accent} size={18} />} title="Pay Slips" sub="April available" last />
        </Glass>

        {/* App */}
        <Eyebrow t={t}>APP</Eyebrow>
        <Glass tier="standard" padding={0}>
          <ToggleRow
            t={t}
            icon={<Bell color={pushOn ? t.accent : t.textSec} size={18} />}
            title="Notifications"
            sub="Schedule changes · Roster"
            on={pushOn}
            setOn={setPushOn}
          />
          <Divider t={t} />
          <ToggleRow
            t={t}
            icon={<Smartphone color={biometric ? t.accent : t.textSec} size={18} />}
            title="Biometric Unlock"
            sub="Face ID / fingerprint on app open"
            on={biometric}
            setOn={toggleBiometric}
          />
          <Divider t={t} />
          <View
            style={{ paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: t.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Palette color={t.accent} size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: '500', fontSize: 14 }}>Appearance</Text>
              <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 2 }}>{themeLabel(themeMode)}</Text>
            </View>
            <ThemeSegmented t={t} mode={themeMode} setMode={setThemeMode} />
          </View>
          <Divider t={t} />
          <NavRow t={t} icon={<Globe color={t.accent} size={18} />} title="Language" sub="English (US)" />
          <Divider t={t} />
          <NavRow
            t={t}
            icon={<RefreshCw color={t.accent} size={18} />}
            title="Offline Data"
            sub={
              syncStatus.lastError
                ? `Last error: ${syncStatus.lastError}`
                : syncStatus.counts
                  ? `${syncStatus.counts.assignments} duties · ${syncStatus.counts.pairings} pairings · ${syncStatus.counts.legs} legs${syncStatus.lastSyncMs ? ` · ${fmtSince(syncStatus.lastSyncMs)}` : ''}`
                  : syncStatus.lastSyncMs
                    ? `Last sync ${fmtSince(syncStatus.lastSyncMs)}`
                    : 'Not synced yet'
            }
            right={
              syncStatus.inFlight ? (
                <ActivityIndicator color={t.accent} size="small" />
              ) : (
                <Pressable onPress={onSyncNow}>
                  <Text style={{ ...TYPE.badge, color: t.accent, fontSize: 12 }}>Sync Now</Text>
                </Pressable>
              )
            }
            chevron={false}
            last
          />
        </Glass>

        {/* Support */}
        <Eyebrow t={t}>SUPPORT</Eyebrow>
        <Glass tier="standard" padding={0}>
          <NavRow t={t} icon={<LifeBuoy color={t.accent} size={18} />} title="Help & FAQ" />
          <Divider t={t} />
          <NavRow t={t} icon={<Shield color={t.accent} size={18} />} title="Privacy & terms" />
          <Divider t={t} />
          <NavRow
            t={t}
            icon={<FileText color={t.accent} size={18} />}
            title="Safety Reports (FRM)"
            sub="Submit a report"
            last
          />
        </Glass>

        {/* Recovery */}
        <Glass tier="soft" padding={14} onPress={onResetLocal}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                backgroundColor: t.status.delayed.bg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Trash2 color={t.status.delayed.fg} size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }}>Reset local data</Text>
              <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 2 }}>
                Wipe offline cache and pull fresh from server. Stays signed in.
              </Text>
            </View>
            <ChevronRight color={t.textTer} size={14} />
          </View>
        </Glass>

        {/* Sign out — outlined glass-soft, not red fill (per design / iOS 18 convention) */}
        <Pressable onPress={logout}>
          <Glass tier="soft" padding={0} style={{ borderColor: t.status.cancelled.fg + '55' }}>
            <View
              style={{
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <LogOut color={t.status.cancelled.fg} size={16} />
              <Text style={{ color: t.status.cancelled.fg, fontWeight: '600', fontSize: 14 }}>Sign out</Text>
            </View>
          </Glass>
        </Pressable>

        <Text style={{ textAlign: 'center', color: t.textTer, fontSize: 12, marginTop: 4 }}>
          SkyHub Aviation · v0.2.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function themeLabel(mode: ThemeMode): string {
  if (mode === 'dark') return 'Dark'
  if (mode === 'light') return 'Light'
  return 'System'
}

function ThemeSegmented({ t, mode, setMode }: { t: Theme; mode: ThemeMode; setMode: (m: ThemeMode) => void }) {
  const items: { k: ThemeMode; l: string; icon: React.ReactNode }[] = [
    { k: 'light', l: 'Light', icon: <Sun color={mode === 'light' ? t.text : t.textSec} size={11} /> },
    { k: 'dark', l: 'Dark', icon: <Moon color={mode === 'dark' ? t.text : t.textSec} size={11} /> },
    { k: 'system', l: 'Auto', icon: null },
  ]
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.hover, padding: 2, borderRadius: 8, gap: 4 }}>
      {items.map((o) => {
        const active = mode === o.k
        return (
          <Pressable
            key={o.k}
            onPress={() => setMode(o.k)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 6,
              backgroundColor: active ? t.page : 'transparent',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {o.icon}
            <Text style={{ fontSize: 11, fontWeight: '600', color: active ? t.text : t.textSec }}>{o.l}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function Eyebrow({ t, children }: { t: Theme; children: React.ReactNode }) {
  return (
    <Text
      style={{ color: t.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginTop: 6, marginBottom: -6 }}
    >
      {children}
    </Text>
  )
}

function fmtSince(ms: number): string {
  const delta = Date.now() - ms
  if (delta < 60_000) return 'just now'
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`
  return `${Math.floor(delta / 86_400_000)}d ago`
}

function ToggleRow({
  t,
  icon,
  title,
  sub,
  on,
  setOn,
}: {
  t: Theme
  icon: React.ReactNode
  title: string
  sub: string
  on: boolean
  setOn: (v: boolean) => void
}) {
  return (
    <View style={{ paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: on ? t.accentSoft : t.hover,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: t.text, fontWeight: '500', fontSize: 14 }}>{title}</Text>
        <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 2 }}>{sub}</Text>
      </View>
      <Switch value={on} onValueChange={setOn} trackColor={{ false: t.hover, true: t.accent }} thumbColor="#fff" />
    </View>
  )
}

function NavRow({
  t,
  icon,
  title,
  sub,
  badge,
  right,
  chevron = true,
  last,
  onPress,
}: {
  t: Theme
  icon: React.ReactNode
  title: string
  sub?: string
  badge?: { text: string; kind: 'delayed' | 'cancelled' | 'ontime' | 'scheduled' | 'departed' }
  right?: React.ReactNode
  chevron?: boolean
  last?: boolean
  onPress?: () => void
}) {
  const body = (
    <View
      style={{
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: t.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: t.text, fontWeight: '500', fontSize: 14 }}>{title}</Text>
        {sub && <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 2 }}>{sub}</Text>}
      </View>
      {badge && (
        <Chip t={t} kind={badge.kind}>
          {badge.text}
        </Chip>
      )}
      {right}
      {chevron && <ChevronRight color={t.textTer} size={14} />}
    </View>
  )
  if (onPress) {
    return <Pressable onPress={onPress}>{body}</Pressable>
  }
  return body
}

function Divider({ t }: { t: Theme }) {
  return <View style={{ height: 1, backgroundColor: t.border, marginLeft: 58 }} />
}
