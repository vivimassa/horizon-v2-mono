import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { View, SectionList, Pressable, Text as RNText, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, getApiBaseUrl, type NonCrewPersonRef } from '@skyhub/api'
import { ListScreenHeader, SearchInput, Text, Divider, EmptyState, domainIcons } from '@skyhub/ui'
import { accentTint } from '@skyhub/ui/theme'
import { Contact, Ban, ShieldOff } from 'lucide-react-native'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useHubBack } from '../../../lib/use-hub-back'

const ChevronRight = domainIcons.chevronRight

interface CompanySection {
  title: string
  data: NonCrewPersonRef[]
}

function displayName(p: NonCrewPersonRef): string {
  const mid = p.fullName.middle ? ` ${p.fullName.middle}` : ''
  return `${p.fullName.last}, ${p.fullName.first}${mid}`.trim()
}

export default function NonCrewPeopleList() {
  const { palette, isDark, accent } = useAppTheme()
  const [people, setPeople] = useState<NonCrewPersonRef[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const router = useRouter()
  useHubBack('settings')

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      api
        .listNonCrewPeople()
        .then(setPeople)
        .catch(console.error)
        .finally(() => setLoading(false))
    }, []),
  )

  const toggleGroup = useCallback((title: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }, [])

  const { sections, filteredCount } = useMemo(() => {
    const q = search.toLowerCase().trim()
    const filtered = q
      ? people.filter((p) => {
          const name = `${p.fullName.first} ${p.fullName.middle ?? ''} ${p.fullName.last}`.toLowerCase()
          return (
            name.includes(q) ||
            (p.company ?? '').toLowerCase().includes(q) ||
            (p.department ?? '').toLowerCase().includes(q) ||
            p.passport.number.toLowerCase().includes(q)
          )
        })
      : people

    const map = new Map<string, NonCrewPersonRef[]>()
    for (const p of filtered) {
      const key = p.company ?? 'Unassigned'
      const arr = map.get(key)
      if (arr) arr.push(p)
      else map.set(key, [p])
    }

    const sections: CompanySection[] = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => {
        data.sort((a, b) => {
          const lastA = `${a.fullName.last}${a.fullName.first}`.toLowerCase()
          const lastB = `${b.fullName.last}${b.fullName.first}`.toLowerCase()
          return lastA.localeCompare(lastB)
        })
        return { title, data }
      })

    return { sections, filteredCount: filtered.length }
  }, [people, search])

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 12, paddingTop: 4 }}>
          <ListScreenHeader
            icon={Contact}
            title="Non-Crew Directory"
            count={people.length}
            filteredCount={filteredCount}
            countLabel="person"
            onAdd={() => router.push('/(tabs)/settings/non-crew-person-add' as any)}
          />
          <View style={{ paddingHorizontal: 16 }}>
            <SearchInput placeholder="Search name, company, passport…" value={search} onChangeText={setSearch} />
          </View>
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <Text variant="body" muted>
              Loading people…
            </Text>
          </View>
        ) : sections.length === 0 ? (
          <EmptyState
            icon={Contact}
            title={search ? 'No people match your search' : 'No non-crew people registered yet'}
            subtitle={search ? 'Try a different name or company.' : 'Tap New to add one.'}
          />
        ) : (
          <SectionList
            sections={sections.map((s) => ({ ...s, data: collapsed.has(s.title) ? [] : s.data }))}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ paddingBottom: 100 }}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => {
              const original = sections.find((s) => s.title === section.title)
              const count = original?.data.length ?? 0
              const isCollapsed = collapsed.has(section.title)
              return (
                <Pressable
                  className="flex-row items-center active:opacity-70"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    borderBottomWidth: 1,
                    borderBottomColor: palette.border,
                  }}
                  onPress={() => toggleGroup(section.title)}
                >
                  <ChevronRight
                    size={14}
                    color={palette.textSecondary}
                    strokeWidth={2}
                    style={{ transform: [{ rotate: isCollapsed ? '0deg' : '90deg' }], marginRight: 8 }}
                  />
                  <RNText
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                      color: palette.text,
                    }}
                  >
                    {section.title}
                  </RNText>
                  <RNText style={{ marginLeft: 6, fontSize: 13, fontWeight: '500', color: palette.textSecondary }}>
                    ({count})
                  </RNText>
                  <View className="flex-1 ml-3">
                    <Divider />
                  </View>
                </Pressable>
              )
            }}
            renderItem={({ item }) => (
              <PersonRow
                person={item}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/settings/non-crew-person-detail' as any,
                    params: { id: item._id },
                  })
                }
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  )
}

const PersonRow = memo(function PersonRow({ person, onPress }: { person: NonCrewPersonRef; onPress: () => void }) {
  const { palette, isDark, accent } = useAppTheme()
  const muted = person.terminated || person.doNotList
  const purple = '#7c3aed'
  const avatarFull = person.avatarUrl ? `${getApiBaseUrl()}${person.avatarUrl}` : null

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center active:opacity-70"
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
      }}
    >
      {avatarFull ? (
        <Image source={{ uri: avatarFull }} style={{ width: 36, height: 36, borderRadius: 18, marginRight: 12 }} />
      ) : (
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: 36,
            height: 36,
            marginRight: 12,
            backgroundColor: accentTint(purple, isDark ? 0.18 : 0.12),
          }}
        >
          <Contact size={16} color={purple} strokeWidth={1.8} />
        </View>
      )}

      <View className="flex-1 mr-2" style={{ minWidth: 0 }}>
        <RNText
          style={{
            fontSize: 15,
            fontWeight: '600',
            color: palette.text,
            textDecorationLine: muted ? 'line-through' : 'none',
            opacity: muted ? 0.6 : 1,
          }}
          numberOfLines={1}
        >
          {displayName(person)}
        </RNText>
        <RNText style={{ fontSize: 13, color: palette.textSecondary, marginTop: 2 }} numberOfLines={1}>
          {person.department ?? person.passport.number}
        </RNText>
      </View>

      <View className="flex-row items-center" style={{ gap: 8 }}>
        {person.terminated ? (
          <Ban size={13} color={palette.textTertiary} strokeWidth={1.8} />
        ) : person.doNotList ? (
          <ShieldOff size={13} color={palette.textTertiary} strokeWidth={1.8} />
        ) : null}
        <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
      </View>
    </Pressable>
  )
})
