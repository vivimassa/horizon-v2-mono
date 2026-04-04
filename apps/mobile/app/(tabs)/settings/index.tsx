import React, { useState, memo, useRef, useCallback } from 'react'
import {
  View, Text, Pressable, ScrollView, Image,
  useWindowDimensions, Modal, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import {
  Camera, Mail, Palette as PaletteIcon, Bell, Moon, Sun,
  UserCircle, Lock, SlidersHorizontal, Check,
  Database, ShieldCheck, ArrowLeftRight, Building2,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react-native'
import { accentTint, colors, darkAccent, type Palette } from '@skyhub/ui/theme'
import { getApiBaseUrl } from '@skyhub/api'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'
import { useUser } from '../../../providers/UserProvider'

const ACCENT_DEFAULT = '#1e40af'
const TABLET_WIDTH = 768

const ACCENT_PRESETS = [
  { name: 'Green', darkName: 'Coral', hex: '#15803d' },
  { name: 'Blue', darkName: 'Sky', hex: '#1e40af' },
  { name: 'Violet', darkName: 'Lavender', hex: '#7c3aed' },
  { name: 'Teal', darkName: 'Aqua', hex: '#0f766e' },
  { name: 'Amber', darkName: 'Honey', hex: '#b45309' },
]

export default function SettingsScreen() {
  const router = useRouter()
  const { isDark, palette, accent, rawAccent, toggleDark, setAccent } = useAppTheme()
  const { user, refetch } = useUser()
  const { width } = useWindowDimensions()

  // Computed from API user
  const userName = user ? `${user.profile.firstName} ${user.profile.lastName}` : ''
  const userInitials = user ? `${user.profile.firstName[0]}${user.profile.lastName[0]}` : ''
  const userEmail = user?.profile.email ?? ''
  const isActive = user?.isActive ?? true
  const isAdmin = user?.role === 'administrator' || user?.role === 'manager'
  const userDepartment = user?.profile.department ?? ''
  const userOffice = user?.profile.location?.split('—')[0]?.trim() ?? ''
  const unreadNotifications = 2 // hardcoded until notifications wired
  const isTablet = width >= TABLET_WIDTH

  const [dynamicBg, setDynamicBg] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [avatarUri, setAvatarUri] = useState<string | null>(null)

  // Load persisted avatar
  React.useEffect(() => {
    if (user?.profile?.avatarUrl) {
      const url = user.profile.avatarUrl
      setAvatarUri(url.startsWith('/uploads/') ? `${getApiBaseUrl()}${url}` : url)
    }
  }, [user])

  const pickAvatar = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to change your avatar.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      setAvatarUri(asset.uri)

      try {
        const uri = asset.uri
        const filename = uri.split('/').pop() || 'avatar.jpg'
        const match = /\.(\w+)$/.exec(filename)
        const type = match ? `image/${match[1]}` : 'image/jpeg'

        const formData = new FormData()
        formData.append('avatar', { uri, name: filename, type } as any)

        const res = await fetch(`${getApiBaseUrl()}/users/me/avatar?userId=skyhub-admin-001`, {
          method: 'POST',
          body: formData,
        })
        if (res.ok) refetch()
      } catch { /* silent */ }
    }
  }, [refetch])

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
    <BreadcrumbHeader moduleCode="6" />
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={[]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile Hero ── */}
        <LinearGradient
          colors={isDark
            ? ['rgba(30,64,175,0.12)', 'rgba(124,58,237,0.08)']
            : ['rgba(30,64,175,0.07)', 'rgba(124,58,237,0.05)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 18,
            padding: 20,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(30,64,175,0.08)',
            overflow: 'hidden',
          }}
        >
          <View className="flex-row items-center">
            {/* Avatar */}
            <Pressable className="relative mr-4 active:opacity-70" onPress={pickAvatar}>
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  className="w-14 h-14 rounded-2xl"
                />
              ) : (
                <View
                  className="w-14 h-14 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: accent }}
                >
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>{userInitials}</Text>
                </View>
              )}
              <View
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full items-center justify-center"
                style={{ backgroundColor: palette.card, borderWidth: 2, borderColor: isDark ? '#1a1a1a' : '#f5f5f5' }}
              >
                <Camera size={10} color={accent} strokeWidth={2.5} />
              </View>
            </Pressable>

            {/* Info */}
            <View className="flex-1">
              <Text style={{ fontSize: 19, fontWeight: '600', color: palette.text }}>{userName}</Text>
              <View className="flex-row items-center mt-0.5" style={{ gap: 4 }}>
                <Mail size={12} color={palette.textSecondary} strokeWidth={1.8} />
                <Text style={{ fontSize: 13, color: palette.textSecondary }} numberOfLines={1}>{userEmail}</Text>
              </View>
              <View className="flex-row mt-1.5" style={{ gap: 6 }}>
                {isActive && (
                  <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7' }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#4ade80' : '#166534' }}>Active</Text>
                  </View>
                )}
                {isAdmin && (
                  <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#60a5fa' : accent }}>Administrator</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Desktop stats - tablet only */}
            {isTablet && (
              <View className="flex-row items-center" style={{ gap: 20 }}>
                <View className="items-center">
                  <Text style={{ fontSize: 16, fontWeight: '700', color: accent }}>{userDepartment}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '500', color: palette.textSecondary }}>Dept</Text>
                </View>
                <View style={{ width: 1, height: 32, backgroundColor: palette.border }} />
                <View className="items-center">
                  <Text style={{ fontSize: 16, fontWeight: '700', color: accent }}>{userOffice}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '500', color: palette.textSecondary }}>Office</Text>
                </View>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* ── Quick Settings Bento ── */}
        {isTablet ? (
          /* Tablet: 3 separate tiles */
          <View className="flex-row mt-4" style={{ gap: 10 }}>
            <BentoTile palette={palette} isDark={isDark} blobColor="#7c3aed">
              <IconCircle color="#7c3aed"><PaletteIcon size={20} color="#7c3aed" strokeWidth={1.8} /></IconCircle>
              <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>Appearance</Text>
              <Text style={{ fontSize: 12, color: palette.textSecondary, marginTop: 2 }}>Aurora theme</Text>
              <View className="flex-row items-end mt-3">
                <Pressable
                  onPress={() => setPickerOpen(true)}
                  style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: accent, borderWidth: 2, borderColor: '#fff' }}
                />
              </View>
            </BentoTile>

            <BentoTile palette={palette} isDark={isDark} blobColor="#b45309">
              {unreadNotifications > 0 && (
                <View className="absolute items-center justify-center" style={{ top: 12, right: 12, backgroundColor: '#dc2626', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>{unreadNotifications}</Text>
                </View>
              )}
              <IconCircle color="#b45309"><Bell size={20} color="#b45309" strokeWidth={1.8} /></IconCircle>
              <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>Notifications</Text>
              <Text style={{ fontSize: 12, color: palette.textSecondary, marginTop: 2 }}>Push & email alerts</Text>
            </BentoTile>

            <BentoTile palette={palette} isDark={isDark} blobColor="#555">
              <IconCircle color="#555">
                {isDark ? <Moon size={20} color="#555" strokeWidth={1.8} /> : <Sun size={20} color="#555" strokeWidth={1.8} />}
              </IconCircle>
              <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>Dark Mode</Text>
              <Text style={{ fontSize: 12, color: palette.textSecondary, marginTop: 2 }}>Currently {isDark ? 'on' : 'off'}</Text>
              <View style={{ marginTop: 10 }}>
                <ToggleSwitch on={isDark} onToggle={toggleDark} accent={accent} isDark={isDark} />
              </View>
            </BentoTile>
          </View>
        ) : (
          /* Phone: 2 tiles — merged Appearance+Dark Mode | Notifications */
          <View className="flex-row mt-4" style={{ gap: 10 }}>
            {/* Appearance + Dark Mode merged */}
            <BentoTile palette={palette} isDark={isDark} blobColor="#7c3aed">
              <IconCircle color="#7c3aed"><PaletteIcon size={20} color="#7c3aed" strokeWidth={1.8} /></IconCircle>
              <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>Appearance</Text>

              {/* Accent dot + Dark mode toggle on same row */}
              <View className="flex-row items-center justify-between mt-3">
                <Pressable
                  onPress={() => setPickerOpen(true)}
                  style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: accent, borderWidth: 2, borderColor: '#fff' }}
                />
                <View className="flex-row items-center" style={{ gap: 6 }}>
                  <Text style={{ fontSize: 10, color: palette.textTertiary, fontWeight: '500' }}>
                    {isDark ? 'Dark Mode' : 'Light Mode'}
                  </Text>
                  <ToggleSwitch on={isDark} onToggle={toggleDark} accent={accent} isDark={isDark} small />
                </View>
              </View>
            </BentoTile>

            {/* Notifications */}
            <BentoTile palette={palette} isDark={isDark} blobColor="#b45309">
              {unreadNotifications > 0 && (
                <View className="absolute items-center justify-center" style={{ top: 12, right: 12, backgroundColor: '#dc2626', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>{unreadNotifications}</Text>
                </View>
              )}
              <IconCircle color="#b45309"><Bell size={20} color="#b45309" strokeWidth={1.8} /></IconCircle>
              <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>Notifications</Text>
              <Text style={{ fontSize: 12, color: palette.textSecondary, marginTop: 2 }}>Push & email alerts</Text>
            </BentoTile>
          </View>
        )}

        {/* ── Account + Admin side by side on tablet, stacked on phone ── */}
        <View className={isTablet ? 'flex-row mt-5' : 'mt-5'} style={isTablet ? { gap: 16 } : undefined}>
          <View style={isTablet ? { flex: 1 } : undefined}>
            {/* Account Section */}
            <SectionBar title="Account" color={accent} palette={palette} />
            <View
              className="rounded-2xl border overflow-hidden"
              style={{ backgroundColor: palette.card, borderColor: palette.cardBorder }}
            >
              <AccountItem
                icon={UserCircle} iconColor={accent}
                title="Profile" subtitle="Personal information and contact details"
                badge={{ label: 'Complete', color: isDark ? '#4ade80' : '#16a34a', showCheck: true }}
                palette={palette} isDark={isDark}
                onPress={() => router.push('/(tabs)/settings/profile' as any)}
              />
              <View style={{ height: 1, backgroundColor: palette.border, marginLeft: 56 }} />
              <AccountItem
                icon={Lock} iconColor="#dc2626"
                title="Password & Security" subtitle="Password, biometrics, two-factor"
                badge={{ label: '2FA off', color: isDark ? '#fbbf24' : '#b45309' }}
                palette={palette} isDark={isDark}
                onPress={() => router.push('/(tabs)/settings/security' as any)}
              />
              <View style={{ height: 1, backgroundColor: palette.border, marginLeft: 56 }} />
              <AccountItem
                icon={SlidersHorizontal} iconColor="#0f766e"
                title="Preferences" subtitle="Language, timezone, date format, units"
                palette={palette} isDark={isDark}
                onPress={() => router.push('/(tabs)/settings/preferences' as any)}
              />
            </View>
          </View>

          {isAdmin && (
            <View style={isTablet ? { flex: 1 } : { marginTop: 20 }}>
              {/* Admin Section */}
              <SectionBar title="Administration" color="#7c3aed" palette={palette} />
              <View style={{ gap: 10 }}>
                <AdminCard icon={Database} iconColor={accent} title="Master Database" subtitle="Airports, aircraft types, airlines, reference data" palette={palette} isDark={isDark} onPress={() => router.push('/(tabs)/settings/master-database' as any)} />
                <AdminCard icon={ShieldCheck} iconColor="#7c3aed" title="Users & Roles" subtitle="User accounts, role assignment, RBAC permissions" palette={palette} isDark={isDark} />
                <AdminCard icon={ArrowLeftRight} iconColor="#0f766e" title="Interface" subtitle="AMOS, SSIM, MVT integrations and message hub" palette={palette} isDark={isDark} />
                <AdminCard icon={Building2} iconColor="#b45309" title="Operator Config" subtitle="Airline settings, base airports, fleet configuration" palette={palette} isDark={isDark} onPress={() => router.push('/(tabs)/settings/operator-config' as any)} />
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Accent Color Picker Bottom Sheet ── */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          className="flex-1 justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onPress={() => setPickerOpen(false)}
        >
          <Pressable
            onPress={() => {}}
            className="rounded-t-3xl"
            style={{
              backgroundColor: isDark ? '#1a1a1a' : '#fff',
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: 40,
            }}
          >
            {/* Handle bar */}
            <View className="self-center mb-5" style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDark ? '#444' : '#ddd' }} />

            <Text style={{ fontSize: 19, fontWeight: '700', color: palette.text, marginBottom: 4 }}>
              Accent Color
            </Text>
            <Text style={{ fontSize: 14, color: palette.textSecondary, marginBottom: 20 }}>
              Choose a color for buttons, highlights, and active elements
            </Text>

            <View className="flex-row flex-wrap" style={{ gap: 12, justifyContent: 'center' }}>
              {ACCENT_PRESETS.map((p) => {
                const selected = p.hex === rawAccent
                const displayColor = isDark ? darkAccent(p.hex) : p.hex
                const displayName = isDark ? p.darkName : p.name
                return (
                  <Pressable
                    key={p.hex}
                    onPress={() => { setAccent(p.hex); setPickerOpen(false) }}
                    className="items-center"
                    style={{ width: 64 }}
                  >
                    <View
                      className="items-center justify-center rounded-full mb-2"
                      style={{
                        width: 48,
                        height: 48,
                        backgroundColor: displayColor,
                        borderWidth: selected ? 3 : 0,
                        borderColor: '#fff',
                        ...(selected ? {
                          shadowColor: displayColor,
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.5,
                          shadowRadius: 8,
                          elevation: 6,
                        } : {}),
                      }}
                    >
                      {selected && <Check size={20} color={isDark ? '#111' : '#fff'} strokeWidth={2.5} />}
                    </View>
                    <Text style={{
                      fontSize: 13,
                      fontWeight: selected ? '700' : '500',
                      color: selected ? displayColor : palette.textSecondary,
                    }}>
                      {displayName}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
    </View>
  )
}

// ── Sub-components ──

function BentoTile({ children, palette, isDark, blobColor }: { children: React.ReactNode; palette: Palette; isDark: boolean; blobColor: string }) {
  return (
    <View
      className="flex-1 relative overflow-hidden rounded-2xl"
      style={{
        backgroundColor: palette.card,
        borderWidth: 1,
        borderColor: palette.cardBorder,
        padding: 16,
        paddingBottom: 14,
      }}
    >
      {children}
    </View>
  )
}

function IconCircle({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <View
      className="items-center justify-center rounded-full mb-2.5"
      style={{ width: 38, height: 38, backgroundColor: accentTint(color, 0.08) }}
    >
      {children}
    </View>
  )
}

function ToggleSwitch({ on, onToggle, accent, isDark, small }: { on: boolean; onToggle: () => void; accent: string; isDark: boolean; small?: boolean }) {
  const w = small ? 36 : 44
  const h = small ? 20 : 24
  const thumb = small ? 16 : 20
  return (
    <Pressable
      onPress={onToggle}
      className="rounded-full"
      style={{
        width: w, height: h,
        backgroundColor: on ? accent : isDark ? '#444' : '#ddd',
        justifyContent: 'center',
      }}
    >
      <View
        className="rounded-full bg-white"
        style={{
          width: thumb, height: thumb,
          marginLeft: on ? w - thumb - 2 : 2,
        }}
      />
    </Pressable>
  )
}

function SectionBar({ title, color, palette }: { title: string; color: string; palette: Palette }) {
  return (
    <View className="flex-row items-center mb-2.5 mt-1">
      <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: color, marginRight: 8 }} />
      <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text }}>{title}</Text>
    </View>
  )
}

