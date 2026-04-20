import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Text as RNText, View, FlatList, Pressable, Image, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, getApiBaseUrl, type CrewDocumentStatusRef } from '@skyhub/api'
import { FileText, User, ChevronRight, AlertTriangle } from 'lucide-react-native'
import { ListScreenHeader, SearchInput, Text, EmptyState } from '@skyhub/ui'
import { accentTint, type Palette as PaletteType } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useHubBack } from '../../../lib/use-hub-back'

// 4.1.2 Crew Documents — mobile crew list (first pane of the web 3-pane
// shell). Mobile collapses the three web panes into a drill-down stack:
// list → crew detail (folder browser) → folder contents. The durable
// filter panel is deferred; mobile queries without a Go-gate so the data
// is immediately visible, matching airport/crew lists elsewhere.

function fullName(c: CrewDocumentStatusRef): string {
  return [c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ')
}

function initials(c: CrewDocumentStatusRef): string {
  return ((c.firstName[0] ?? '') + (c.lastName[0] ?? '')).toUpperCase() || '??'
}

function coverageTone(pct: number): { bg: string; fg: string; label: string } {
  if (pct >= 100) return { bg: 'rgba(6,194,112,0.14)', fg: '#06C270', label: 'Complete' }
  if (pct >= 50) return { bg: 'rgba(255,136,0,0.14)', fg: '#FF8800', label: 'Partial' }
  return { bg: 'rgba(230,53,53,0.14)', fg: '#E63535', label: 'Gaps' }
}

export default function CrewDocumentsList() {
  const router = useRouter()
  const { palette, isDark, accent } = useAppTheme()
  // Swipe-back lands on the hub carousel with Crew Ops pre-opened, not the
  // legacy crew-ops/index.tsx "Coming soon" stub.
  useHubBack('crewops')

  const [crew, setCrew] = useState<CrewDocumentStatusRef[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      api
        .getCrewDocumentStatus()
        .then(setCrew)
        .catch(console.error)
        .finally(() => setLoading(false))
    }, []),
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return crew
    return crew.filter((c) => {
      const name = fullName(c).toLowerCase()
      return name.includes(q) || c.employeeId.toLowerCase().includes(q) || (c.position ?? '').toLowerCase().includes(q)
    })
  }, [crew, search])

  // Aggregate stats for the hero strip — summary of the current filtered set.
  const stats = useMemo(() => {
    let expired = 0
    let warning = 0
    let complete = 0
    for (const c of filtered) {
      expired += c.expiredTrainingCount
      warning += c.warningTrainingCount
      if (c.coverage >= 100) complete += 1
    }
    return { expired, warning, complete, total: filtered.length }
  }, [filtered])

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 12 }}>
          <ListScreenHeader
            icon={FileText}
            title="Crew Documents"
            count={crew.length}
            filteredCount={filtered.length}
            countLabel="crew"
          />
          <View style={{ paddingHorizontal: 16 }}>
            <SearchInput placeholder="Search name, ID, position…" value={search} onChangeText={setSearch} />
          </View>
          <StatStrip stats={stats} palette={palette} isDark={isDark} accent={accent} loading={loading} />
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator color={accent} />
            <Text variant="body" muted style={{ marginTop: 8 }}>
              Loading crew…
            </Text>
          </View>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={search ? 'No crew match your search' : 'No crew to show'}
            subtitle={search ? 'Try a different name or ID.' : 'Crew records will appear here once loaded.'}
          />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(c) => c._id}
            contentContainerStyle={{ paddingVertical: 8, paddingBottom: 100 }}
            renderItem={({ item }) => (
              <CrewRow
                crew={item}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/crew-ops/crew-document-browser' as never,
                    params: { crewId: item._id },
                  } as never)
                }
                palette={palette}
                isDark={isDark}
                accent={accent}
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  )
}

/* ──────────── Stats strip ──────────── */

