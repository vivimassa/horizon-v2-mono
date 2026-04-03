import { memo } from 'react'
import { Text, View, ScrollView, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  Globe, Plane, Truck, Users,
  PlaneTakeoff, Building2, ArrowLeftRight, Timer, Tag,
  UserRound, FileCheck, PackageOpen,
  ChevronRight, ChevronLeft,
  Database,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'

// ── Section & card definitions ──

interface CardDef {
  code: string
  label: string
  desc: string
  icon: LucideIcon
  route: string
}

interface SectionDef {
  label: string
  icon: LucideIcon
  color: string
  cards: CardDef[]
}

const SECTIONS: SectionDef[] = [
  {
    label: 'Network',
    icon: Globe,
    color: '#0f766e',
    cards: [
      { code: '5.1.1', label: 'Countries Database', desc: 'ISO codes, regions, currency', icon: Globe, route: '/(tabs)/settings/countries' },
      { code: '5.1.2', label: 'Airports Database', desc: 'ICAO/IATA codes, coordinates, facilities', icon: PlaneTakeoff, route: '/(tabs)/settings/airports' },
      { code: '5.1.3', label: 'Citypairs Database', desc: 'Routes, distances, block times', icon: ArrowLeftRight, route: '/(tabs)/settings/citypairs' },
    ],
  },
  {
    label: 'Flight Ops',
    icon: Plane,
    color: '#1e40af',
    cards: [
      { code: '5.2.1', label: 'Aircraft Types Database', desc: 'Fleet types, capacity, performance', icon: Plane, route: '' },
      { code: '5.2.2', label: 'Delay Codes Database', desc: 'IATA standard & custom codes', icon: Timer, route: '' },
      { code: '5.2.3', label: 'Service Types Database', desc: 'Flight service categories', icon: Tag, route: '' },
    ],
  },
  {
    label: 'Ground Ops',
    icon: Truck,
    color: '#b45309',
    cards: [],
  },
  {
    label: 'Crew Ops',
    icon: Users,
    color: '#7c3aed',
    cards: [
      { code: '5.4.1', label: 'Crew Positions Database', desc: 'Cockpit & cabin roles, rank order', icon: UserRound, route: '' },
      { code: '5.4.2', label: 'Expiry Codes Database', desc: 'Qualification validity & formulas', icon: FileCheck, route: '' },
    ],
  },
]

export default function MasterDatabaseScreen() {
  const router = useRouter()
  const { isDark, palette, accent } = useAppTheme()

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
          <ChevronLeft size={24} color={accent} strokeWidth={2} />
        </Pressable>
        <View
          className="items-center justify-center rounded-lg mr-3"
          style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}
        >
          <Database size={18} color={accent} strokeWidth={1.8} />
        </View>
        <View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Master Database</Text>
          <Text style={{ fontSize: 15, color: palette.textSecondary }}>Reference data across all domains</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {SECTIONS.map((section) => (
          <DomainSection
            key={section.label}
            section={section}
            palette={palette}
            isDark={isDark}
            onNavigate={(route) => {
              if (route) router.push(route as any)
            }}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Domain section ──

const DomainSection = memo(function DomainSection({
  section,
  palette,
  isDark,
  onNavigate,
}: {
  section: SectionDef
  palette: Palette
  isDark: boolean
  onNavigate: (route: string) => void
}) {
  const SectionIcon = section.icon

  return (
    <View className="mb-5">
      {/* Section header */}
      <View className="flex-row items-center mb-2.5">
        <View style={{ width: 3, height: 20, borderRadius: 2, backgroundColor: section.color, marginRight: 8 }} />
        <View
          className="items-center justify-center rounded-md mr-2"
          style={{ width: 28, height: 28, backgroundColor: accentTint(section.color, isDark ? 0.15 : 0.1) }}
        >
          <SectionIcon size={15} color={section.color} strokeWidth={1.8} />
        </View>
        <Text style={{ fontSize: 17, fontWeight: '600', color: palette.text }}>{section.label}</Text>
      </View>

      {/* Cards or empty state */}
      {section.cards.length > 0 ? (
        <View style={{ gap: 10 }}>
          {section.cards.map((card) => (
            <EntityCard
              key={card.code}
              card={card}
              sectionColor={section.color}
              palette={palette}
              isDark={isDark}
              onPress={() => onNavigate(card.route)}
            />
          ))}
        </View>
      ) : (
        <View
          className="rounded-xl flex-row items-center"
          style={{
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
            paddingHorizontal: 16,
            paddingVertical: 18,
            gap: 12,
          }}
        >
          <PackageOpen size={20} color={palette.textTertiary} strokeWidth={1.5} />
          <View>
            <Text style={{ fontSize: 15, fontWeight: '500', color: palette.textSecondary }}>Coming soon</Text>
            <Text style={{ fontSize: 15, color: palette.textTertiary, marginTop: 2 }}>Gate config, handling agents, equipment</Text>
          </View>
        </View>
      )}
    </View>
  )
})

// ── Entity card ──

const EntityCard = memo(function EntityCard({
  card,
  sectionColor,
  palette,
  isDark,
  onPress,
}: {
  card: CardDef
  sectionColor: string
  palette: Palette
  isDark: boolean
  onPress: () => void
}) {
  const Icon = card.icon
  const disabled = !card.route

  return (
    <Pressable
      className="flex-row items-center rounded-xl active:opacity-70"
      style={{
        backgroundColor: palette.card,
        borderWidth: 1,
        borderColor: palette.cardBorder,
        paddingHorizontal: 16,
        paddingVertical: 16,
        opacity: disabled ? 0.5 : 1,
      }}
      onPress={onPress}
      disabled={disabled}
    >
      {/* Icon */}
      <View
        className="items-center justify-center rounded-lg mr-3"
        style={{ width: 36, height: 36, backgroundColor: accentTint(sectionColor, isDark ? 0.15 : 0.1) }}
      >
        <Icon size={18} color={sectionColor} strokeWidth={1.8} />
      </View>
      {/* Label + desc */}
      <View className="flex-1 mr-2">
        <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>{card.label}</Text>
        <Text style={{ fontSize: 15, color: palette.textTertiary, marginTop: 2 }}>{card.desc}</Text>
      </View>
      {/* Code + chevron */}
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: 'monospace', color: palette.textTertiary }}>{card.code}</Text>
        <ChevronRight size={16} color={palette.textTertiary} strokeWidth={1.8} />
      </View>
    </Pressable>
  )
})
