import { memo } from 'react'
import { Text, View, ScrollView, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  Globe,
  Calendar,
  LayoutGrid,
  GanttChart,
  Clock,
  Repeat,
  CalendarRange,
  Handshake,
  PlaneTakeoff,
  Send,
  MessageSquare,
  PackageOpen,
  ChevronRight,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'

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
    label: 'Schedule',
    icon: Calendar,
    color: '#0f766e',
    cards: [
      {
        code: '1.1.1',
        label: 'Scheduling XL',
        desc: 'Excel-style flight schedule editor',
        icon: LayoutGrid,
        route: '/(tabs)/network/schedule-grid',
      },
      { code: '1.1.2', label: 'Gantt Chart', desc: 'Visual timeline', icon: GanttChart, route: '' },
      { code: '1.1.3', label: 'Slot Manager', desc: 'Airport slot allocations & IATA 80/20', icon: Clock, route: '' },
      { code: '1.1.4', label: 'Flight Patterns', desc: 'Build & edit patterns', icon: Repeat, route: '' },
      { code: '1.1.5', label: 'Season Manager', desc: 'Seasonal schedule management', icon: CalendarRange, route: '' },
    ],
  },
  {
    label: 'Commercial',
    icon: Handshake,
    color: '#1e40af',
    cards: [
      { code: '2.3.1', label: 'Codeshare', desc: 'Codeshare agreements', icon: Handshake, route: '' },
      { code: '2.3.2', label: 'Charter', desc: 'Charter flights', icon: PlaneTakeoff, route: '' },
      { code: '2.3.3', label: 'Aircraft Routes', desc: 'Route-tail assignment', icon: Globe, route: '' },
    ],
  },
  {
    label: 'Distribution',
    icon: Send,
    color: '#7c3aed',
    cards: [
      { code: '2.4.1', label: 'Publish', desc: 'Publish & distribute', icon: Send, route: '' },
      { code: '2.4.2', label: 'SSIM Messaging', desc: 'SSIM/SSM distribution', icon: MessageSquare, route: '' },
    ],
  },
]

export default function NetworkHub() {
  const router = useRouter()
  const { isDark, palette, accent } = useAppTheme()

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <BreadcrumbHeader moduleCode="1" />
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={[]}>
        {/* Header */}
        <View
          className="flex-row items-center px-4 pt-2 pb-3"
          style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}
        >
          <View
            className="items-center justify-center rounded-lg mr-3"
            style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}
          >
            <Globe size={18} color={accent} strokeWidth={1.8} />
          </View>
          <View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Network</Text>
            <Text style={{ fontSize: 15, color: palette.textSecondary }}>Schedule, commercial & distribution</Text>
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
    </View>
  )
}

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

      {/* Cards */}
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
    </View>
  )
})

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
      <View
        className="items-center justify-center rounded-lg mr-3"
        style={{ width: 36, height: 36, backgroundColor: accentTint(sectionColor, isDark ? 0.15 : 0.1) }}
      >
        <Icon size={18} color={sectionColor} strokeWidth={1.8} />
      </View>
      <View className="flex-1 mr-2">
        <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>{card.label}</Text>
        <Text style={{ fontSize: 15, color: palette.textTertiary, marginTop: 2 }}>{card.desc}</Text>
      </View>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: 'monospace', color: palette.textTertiary }}>
          {card.code}
        </Text>
        <ChevronRight size={16} color={palette.textTertiary} strokeWidth={1.8} />
      </View>
    </Pressable>
  )
})
