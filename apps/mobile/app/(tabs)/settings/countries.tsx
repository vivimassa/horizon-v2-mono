import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { View, FlatList, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type CountryRef } from '@skyhub/api'
import { ListScreenHeader, SearchInput, Text, EmptyState, domainIcons } from '@skyhub/ui'
import { type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useHubBack } from '../../../lib/use-hub-back'

const Globe = domainIcons.globe
const ChevronRight = domainIcons.chevronRight

export default function CountriesList() {
  const { palette, isDark, accent } = useAppTheme()
  // Swipe-back lands on hub home with Master Database pre-opened.
  useHubBack('settings')
  const [countries, setCountries] = useState<CountryRef[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fetchCountries = useCallback(() => {
    setLoading(true)
    api
      .getCountries()
      .then(setCountries)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchCountries()
    }, [fetchCountries]),
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const list = q
      ? countries.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.isoCode2.toLowerCase().includes(q) ||
            c.isoCode3.toLowerCase().includes(q) ||
            c.region?.toLowerCase().includes(q),
        )
      : countries

    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [countries, search])

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 12, paddingTop: 4 }}>
          <ListScreenHeader
            icon={Globe}
            title="Countries"
            count={countries.length}
            filteredCount={filtered.length}
            countLabel="country"
          />
          <View style={{ paddingHorizontal: 16 }}>
            <SearchInput placeholder="Search name, ISO code, region…" value={search} onChangeText={setSearch} />
          </View>
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <Text variant="body" muted>
              Loading countries…
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={
              <EmptyState icon={Globe} title="No Countries" subtitle="Reference country list is empty." />
            }
            renderItem={({ item }) => (
              <CountryRow
                country={item}
                palette={palette}
                accent={accent}
                isDark={isDark}
                onPress={() =>
                  router.push({ pathname: '/(tabs)/settings/country-detail' as any, params: { id: item._id } })
                }
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  )
}

const CountryRow = memo(function CountryRow({
  country,
  palette,
  accent,
  isDark: _isDark,
  onPress,
}: {
  country: CountryRef
  palette: Palette
  accent: string
  isDark: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center active:opacity-70"
      style={{
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
      }}
    >
      <Text
        style={{
          width: 44,
          fontSize: 15,
          fontWeight: '700',
          fontFamily: 'monospace',
          color: accent,
          textAlign: 'center',
        }}
      >
        {country.isoCode2}
      </Text>
      <View className="flex-1 ml-3">
        <Text variant="body" style={{ fontWeight: '500', color: palette.text }} numberOfLines={1}>
          {country.name}
        </Text>
        <Text variant="secondary" style={{ color: palette.textSecondary, marginTop: 1 }}>
          {country.isoCode2} · {country.isoCode3}
          {country.region ? ` · ${country.region}` : ''}
        </Text>
      </View>
      <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
    </Pressable>
  )
})
