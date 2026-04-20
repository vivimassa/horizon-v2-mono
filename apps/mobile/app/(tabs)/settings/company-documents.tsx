import { Text as RNText, View, ScrollView, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { FolderOpen, ChevronLeft, Milestone, HardDrive, ArrowLeft, Dot } from 'lucide-react-native'
import { accentTint, type Palette as PaletteType } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useHubBack } from '../../../lib/use-hub-back'

// 7.1.4 Document Management — mirrors the web stub. The feature is planned,
// not built; we show the scope + phased roadmap the same way the web does so
// operators see the same story from both clients.

const PLANNED_SCOPE: Array<{ title: string; detail: string }> = [
  {
    title: 'Upload & paste',
    detail:
      'PDF, Word and plain-text uploads. Paste-in for quick procedures. Server parses text, keeps the original file in object storage (not MongoDB).',
  },
  {
    title: 'Domain tagging',
    detail:
      'Each document is tagged Flight Ops, Ground Ops, Crew Ops or Common. Multi-select — the Ops Manual usually spans all three. Module pages show filtered views so teams still feel ownership.',
  },
  {
    title: 'Versioning',
    detail:
      'Every re-upload creates a new version. Old versions stay archived with timestamps, not deleted. Rollback is one click.',
  },
  {
    title: 'Last-reviewed dates',
    detail:
      'Admin marks a document as "reviewed on DD/MM/YYYY". UI warns when a document has not been reviewed in N months (configurable).',
  },
  {
    title: 'Per-tag upload permissions',
    detail:
      'Flight-ops managers can upload and tag as Flight or Common, but not Crew. Tight control without splitting the library into separate silos.',
  },
  {
    title: 'Module-level read views',
    detail:
      'Flight Ops, Ground Ops, Crew Ops pages gain a Documents tab that shows a filtered, read-only view. One library, many windows.',
  },
  {
    title: 'AI corpus flag',
    detail:
      'Each document has an "indexed by advisor" toggle. AI Customization reads this — the advisor only retrieves from documents the operator has explicitly opted in.',
  },
  {
    title: 'Search',
    detail:
      'Full-text search across titles, section headers and body. Bonus: semantic search via the same embedding index used by the AI advisor.',
  },
  {
    title: 'Citations',
    detail:
      'When the AI references a document, it returns the section and version. Controllers can open the source directly from the recommendation.',
  },
]

const PHASED_ROADMAP: Array<{ phase: string; detail: string }> = [
  {
    phase: 'v1 (first ship)',
    detail:
      'Upload + domain tagging + version history + search + AI corpus opt-in. Enough to unblock AI Customization and give teams one place to find SOPs.',
  },
  {
    phase: 'v2',
    detail:
      'OneDrive / SharePoint read-sync. Index-in-place — files stay in the airline’s tenant, SkyHub keeps a text + vector shadow.',
  },
  {
    phase: 'v3',
    detail:
      'Sign-off workflows, crew acknowledgments, distribution tracking. This is where the module graduates into a full DMS.',
  },
  {
    phase: 'v4',
    detail: 'Two-way OneDrive sync, regulator export, change-notification broadcasting to affected crew/modules.',
  },
]

const STORAGE_NOTE = [
  'Raw PDFs live in object storage (S3 / Cloudflare R2 / Azure Blob) — never MongoDB.',
  'MongoDB keeps metadata, parsed text chunks and vector embeddings only.',
  'Rough size budget: ~50 MB per operator in Mongo. Fully manageable.',
  'Never duplicate uploads across modules — one library, many filtered views.',
]

// Registry value for 7.1.4 — matched to packages/constants/src/module-registry.ts.
const MOD = {
  code: '7.1.4',
  name: 'Document Management',
  description: 'Central library for operational manuals, SOPs and procedures shared across every module',
  parent: 'Administration',
}

