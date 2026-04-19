import { memo } from 'react'
import { Text, View, ScrollView, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  Globe,
  Plane,
  Truck,
  Users,
  PlaneTakeoff,
  Building2,
  ArrowLeftRight,
  Armchair,
  Timer,
  ClipboardCheck,
  Tag,
  UserRound,
  UsersRound,
  FileCheck,
  MapPin,
  ShieldCheck,
  CalendarDays,
  Activity,
  PackageOpen,
  ChevronRight,
  Database,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useHubBack } from '../../../lib/use-hub-back'

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
      {
        code: '5.1.1',
        label: 'Countries',
        desc: 'ISO codes, regions, currency',
        icon: Globe,
        route: '/(tabs)/settings/countries',
      },
      {
        code: '5.1.2',
        label: 'Airports',
        desc: 'ICAO/IATA codes, coordinates, facilities',
        icon: PlaneTakeoff,
        route: '/(tabs)/settings/airports',
      },
      {
        code: '5.1.3',
        label: 'Citypairs',
        desc: 'Routes, distances, block times',
        icon: ArrowLeftRight,
        route: '/(tabs)/settings/citypairs',
      },
      {
        code: '5.1.4',
        label: 'LOPA',
        desc: 'Cabin classes and seat configurations',
        icon: Armchair,
        route: '/(tabs)/settings/lopa',
      },
      {
        code: '5.1.5',
        label: 'Flight Service Types',
        desc: 'Define flight service types for your operation',
        icon: Tag,
        route: '/(tabs)/settings/service-types',
      },
      {
        code: '5.1.6',
        label: 'Carrier Codes',
        desc: 'Codeshare & wetlease carrier definitions',
        icon: Building2,
        route: '/(tabs)/settings/carrier-codes',
      },
    ],
  },
  {
    label: 'Flight Ops',
    icon: Plane,
    color: '#1e40af',
    cards: [
      {
        code: '5.2.1',
        label: 'Aircraft Types',
        desc: 'Fleet types, capacity, performance',
        icon: Plane,
        route: '/(tabs)/settings/aircraft-types',
      },
      {
        code: '5.2.2',
        label: 'Aircraft Registrations',
        desc: 'Tail numbers, MSN, status, home base',
        icon: PlaneTakeoff,
        route: '/(tabs)/settings/aircraft-registrations',
      },
      {
        code: '5.2.3',
        label: 'Delay Codes',
        desc: 'IATA standard & custom codes',
        icon: Timer,
        route: '/(tabs)/settings/delay-codes',
      },
      {
        code: '5.2.4',
        label: 'Maintenance Checks Setup',
        desc: 'Check types, thresholds & windows',
        icon: ClipboardCheck,
        route: '/(tabs)/settings/maintenance-checks',
      },
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
      {
        code: '5.4.1',
        label: 'Crew Bases',
        desc: 'Airport crew home bases & reporting times',
        icon: MapPin,
        route: '/(tabs)/settings/crew-bases',
      },
      {
        code: '5.4.2',
        label: 'Crew Positions',
        desc: 'Cockpit & cabin roles, rank order',
        icon: UserRound,
        route: '/(tabs)/settings/crew-positions',
      },
      {
        code: '5.4.3',
        label: 'Expiry Codes',
        desc: 'Qualification validity & formulas',
        icon: FileCheck,
        route: '/(tabs)/settings/expiry-codes',
      },
      {
        code: '5.4.4',
        label: 'Activity Codes',
        desc: 'Duty, standby, training & leave classification',
        icon: Activity,
        route: '/(tabs)/settings/activity-codes',
      },
      {
        code: '5.4.5',
        label: 'Crew Complements',
        desc: 'Aircraft type crew requirements & templates',
        icon: Users,
        route: '/(tabs)/settings/crew-complements',
      },
      {
        code: '5.4.6',
        label: 'Crew Groups',
        desc: 'Scheduling groups & crew classification',
        icon: UsersRound,
        route: '/(tabs)/settings/crew-groups',
      },
      {
        code: '5.4.7',
        label: 'FDT Rules',
        desc: 'Flight duty time limitations & regulatory framework',
        icon: ShieldCheck,
        route: '/(tabs)/settings/fdt-rules',
      },
      {
        code: '5.4.8',
        label: 'Off/Duty Patterns',
        desc: 'ON/OFF rotation patterns for crew rostering',
        icon: CalendarDays,
        route: '/(tabs)/settings/duty-patterns',
      },
      {
        code: '5.4.9',
        label: 'MPP Lead Times',
        desc: 'Training & recruitment lead times for manpower planning',
        icon: Timer,
        route: '/(tabs)/settings/mpp-lead-times',
      },
    ],
  },
]

export default function MasterDatabaseScreen() {
  const router = useRouter()
  const { isDark, palette, accent, isTablet } = useAppTheme()
  // Swipe-back lands on hub home with Master Database pre-opened.
  useHubBack('settings')

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        {/* Header */}
        <View
          className="flex-row items-center px-4 pt-2 pb-3"
          style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}
        >
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
    </View>
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
            <Text style={{ fontSize: 15, color: palette.textTertiary, marginTop: 2 }}>
              Gate config, handling agents, equipment
            </Text>
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
        <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: 'monospace', color: palette.textTertiary }}>
          {card.code}
        </Text>
        <ChevronRight size={16} color={palette.textTertiary} strokeWidth={1.8} />
      </View>
    </Pressable>
  )
})