function StatStrip({
  stats,
  palette,
  isDark,
  accent,
  loading,
}: {
  stats: { expired: number; warning: number; complete: number; total: number }
  palette: PaletteType
  isDark: boolean
  accent: string
  loading: boolean
}) {
  const pillBase = {
    flex: 1,
    alignItems: 'center' as const,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  }
  return (
    <View className="flex-row" style={{ paddingHorizontal: 16, marginTop: 10, gap: 8 }}>
      <View
        style={[
          pillBase,
          {
            backgroundColor: accentTint(accent, isDark ? 0.1 : 0.06),
            borderColor: accentTint(accent, 0.25),
          },
        ]}
      >
        <RNText style={{ fontSize: 20, fontWeight: '700', color: accent, fontFamily: 'monospace' }}>
          {loading ? '—' : stats.total}
        </RNText>
        <RNText
          style={{
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: palette.textSecondary,
            marginTop: 2,
          }}
        >
          Crew
        </RNText>
      </View>
      <View
        style={[
          pillBase,
          {
            backgroundColor: 'rgba(6,194,112,0.08)',
            borderColor: 'rgba(6,194,112,0.24)',
          },
        ]}
      >
        <RNText style={{ fontSize: 20, fontWeight: '700', color: '#06C270', fontFamily: 'monospace' }}>
          {loading ? '—' : stats.complete}
        </RNText>
        <RNText
          style={{
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: palette.textSecondary,
            marginTop: 2,
          }}
        >
          Complete
        </RNText>
      </View>
      <View
        style={[
          pillBase,
          {
            backgroundColor: 'rgba(255,136,0,0.08)',
            borderColor: 'rgba(255,136,0,0.24)',
          },
        ]}
      >
        <RNText style={{ fontSize: 20, fontWeight: '700', color: '#FF8800', fontFamily: 'monospace' }}>
          {loading ? '—' : stats.warning}
        </RNText>
        <RNText
          style={{
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: palette.textSecondary,
            marginTop: 2,
          }}
        >
          Expiring
        </RNText>
      </View>
      <View
        style={[
          pillBase,
          {
            backgroundColor: 'rgba(230,53,53,0.08)',
            borderColor: 'rgba(230,53,53,0.24)',
          },
        ]}
      >
        <RNText style={{ fontSize: 20, fontWeight: '700', color: '#E63535', fontFamily: 'monospace' }}>
          {loading ? '—' : stats.expired}
        </RNText>
        <RNText
          style={{
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: palette.textSecondary,
            marginTop: 2,
          }}
        >
          Expired
        </RNText>
      </View>
    </View>
  )
}

/* ──────────── Crew row ──────────── */

function CrewRow({
  crew,
  onPress,
  palette,
  isDark,
  accent,
}: {
  crew: CrewDocumentStatusRef
  onPress: () => void
  palette: PaletteType
  isDark: boolean
  accent: string
}) {
  const tone = coverageTone(crew.coverage)
  const photoFull = crew.photoUrl ? `${getApiBaseUrl()}${crew.photoUrl}` : null
  const positionLabel = [crew.position, crew.baseLabel].filter(Boolean).join(' · ')

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center active:opacity-70"
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        gap: 12,
      }}
    >
      {/* Avatar */}
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: accentTint(accent, isDark ? 0.18 : 0.1),
        }}
      >
        {photoFull ? (
          <Image source={{ uri: photoFull }} style={{ width: '100%', height: '100%' }} />
        ) : crew.firstName || crew.lastName ? (
          <RNText style={{ fontSize: 14, fontWeight: '700', color: accent }}>{initials(crew)}</RNText>
        ) : (
          <User size={18} color={palette.textTertiary} strokeWidth={1.8} />
        )}
      </View>

      {/* Name + meta */}
      <View className="flex-1" style={{ minWidth: 0 }}>
        <RNText numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>
          {fullName(crew) || '—'}
        </RNText>
        <RNText numberOfLines={1} style={{ fontSize: 13, color: palette.textSecondary, marginTop: 2 }}>
          {crew.employeeId}
          {positionLabel ? ` · ${positionLabel}` : ''}
        </RNText>

        {/* Coverage row */}
        <View className="flex-row items-center" style={{ marginTop: 6, gap: 6 }}>
          <CoverageBar pct={crew.coverage} tone={tone.fg} palette={palette} isDark={isDark} />
          <RNText style={{ fontSize: 11, fontWeight: '700', color: tone.fg, fontFamily: 'monospace' }}>
            {crew.coverage}%
          </RNText>
          {crew.expiredTrainingCount > 0 ? (
            <View className="flex-row items-center" style={{ gap: 3 }}>
              <AlertTriangle size={10} color="#E63535" strokeWidth={2} />
              <RNText style={{ fontSize: 11, fontWeight: '600', color: '#E63535' }}>{crew.expiredTrainingCount}</RNText>
            </View>
          ) : null}
          {crew.warningTrainingCount > 0 ? (
            <View className="flex-row items-center" style={{ gap: 3 }}>
              <AlertTriangle size={10} color="#FF8800" strokeWidth={2} />
              <RNText style={{ fontSize: 11, fontWeight: '600', color: '#FF8800' }}>{crew.warningTrainingCount}</RNText>
            </View>
          ) : null}
        </View>
      </View>

      <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
    </Pressable>
  )
}

function CoverageBar({
  pct,
  tone,
  palette,
  isDark,
}: {
  pct: number
  tone: string
  palette: PaletteType
  isDark: boolean
}) {
  const safePct = Math.max(0, Math.min(100, pct))
  return (
    <View
      style={{
        flex: 1,
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      }}
    >
      <View style={{ width: `${safePct}%`, height: '100%', backgroundColor: tone }} />
    </View>
  )
}
