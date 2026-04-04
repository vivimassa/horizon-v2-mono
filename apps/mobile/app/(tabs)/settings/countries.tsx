import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, FlatList, TextInput, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type CountryRef } from '@skyhub/api'
import {
  Search, ChevronLeft, ChevronRight, Globe, Plus,
} from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'

export default function CountriesList() {
  const { palette, isDark, accent } = useAppTheme()
  const [countries, setCountries] = useState<CountryRef[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fetchCountries = useCallback(() => {
    setLoading(true)
    api.getCountries()
      .then(setCountries)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useFocusEffect(useCallback(() => { fetchCountries() }, [fetchCountries]))

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const list = q
      ? countries.filter(c =>
          c.name.toLowerCase().includes(q) ||
          c.isoCode2.toLowerCase().includes(q) ||
          c.isoCode3.toLowerCase().includes(q) ||
          (c.region?.toLowerCase().includes(q))
        )
      : countries

    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [countries, search])

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
    <BreadcrumbHeader moduleCode="6" />
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={[]}>
      {/* Header */}
      <View className="px-4 pt-2 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="flex-row items-center mb-3">
          <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
            <ChevronLeft size={24} color={accent} strokeWidth={2} />
          </Pressable>
          <View
            className="items-center justify-center rounded-lg mr-3"
            style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}
          >
            <Globe size={18} color={accent} strokeWidth={1.8} />
          </View>
          <View className="flex-1">
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Countries</Text>
            <Text style={{ fontSize: 13, color: palette.textSecondary }}>
              {filtered.length === countries.length
                ? `${countries.length} countries`
                : `${filtered.length} / ${countries.length} countries`}
            </Text>
          </View>
        </View>

        {/* Search */}
        <View className="flex-row items-center rounded-xl" style={{
          backgroundColor: palette.card,
          borderWidth: 1,
          borderColor: palette.cardBorder,
          paddingHorizontal: 12,
        }}>
          <Search size={16} color={palette.textTertiary} strokeWidth={1.8} />
          <TextInput
            className="flex-1 py-2.5 ml-2"
            style={{ fontSize: 14, color: palette.text }}
            placeholder="Search name, ISO code, region…"
            placeholderTextColor={palette.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 14, color: palette.textTertiary }}>Loading countries…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item._id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <CountryRow country={item} palette={palette} accent={accent} isDark={isDark}
              onPress={() => router.push({ pathname: '/(tabs)/settings/country-detail' as any, params: { id: item._id } })} />
          )}
        />
      )}
    </SafeAreaView>
    </View>
  )
}

const CountryRow = memo(function CountryRow({
  country, palette, accent, isDark, onPress,
}: {
  country: CountryRef; palette: Palette; accent: string; isDark: boolean; onPress: () => void
}) {
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
      <Text
        style={{
          width: 44, fontSize: 15, fontWeight: '700',
          fontFamily: 'monospace', color: accent,
          textAlign: 'center',
        }}
      >
        {country.isoCode2}
      </Text>
      <View className="flex-1 ml-3">
        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>
          {country.name}
        </Text>
        <Text style={{ fontSize: 13, color: palette.textSecondary, marginTop: 1 }}>
          {country.isoCode2} · {country.isoCode3}
          {country.region ? ` · ${country.region}` : ''}
        </Text>
      </View>
      <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
    </Pressable>
  )
})
