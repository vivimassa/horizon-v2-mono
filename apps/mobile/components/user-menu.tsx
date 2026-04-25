import { useEffect, useState } from 'react'
import { View, Text, Pressable, Modal, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronDown, Fingerprint, HelpCircle, LogOut, Moon, ScanFace, Sun, UserCircle } from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import type { AuthenticationType } from 'expo-local-authentication'
import { useAuthStore } from '@skyhub/ui'
import { useAppTheme } from '../providers/ThemeProvider'
import { useUser } from '../providers/UserProvider'
import { tokenStorage } from '../src/lib/token-storage'
import { biometricProfile } from '../src/lib/biometric-profile'
import { biometricLabel, checkBiometricAvailable } from '../src/lib/biometric-gate'

interface Props {
  /** Overlay tone (true = glassy trigger for use over imagery). */
  overlay?: boolean
  /** Phone variant: avatar + chevron only, no name/role text. */
  compact?: boolean
}

/**
 * Mobile user menu. Reads palette from useAppTheme so the trigger pill AND
 * the dropdown render correctly in both light and dark mode. Every text
 * element and icon receives an explicit palette-aware colour — no more
 * "white on white" or "black on black" footguns.
 */
export function UserMenu({ overlay = true, compact = false }: Props) {
  const router = useRouter()
  const { isDark, palette, toggleDark, accent } = useAppTheme()
  const { user } = useUser()
  const logout = useAuthStore((s) => s.logout)
  const [open, setOpen] = useState(false)

  const [bioAvailable, setBioAvailable] = useState(false)
  const [bioName, setBioName] = useState('Face ID')
  const [bioEnabled, setBioEnabled] = useState(() => tokenStorage.isBiometricEnabled())

  useEffect(() => {
    let cancelled = false
    checkBiometricAvailable().then((cap) => {
      if (cancelled || !cap.available) return
      setBioAvailable(true)
      setBioName(biometricLabel(cap.types as AuthenticationType[]))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const toggleBio = () => {
    if (bioEnabled) {
      tokenStorage.setBiometricEnabled(false)
      biometricProfile.clear()
      setBioEnabled(false)
      return
    }
    if (!bioAvailable) {
      Alert.alert(
        `${bioName} unavailable`,
        'No biometric hardware enrolled. Enroll a face or fingerprint in your device settings, then try again.',
      )
      return
    }
    const rt = tokenStorage.getRefreshToken()
    const em = user?.profile?.email
    if (!rt || !em) {
      Alert.alert('Cannot enable', 'Session info missing. Sign in again, then enable.')
      return
    }
    // Flip immediately — the biometric prompt happens at login time when the
    // user actually taps "Sign in with Face ID". Avoids a confusing pre-flight
    // prompt that may silently fail in Expo Go / unenrolled emulators.
    tokenStorage.setBiometricEnabled(true)
    biometricProfile.set({ email: em, refreshToken: rt })
    setBioEnabled(true)
  }

  const firstName = user?.profile?.firstName ?? ''
  const lastName = user?.profile?.lastName ?? ''
  const initials = (firstName[0] ?? '') + (lastName[0] ?? '') || 'U'
  const fullName = `${firstName} ${lastName}`.trim() || 'Account'
  const role = user?.role ?? ''
  const email = user?.profile?.email ?? ''

  // ── Trigger pill ──
  const triggerBg = overlay
    ? isDark
      ? 'rgba(255,255,255,0.08)'
      : 'rgba(0,0,0,0.05)'
    : isDark
      ? 'rgba(255,255,255,0.05)'
      : 'rgba(0,0,0,0.04)'
  const triggerBorder = overlay
    ? isDark
      ? 'rgba(255,255,255,0.14)'
      : 'rgba(0,0,0,0.10)'
    : isDark
      ? 'rgba(255,255,255,0.10)'
      : 'rgba(0,0,0,0.08)'
  const triggerName = palette.text
  const triggerRole = palette.textSecondary
  const chevronColor = palette.textSecondary
  const avatarBg = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.08)'
  const avatarText = palette.text

  // ── Dropdown card — always palette-aware ──
  const cardBg = palette.card
  const cardBorder = palette.border
  const dividerColor = palette.border
  const menuTextColor = palette.text
  const menuSubColor = palette.textSecondary

  const handleLogout = () => {
    setOpen(false)
    logout()
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: compact ? 8 : 12,
          paddingLeft: compact ? 6 : 14,
          paddingRight: 6,
          paddingVertical: 5,
          borderRadius: 999,
          backgroundColor: triggerBg,
          borderWidth: 1,
          borderColor: triggerBorder,
        }}
        accessibilityRole="button"
        accessibilityLabel={fullName}
      >
        {!compact && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: triggerName, letterSpacing: 0.2 }}>{fullName}</Text>
            {!!role && (
              <Text
                style={{
                  fontSize: 11,
                  color: triggerRole,
                  textTransform: 'capitalize',
                  marginTop: 1,
                }}
              >
                {role}
              </Text>
            )}
          </View>
        )}

        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: avatarBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: avatarText }}>{initials.toUpperCase()}</Text>
          <View
            style={{
              position: 'absolute',
              right: -1,
              bottom: -1,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: '#06C270',
              borderWidth: 2,
              borderColor: cardBg,
            }}
          />
        </View>

        <ChevronDown size={14} color={chevronColor} strokeWidth={2} />
      </Pressable>

      {/* Dropdown — Modal with tap-outside-to-close backdrop. */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)}>
          <View
            style={{
              position: 'absolute',
              top: 64,
              right: 12,
              width: 280,
              borderRadius: 16,
              overflow: 'hidden',
              backgroundColor: cardBg,
              borderWidth: 1,
              borderColor: cardBorder,
              shadowColor: '#000',
              shadowOpacity: isDark ? 0.45 : 0.2,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 12 },
              elevation: 12,
            }}
          >
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: dividerColor,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: menuTextColor, letterSpacing: 0.2 }}>
                {fullName}
              </Text>
              {!!email && (
                <Text style={{ fontSize: 12, color: menuSubColor, marginTop: 3 }} numberOfLines={1}>
                  {email}
                </Text>
              )}
            </View>

            <MenuItem
              icon={isDark ? Sun : Moon}
              label={isDark ? 'Light mode' : 'Dark mode'}
              color={menuTextColor}
              isDark={isDark}
              onPress={toggleDark}
            />
            <MenuItem
              icon={UserCircle}
              label="Profile"
              color={menuTextColor}
              isDark={isDark}
              onPress={() => {
                setOpen(false)
                router.push('/(tabs)/settings/profile' as never)
              }}
            />
            <MenuItem
              icon={HelpCircle}
              label="Help Center"
              color={menuTextColor}
              isDark={isDark}
              onPress={() => setOpen(false)}
            />
            {bioAvailable && (
              <MenuItemToggle
                icon={bioName === 'Face ID' ? ScanFace : Fingerprint}
                label={`Login with ${bioName}`}
                value={bioEnabled}
                onPress={toggleBio}
                color={menuTextColor}
                accent={accent}
                isDark={isDark}
              />
            )}
            <View style={{ height: 1, backgroundColor: dividerColor, marginHorizontal: 4 }} />
            <MenuItem icon={LogOut} label="Log out" color="#dc2626" isDark={isDark} onPress={handleLogout} />
          </View>
        </Pressable>
      </Modal>
    </>
  )
}

