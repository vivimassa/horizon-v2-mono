import React, { memo } from 'react'
import { View, Text, Pressable, ScrollView, useColorScheme, Appearance } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  UserCircle,
  Palette,
  Bell,
  Lock,
  SlidersHorizontal,
  Database,
  ShieldCheck,
  ArrowLeftRight,
  Building2,
  FileText,
  ChevronRight,
  Sun,
  Moon,
  type LucideIcon,
} from 'lucide-react-native'
import { colors, accentTint } from '@skyhub/ui/theme'

const ACCENT = '#1e40af'
const isAdmin = true

interface SettingsItem {
  icon: LucideIcon
  title: string
  subtitle: string
  route?: string
  action?: 'toggle-theme'
}

const ACCOUNT_ITEMS: SettingsItem[] = [
  { icon: UserCircle,       title: 'Profile',            subtitle: 'Name, email, crew ID' },
  { icon: Palette,           title: 'Appearance',         subtitle: 'Theme, dark mode, accent color', action: 'toggle-theme' },
  { icon: Bell,              title: 'Notifications',      subtitle: 'Push, email, alert preferences' },
  { icon: Lock,              title: 'Password & Security',subtitle: 'Change password, biometrics' },
  { icon: SlidersHorizontal, title: 'Preferences',        subtitle: 'Language, timezone, units' },
]

const ADMIN_ITEMS: SettingsItem[] = [
  { icon: Database,        title: 'Master Data',      subtitle: 'Airports, aircraft, airlines',   route: '/admin/airports' },
  { icon: ShieldCheck,     title: 'Users & Roles',    subtitle: 'Manage user accounts and RBAC' },
  { icon: ArrowLeftRight,  title: 'Interface',         subtitle: 'AMOS, SSIM, MVT, message hub' },
  { icon: Building2,       title: 'Operator Config',   subtitle: 'Airline settings, base airports' },
  { icon: FileText,        title: 'Reports',           subtitle: 'Operational reports & exports' },
]

const SettingsListItem = memo(function SettingsListItem({
  item,
  isLast,
  onPress,
  palette,
  isDark,
}: {
  item: SettingsItem
  isLast: boolean
  onPress: () => void
  palette: typeof colors.light
  isDark: boolean
}) {
  const IconComponent = item.icon
  const isThemeToggle = item.action === 'toggle-theme'

  return (
    <>
      <Pressable
        className="flex-row items-center px-3 py-2.5 min-h-[44px] active:opacity-70"
        onPress={onPress}
      >
        <View
          className="w-9 h-9 rounded-[10px] items-center justify-center mr-3"
          style={{ backgroundColor: accentTint(ACCENT, 0.08) }}
        >
          <IconComponent size={20} color={ACCENT} strokeWidth={1.75} />
        </View>
        <View className="flex-1 mr-2">
          <Text className="text-[13px] font-medium" style={{ color: palette.text }}>{item.title}</Text>
          <Text className="text-[11px] mt-0.5" style={{ color: palette.textSecondary }}>{item.subtitle}</Text>
        </View>
        {isThemeToggle ? (
          <View className="flex-row items-center gap-1.5 mr-1">
            {isDark ? (
              <Moon size={14} color={ACCENT} strokeWidth={1.75} />
            ) : (
              <Sun size={14} color={ACCENT} strokeWidth={1.75} />
            )}
            <Text className="text-[11px] font-medium" style={{ color: ACCENT }}>
              {isDark ? 'Dark' : 'Light'}
            </Text>
          </View>
        ) : (
          <ChevronRight size={16} color={palette.textTertiary} strokeWidth={1.75} />
        )}
      </Pressable>
      {!isLast && (
        <View className="ml-[52px] mr-3" style={{ height: 0.5, backgroundColor: palette.border }} />
      )}
    </>
  )
})

function SectionHeaderRow({ title, palette }: { title: string; palette: typeof colors.light }) {
  return (
    <View className="flex-row items-center mt-6 mb-2">
      <View
        className="w-[3px] h-4 rounded-full mr-2"
        style={{ backgroundColor: ACCENT }}
      />
      <Text className="text-[15px] font-bold" style={{ color: palette.text, letterSpacing: -0.3 }}>
        {title}
      </Text>
    </View>
  )
}

export default function SettingsScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const handlePress = (item: SettingsItem) => {
    if (item.action === 'toggle-theme') {
      Appearance.setColorScheme(isDark ? 'light' : 'dark')
      return
    }
    if (item.route) {
      router.push(item.route as any)
    } else {
      console.log(`Navigate to: ${item.title}`)
    }
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      <View className="px-4 pt-3 pb-2">
        <Text className="text-[20px] font-semibold" style={{ color: palette.text }}>Settings</Text>
        <Text className="text-[12px]" style={{ color: palette.textSecondary }}>
          {isAdmin ? 'Administrator' : 'User'} {'\u2014'} Nguyen Van A
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8 pt-2"
        showsVerticalScrollIndicator={false}
      >
        <SectionHeaderRow title="Account" palette={palette} />
        <View
          className="rounded-xl border shadow-sm overflow-hidden"
          style={{ backgroundColor: palette.card, borderColor: palette.cardBorder }}
        >
          {ACCOUNT_ITEMS.map((item, i) => (
            <SettingsListItem
              key={item.title}
              item={item}
              isLast={i === ACCOUNT_ITEMS.length - 1}
              onPress={() => handlePress(item)}
              palette={palette}
              isDark={isDark}
            />
          ))}
        </View>

        {isAdmin && (
          <>
            <SectionHeaderRow title="Administration" palette={palette} />
            <View
              className="rounded-xl border shadow-sm overflow-hidden"
              style={{ backgroundColor: palette.card, borderColor: palette.cardBorder }}
            >
              {ADMIN_ITEMS.map((item, i) => (
                <SettingsListItem
                  key={item.title}
                  item={item}
                  isLast={i === ADMIN_ITEMS.length - 1}
                  onPress={() => handlePress(item)}
                  palette={palette}
                  isDark={isDark}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
