import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  AlertTriangle,
  Award,
  Bell,
  Book,
  Calendar,
  ChevronRight,
  FileText,
  Globe,
  LogOut,
  Moon,
  RefreshCw,
  Settings as SettingsIcon,
  Share2,
  Sun,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react-native'
import { Card, Chip, FieldLabel, SectionHeader } from '../../src/components/primitives'
import { useTheme } from '../../src/theme/use-theme'
import type { Theme } from '../../src/theme/tokens'
import { TYPE } from '../../src/theme/tokens'
import { useCrewAuthStore } from '../../src/stores/use-crew-auth-store'
import { useCrewOperatorStore } from '../../src/stores/use-crew-operator-store'
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

  const [shareFamily, setShareFamily] = useState(true)
  const [shareCrew, setShareCrew] = useState(false)
  const [calSync, setCalSync] = useState(true)
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
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ ...TYPE.pageTitle, color: t.text }}>More</Text>

        {/* Profile */}
        <Card t={t} padding={16} onPress={() => router.push('/profile/contact')}>
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
              <Text style={{ color: t.text, fontWeight: '600', fontSize: 16, letterSpacing: -0.3 }} numberOfLines={1}>
                {fullName}
              </Text>
              <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 3 }} numberOfLines={1}>
                {profile?.employeeId} · {profile?.position ?? '—'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                <Tag t={t}>{(profile?.base ?? operator?.code ?? 'BASE') + ' Base'}</Tag>
                {ratings.map((r) => (
                  <Tag key={r} t={t}>
                    {r}
                  </Tag>
                ))}
              </View>
            </View>
            <ChevronRight color={t.textTer} size={18} />
          </View>
        </Card>

        {/* Sharing */}
        <View style={{ gap: 10 }}>
          <SectionHeader t={t}>Roster Sharing</SectionHeader>
          <ToggleRow
            t={t}
            icon={<Share2 color={shareFamily ? t.accent : t.textSec} size={18} />}
            title="Share with Family"
            sub="Family can view your roster via web link, no app needed"
            on={shareFamily}
            setOn={setShareFamily}
          />
          <ToggleRow
            t={t}
            icon={<Users color={shareCrew ? t.accent : t.textSec} size={18} />}
            title="Share with Crew"
            sub="Colleagues can see your roster for trip coordination"
            on={shareCrew}
            setOn={setShareCrew}
          />
          <ToggleRow
            t={t}
            icon={<Calendar color={calSync ? t.accent : t.textSec} size={18} />}
            title="Calendar Sync"
            sub={calSync ? 'Synced with device calendar · 2m ago' : 'Off'}
            on={calSync}
            setOn={setCalSync}
          />
        </View>

        {/* Documents */}
        <View style={{ gap: 10 }}>
          <SectionHeader t={t}>Documents</SectionHeader>
          <Card t={t} padding={0}>
            <NavRow
              t={t}
              icon={<Award color={t.text} size={18} />}
              title="Licenses & Certificates"
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
            <NavRow t={t} icon={<Book color={t.text} size={18} />} title="Company Manuals" sub="Coming soon" />
            <Divider t={t} />
            <NavRow t={t} icon={<FileText color={t.text} size={18} />} title="Safety Reports (FRM)" sub="Coming soon" />
            <Divider t={t} />
            <NavRow t={t} icon={<Wallet color={t.text} size={18} />} title="Pay Slips" sub="Coming soon" last />
          </Card>
        </View>

        {/* Settings */}
        <View style={{ gap: 10 }}>
          <SectionHeader t={t}>Settings</SectionHeader>
          <Card t={t} padding={0}>
            <ToggleRow
              t={t}
              flat
              icon={<Bell color={pushOn ? t.accent : t.textSec} size={18} />}
              title="Notifications"
              sub="Schedule changes · Roster"
              on={pushOn}
              setOn={setPushOn}
            />
            <Divider t={t} />
            <ToggleRow
              t={t}
              flat
              icon={<Award color={biometric ? t.accent : t.textSec} size={18} />}
              title="Biometric Unlock"
              sub="Face ID / fingerprint on app open"
              on={biometric}
              setOn={toggleBiometric}
            />
            <Divider t={t} />
            <NavRow
              t={t}
              icon={<Moon color={t.text} size={18} />}
              title="Appearance"
              sub="Dark"
              chevron={false}
              right={
                <View style={{ flexDirection: 'row', backgroundColor: t.hover, padding: 2, borderRadius: 8, gap: 4 }}>
                  {[
                    { k: false, l: 'Light', icon: Sun },
                    { k: true, l: 'Dark', icon: Moon },
                  ].map((o) => {
                    const I = o.icon
                    const active = o.k === true // forced dark Phase A
                    return (
                      <View
                        key={o.l}
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
                        <I color={active ? t.text : t.textSec} size={11} />
                        <Text style={{ fontSize: 11, fontWeight: '600', color: active ? t.text : t.textSec }}>
                          {o.l}
                        </Text>
                      </View>
                    )
                  })}
                </View>
              }
            />
            <Divider t={t} />
            <NavRow t={t} icon={<Globe color={t.text} size={18} />} title="Language" sub="English (US)" />
            <Divider t={t} />
            <NavRow
              t={t}
              icon={<RefreshCw color={t.text} size={18} />}
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
            />
            <Divider t={t} />
            <NavRow
              t={t}
              icon={<SettingsIcon color={t.text} size={18} />}
              title="About"
              sub="SkyHub Crew · v0.1.0"
              last
            />
          </Card>
        </View>

        {/* Reset local data */}
        <View style={{ gap: 10, marginTop: 8 }}>
          <SectionHeader t={t}>Recovery</SectionHeader>
          <Card t={t} padding={14} onPress={onResetLocal}>
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
          </Card>
        </View>

        {/* Sign out */}
        <Pressable
          onPress={logout}
          style={{
            marginTop: 8,
            paddingVertical: 14,
            borderRadius: 12,
            borderWidth: 0.5,
            borderColor: t.status.cancelled.fg + '55',
            backgroundColor: t.card,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <LogOut color={t.status.cancelled.fg} size={16} />
          <Text style={{ color: t.status.cancelled.fg, fontWeight: '600', fontSize: 14 }}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function fmtSince(ms: number): string {
  const delta = Date.now() - ms
  if (delta < 60_000) return 'just now'
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`
  return `${Math.floor(delta / 86_400_000)}d ago`
}

function Tag({ t, children }: { t: Theme; children: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: t.hover }}>
      <Text style={{ ...TYPE.badge, color: t.textSec }}>{children}</Text>
    </View>
  )
}

function ToggleRow({
  t,
  icon,
  title,
  sub,
  on,
  setOn,
  flat,
}: {
  t: Theme
  icon: React.ReactNode
  title: string
  sub: string
  on: boolean
  setOn: (v: boolean) => void
  flat?: boolean
}) {
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          backgroundColor: on ? t.accent + '22' : t.hover,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: t.text, fontWeight: '600', fontSize: 13 }}>{title}</Text>
        <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 2 }}>{sub}</Text>
      </View>
      <Switch value={on} onValueChange={setOn} trackColor={{ false: t.hover, true: t.accent }} thumbColor="#fff" />
    </View>
  )
  if (flat) {
    return <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>{body}</View>
  }
  return (
    <Card t={t} padding={12} onPress={() => setOn(!on)}>
      {body}
    </Card>
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
        borderBottomWidth: 0,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: t.hover,
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
  return <View style={{ height: 0.5, backgroundColor: t.border, marginLeft: 58 }} />
}