function MenuItemToggle({
  icon: Icon,
  label,
  value,
  onPress,
  color,
  accent,
  isDark,
}: {
  icon: LucideIcon
  label: string
  value: boolean
  onPress: () => void
  color: string
  accent: string
  isDark: boolean
}) {
  const pressBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
  const trackOff = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)'
  return (
    <Pressable onPress={onPress} android_ripple={{ color: pressBg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
        }}
      >
        <Icon size={17} color={color} strokeWidth={1.9} />
        <Text style={{ fontSize: 14, fontWeight: '500', color, flex: 1 }}>{label}</Text>
        <View
          style={{
            width: 38,
            height: 22,
            borderRadius: 999,
            padding: 2,
            backgroundColor: value ? accent : trackOff,
          }}
        >
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: '#fff',
              marginLeft: value ? 16 : 0,
            }}
          />
        </View>
      </View>
    </Pressable>
  )
}

function MenuItem({
  icon: Icon,
  label,
  color,
  isDark,
  onPress,
}: {
  icon: LucideIcon
  label: string
  color: string
  isDark: boolean
  onPress: () => void
}) {
  const pressBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
  return (
    <Pressable onPress={onPress} android_ripple={{ color: pressBg }}>
      {/* Inner static View locks the row layout and guarantees the colour
         is applied to every child — avoids the Pressable-style-function
         quirks that made other menus render unreadable. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
        }}
      >
        <Icon size={17} color={color} strokeWidth={1.9} />
        <Text style={{ fontSize: 14, fontWeight: '500', color }}>{label}</Text>
      </View>
    </Pressable>
  )
}