export default function CompanyDocumentsScreen() {
  const router = useRouter()
  const { palette, isDark, accent } = useAppTheme()
  // Swipe-back lands on hub home with System Administration panel pre-opened.
  useHubBack('sysadmin')

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      <View
        className="flex-row items-center px-4 pt-2 pb-3"
        style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}
      >
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
          <ChevronLeft size={24} color={accent} strokeWidth={2} />
        </Pressable>
        <View
          className="items-center justify-center rounded-lg mr-3"
          style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}
        >
          <FolderOpen size={18} color={accent} strokeWidth={1.8} />
        </View>
        <View className="flex-1">
          <RNText style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Document Management</RNText>
          <RNText style={{ fontSize: 13, color: palette.textSecondary }}>
            {MOD.parent} · {MOD.code}
          </RNText>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Planned badge card */}
        <View
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: palette.card,
            borderWidth: 1,
            borderColor: palette.cardBorder,
          }}
        >
          <View
            style={{
              padding: 20,
              backgroundColor: accentTint(accent, isDark ? 0.08 : 0.04),
              borderBottomWidth: 1,
              borderBottomColor: palette.border,
            }}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1 mr-3">
                <RNText
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    color: accent,
                    marginBottom: 4,
                  }}
                >
                  {MOD.code} · {MOD.parent}
                </RNText>
                <RNText style={{ fontSize: 22, fontWeight: '700', color: palette.text, marginBottom: 6 }}>
                  {MOD.name}
                </RNText>
                <RNText style={{ fontSize: 13, color: palette.textSecondary, lineHeight: 19 }}>
                  {MOD.description}
                </RNText>
              </View>

              <View
                className="flex-row items-center rounded-full px-3 py-1.5"
                style={{
                  backgroundColor: accentTint(accent, isDark ? 0.18 : 0.12),
                  borderWidth: 1,
                  borderColor: accentTint(accent, 0.3),
                  gap: 6,
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: accent,
                    shadowColor: accent,
                    shadowOpacity: 0.8,
                    shadowRadius: 4,
                  }}
                />
                <RNText style={{ fontSize: 13, fontWeight: '600', color: accent }}>Planned</RNText>
              </View>
            </View>
          </View>
        </View>

        <SectionCard title="Planned scope" palette={palette} isDark={isDark} accent={accent} style={{ marginTop: 14 }}>
          {PLANNED_SCOPE.map((f) => (
            <View key={f.title} className="flex-row items-start" style={{ gap: 8, marginBottom: 12 }}>
              <Dot size={22} strokeWidth={3} color={accent} style={{ marginTop: -3, marginLeft: -5 }} />
              <View className="flex-1">
                <RNText style={{ fontSize: 14, fontWeight: '600', color: palette.text, marginBottom: 2 }}>
                  {f.title}
                </RNText>
                <RNText style={{ fontSize: 13, color: palette.textSecondary, lineHeight: 19 }}>{f.detail}</RNText>
              </View>
            </View>
          ))}
        </SectionCard>

        <SectionCard
          title="Phased roadmap"
          icon={<Milestone size={14} color={accent} strokeWidth={2.2} />}
          palette={palette}
          isDark={isDark}
          accent={accent}
          style={{ marginTop: 14 }}
        >
          {PHASED_ROADMAP.map((p) => (
            <View key={p.phase} className="flex-row items-start" style={{ gap: 10, marginBottom: 10 }}>
              <View
                className="rounded px-2 py-0.5"
                style={{ backgroundColor: accentTint(accent, isDark ? 0.2 : 0.14), marginTop: 2 }}
              >
                <RNText
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    color: accent,
                  }}
                >
                  {p.phase}
                </RNText>
              </View>
              <RNText style={{ flex: 1, fontSize: 13, color: palette.textSecondary, lineHeight: 19 }}>
                {p.detail}
              </RNText>
            </View>
          ))}
        </SectionCard>

        <View
          className="rounded-2xl mt-3.5"
          style={{
            backgroundColor: accentTint(accent, isDark ? 0.08 : 0.05),
            borderWidth: 1,
            borderColor: accentTint(accent, 0.22),
            padding: 16,
          }}
        >
          <View className="flex-row items-start" style={{ gap: 10 }}>
            <HardDrive size={16} color={accent} strokeWidth={2} style={{ marginTop: 3 }} />
            <View className="flex-1">
              <RNText style={{ fontSize: 13, fontWeight: '700', color: palette.text, marginBottom: 6 }}>
                Storage architecture — don’t forget
              </RNText>
              {STORAGE_NOTE.map((n) => (
                <RNText key={n} style={{ fontSize: 13, color: palette.textSecondary, lineHeight: 19, marginBottom: 4 }}>
                  — {n}
                </RNText>
              ))}
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center self-start rounded-lg mt-5 px-4 py-2.5 active:opacity-70"
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
            borderWidth: 1,
            borderColor: palette.cardBorder,
            gap: 8,
          }}
        >
          <ArrowLeft size={14} color={palette.text} strokeWidth={2} />
          <RNText style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>
            Back to System Administration
          </RNText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function SectionCard({
  title,
  icon,
  children,
  palette,
  isDark,
  accent,
  style,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  palette: PaletteType
  isDark: boolean
  accent: string
  style?: any
}) {
  return (
    <View
      className="rounded-2xl"
      style={[
        {
          backgroundColor: palette.card,
          borderWidth: 1,
          borderColor: palette.cardBorder,
          padding: 16,
        },
        style,
      ]}
    >
      <View className="flex-row items-center" style={{ gap: 8, marginBottom: 12 }}>
        {icon ?? <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: accent }} />}
        <RNText
          style={{
            fontSize: 13,
            fontWeight: '700',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: palette.textSecondary,
          }}
        >
          {title}
        </RNText>
      </View>
      {children}
    </View>
  )
}