function AccountItem({
  icon: Icon, iconColor, title, subtitle, badge, palette, isDark, onPress,
}: {
  icon: LucideIcon; iconColor: string; title: string; subtitle: string;
  badge?: { label: string; color: string; showCheck?: boolean };
  palette: Palette; isDark: boolean; onPress?: () => void;
}) {
  return (
    <Pressable
      className="flex-row items-center min-h-[44px] active:opacity-70"
      style={{ paddingHorizontal: 16, paddingVertical: 13 }}
      onPress={onPress}
    >
      <View
        className="items-center justify-center mr-3.5"
        style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: accentTint(iconColor, isDark ? 0.12 : 0.06) }}
      >
        <Icon size={20} color={iconColor} strokeWidth={1.6} />
      </View>
      <View className="flex-1 mr-2">
        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }}>{title}</Text>
        <Text style={{ fontSize: 13, color: palette.textSecondary, marginTop: 2 }}>{subtitle}</Text>
      </View>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        {badge && (
          <View className="flex-row items-center" style={{ gap: 3 }}>
            {badge.showCheck && <Check size={13} color={badge.color} strokeWidth={2.5} />}
            <Text style={{ fontSize: 12, fontWeight: '600', color: badge.color }}>{badge.label}</Text>
          </View>
        )}
        <ChevronRight size={16} color={palette.textTertiary} strokeWidth={1.8} />
      </View>
    </Pressable>
  )
}

function AdminCard({
  icon: Icon, iconColor, title, subtitle, palette, isDark, onPress,
}: {
  icon: LucideIcon; iconColor: string; title: string; subtitle: string;
  palette: Palette; isDark: boolean; onPress?: () => void;
}) {
  return (
    <Pressable
      className="flex-row items-center rounded-[14px] border active:opacity-70"
      style={{
        backgroundColor: palette.card,
        borderColor: palette.cardBorder,
        paddingHorizontal: 18,
        paddingVertical: 16,
      }}
      onPress={onPress}
    >
      <View
        className="items-center justify-center rounded-full mr-3.5"
        style={{ width: 42, height: 42, backgroundColor: accentTint(iconColor, isDark ? 0.12 : 0.06) }}
      >
        <Icon size={20} color={iconColor} strokeWidth={1.6} />
      </View>
      <View className="flex-1 mr-2">
        <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>{title}</Text>
        <Text style={{ fontSize: 12, color: palette.textSecondary, marginTop: 2 }}>{subtitle}</Text>
      </View>
      <ChevronRight size={18} color={palette.textTertiary} strokeWidth={1.8} />
    </Pressable>
  )
}
