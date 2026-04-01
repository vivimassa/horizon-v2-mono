import React, { memo } from 'react'
import { View, Text, Pressable, ScrollView, useColorScheme, useWindowDimensions, Appearance } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  UserCircle,
  Palette as PaletteIcon,
  Bell,
  Lock,
  SlidersHorizontal,
  Database,
  ShieldCheck,
  ArrowLeftRight,
  Building2,
  FileText,
  Sun,
  Moon,
  type LucideIcon,
} from 'lucide-react-native'
import { colors, accentTint, type Palette } from '@skyhub/ui/theme'

const ACCENT = '#1e40af'
const isAdmin = true
const TABLET_WIDTH = 768

interface SettingsCardItem {
  icon: LucideIcon
  title: string
  subtitle: string
  code: string
  route?: string
  action?: 'toggle-theme'
}

const ACCOUNT_ITEMS: SettingsCardItem[] = [
  { icon: UserCircle,       title: 'Profile',             subtitle: 'Name, email, role',              code: '6.1', route: '/settings/profile' },
  { icon: PaletteIcon,      title: 'Appearance',          subtitle: 'Theme & accent color',           code: '6.2', action: 'toggle-theme' },
  { icon: Bell,             title: 'Notifications',       subtitle: 'Push & email alerts',            code: '6.3' },
  { icon: Lock,             title: 'Security',            subtitle: 'Password & biometrics',          code: '6.4' },
  { icon: SlidersHorizontal,title: 'Preferences',         subtitle: 'Language & timezone',            code: '6.5' },
]

const ADMIN_ITEMS: SettingsCardItem[] = [
  { icon: Database,         title: 'Master Data',         subtitle: 'Airports & aircraft',            code: '6.6', route: '/admin/airports' },
  { icon: ShieldCheck,      title: 'Users & Roles',       subtitle: 'Accounts & RBAC',                code: '6.7' },
  { icon: ArrowLeftRight,   title: 'Interface',            subtitle: 'AMOS, SSIM, MVT',               code: '6.8' },
  { icon: Building2,        title: 'Operator',             subtitle: 'Airline config',                 code: '6.9' },
  { icon: FileText,         title: 'Reports',              subtitle: 'Exports & analytics',            code: '6.10' },
]

// ── Card component for mobile ──
const SettingsCard = memo(function SettingsCard({
  item,
  onPress,
  palette,
  isDark,
  isTablet,
}: {
  item: SettingsCardItem
  onPress: () => void
  palette: Palette
  isDark: boolean
  isTablet?: boolean
}) {
  const IconComponent = item.icon
  const isThemeToggle = item.action === 'toggle-theme'
  const iconBoxSize = isTablet ? 56 : 44
  const iconSize = isTablet ? 28 : 22
  const minH = isTablet ? 150 : 110

  return (
    <Pressable
      onPress={onPress}
      className="items-center rounded-2xl border active:opacity-70"
      style={{
        backgroundColor: palette.card,
        borderColor: palette.cardBorder,
        minHeight: minH,
        padding: isTablet ? 20 : 12,
      }}
    >
      {/* Code badge top-right */}
      <View style={{ position: 'absolute', top: isTablet ? 12 : 10, right: isTablet ? 12 : 10 }}>
        <Text
          style={{
            color: palette.textTertiary,
            fontFamily: 'monospace',
            fontSize: isTablet ? 12 : 10,
            fontWeight: '700',
          }}
        >
          {item.code}
        </Text>
      </View>

      {/* Icon */}
      <View
        className="rounded-xl items-center justify-center"
        style={{
          width: iconBoxSize,
          height: iconBoxSize,
          backgroundColor: accentTint(ACCENT, isDark ? 0.15 : 0.08),
          marginBottom: isTablet ? 12 : 10,
          marginTop: isTablet ? 8 : 4,
        }}
      >
        {isThemeToggle ? (
          isDark ? (
            <Moon size={iconSize} color={ACCENT} strokeWidth={1.6} />
          ) : (
            <Sun size={iconSize} color={ACCENT} strokeWidth={1.6} />
          )
        ) : (
          <IconComponent size={iconSize} color={ACCENT} strokeWidth={1.6} />
        )}
      </View>

      {/* Title */}
      <Text
        className="font-semibold text-center"
        style={{ color: palette.text, fontSize: isTablet ? 15 : 12 }}
        numberOfLines={1}
      >
        {item.title}
      </Text>

      {/* Subtitle */}
      <Text
        className="text-center"
        style={{ color: palette.textSecondary, fontSize: isTablet ? 12 : 10, marginTop: 2 }}
        numberOfLines={1}
      >
        {item.subtitle}
      </Text>
    </Pressable>
  )
})

// ── Section header ──
function SectionHeaderRow({ title, palette }: { title: string; palette: Palette }) {
  return (
    <View className="flex-row items-center mt-5 mb-2 px-1">
      <View className="w-[3px] h-4 rounded-full mr-2" style={{ backgroundColor: ACCENT }} />
      <Text className="text-[15px] font-bold" style={{ color: palette.text, letterSpacing: -0.3 }}>
        {title}
      </Text>
    </View>
  )
}

// ── Breadcrumb for tablet ──
function TabletBreadcrumb({ palette }: { palette: Palette }) {
  return (
    <View
      className="flex-row items-center px-3 py-2 rounded-xl mb-2 self-start"
      style={{
        backgroundColor: accentTint(ACCENT, 0.06),
        borderWidth: 1,
        borderColor: accentTint(ACCENT, 0.12),
      }}
    >
      <Text className="text-[12px] font-semibold" style={{ color: ACCENT }}>
        6
      </Text>
      <Text className="text-[12px] font-medium ml-1.5" style={{ color: palette.text }}>
        Settings
      </Text>
    </View>
  )
}

export default function SettingsScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const { width } = useWindowDimensions()
  const isTablet = width >= TABLET_WIDTH

  const handlePress = (item: SettingsCardItem) => {
    if (item.action === 'toggle-theme') {
      Appearance.setColorScheme(isDark ? 'light' : 'dark')
      return
    }
    if (item.route) {
      router.push(item.route as any)
    }
  }

  const sidePadding = isTablet ? 32 : 24
  const minCardWidth = isTablet ? 160 : 105
  const numCols = Math.floor((width - sidePadding) / minCardWidth)
  const cardWidth = (width - sidePadding) / numCols

  const renderCardGrid = (items: SettingsCardItem[]) => (
    <View className="flex-row flex-wrap">
      {items.map((item) => (
        <View key={item.code} style={{ width: cardWidth, padding: isTablet ? 6 : 4 }}>
          <SettingsCard
            item={item}
            onPress={() => handlePress(item)}
            palette={palette}
            isDark={isDark}
            isTablet={isTablet}
          />
        </View>
      ))}
    </View>
  )

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-3 pb-24 pt-2"
        showsVerticalScrollIndicator={false}
      >
        {/* Breadcrumb for tablet */}
        {isTablet && <TabletBreadcrumb palette={palette} />}

        <SectionHeaderRow title="User Account" palette={palette} />
        {renderCardGrid(ACCOUNT_ITEMS)}

        {isAdmin && (
          <>
            <SectionHeaderRow title="System Configuration" palette={palette} />
            {renderCardGrid(ADMIN_ITEMS)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
