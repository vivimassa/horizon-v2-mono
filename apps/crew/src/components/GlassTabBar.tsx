import { Platform, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Calendar, Gauge, Home, Menu, Plane } from 'lucide-react-native'
import { useTheme } from '../theme/use-theme'
import { useScheme } from '../stores/use-theme-store'

/**
 * Bar-style glass tab bar (visionOS handoff defaults: Bar / Lucide / labels
 * shown / accent glow on active). Drop-in replacement for Expo Router's
 * default tabBar.
 */

const ICONS = {
  index: Home,
  roster: Calendar,
  flights: Plane,
  stats: Gauge,
  more: Menu,
} as const

const LABELS = {
  index: 'Home',
  roster: 'Roster',
  flights: 'Flights',
  stats: 'Stats',
  more: 'More',
} as const

type TabName = keyof typeof ICONS

export function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const t = useTheme()
  const scheme = useScheme()
  const insets = useSafeAreaInsets()

  const visible = state.routes.filter((r) => r.name in ICONS)

  const dark = scheme === 'dark'
  const bg = dark ? 'rgba(15,15,20,0.55)' : 'rgba(255,255,255,0.7)'
  const borderTop = dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.9)'

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 70 + insets.bottom,
      }}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 30 : 60}
        tint={dark ? 'dark' : 'light'}
        style={{
          flex: 1,
          borderTopWidth: 1,
          borderTopColor: borderTop,
          backgroundColor: bg,
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
          paddingHorizontal: 4,
          flexDirection: 'row',
        }}
      >
        {visible.map((route) => {
          const idx = state.routes.findIndex((r) => r.key === route.key)
          const isFocused = state.index === idx
          const name = route.name as TabName
          const Icon = ICONS[name]
          const label = LABELS[name]

          const activeColor = t.accent
          const inactiveColor = t.textSec

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name)
            }
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={{
                flex: 1,
                alignItems: 'center',
                gap: 3,
                paddingTop: 4,
              }}
            >
              <View
                style={{
                  padding: 4,
                  borderRadius: 8,
                  backgroundColor: isFocused ? t.accentSoft : 'transparent',
                  shadowColor: isFocused ? t.accent : 'transparent',
                  shadowOpacity: isFocused ? 0.55 : 0,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: isFocused ? 6 : 0,
                }}
              >
                <Icon color={isFocused ? activeColor : inactiveColor} size={22} />
              </View>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  letterSpacing: 0.3,
                  color: isFocused ? activeColor : inactiveColor,
                }}
              >
                {label}
              </Text>
            </Pressable>
          )
        })}
      </BlurView>
    </View>
  )
}
