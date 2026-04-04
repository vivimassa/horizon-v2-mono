import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, FlatList, TextInput, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type FlightServiceTypeRef } from '@skyhub/api'
import {
  Search, ChevronLeft, ChevronRight, Tag, Plus,
} from 'lucide-react-native'
import { accentTint, modeColor, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'

export default function ServiceTypesList() {
  const { palette, isDark, accent } = useAppTheme()
  const [types, setTypes] = useState<FlightServiceTypeRef[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fetchTypes = useCallback(() => {
    setLoading(true)
    api.getFlightServiceTypes()
      .then(setTypes)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useFocusEffect(useCallback(() => { fetchTypes() }, [fetchTypes]))

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const list = q
      ? types.filter(t =>
          t.code.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q)))
      : types
    return [...list].sort((a, b) => a.code.localeCompare(b.code))
  }, [types, search])

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
            <Tag size={18} color={accent} strokeWidth={1.8} />
          </View>
          <View className="flex-1">
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Flight Service Types</Text>
            <Text style={{ fontSize: 13, color: palette.textSecondary }}>
              {filtered.length === types.length ? `${types.length} types` : `${filtered.length} / ${types.length} types`}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/settings/service-type-add' as any)}
            className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
            style={{ backgroundColor: accent, gap: 4 }}
          >
            <Plus size={16} color="#fff" strokeWidth={2} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>New</Text>
          </Pressable>
        </View>

        {/* Search */}
        <View className="flex-row items-center rounded-xl" style={{
          backgroundColor: palette.card,
          borderWidth: 1, borderColor: palette.cardBorder,
          paddingHorizontal: 12,
        }}>
          <Search size={16} color={palette.textTertiary} strokeWidth={1.8} />
          <TextInput
            className="flex-1 py-2.5 ml-2"
            style={{ fontSize: 15, color: palette.text }}
            placeholder="Search code, name, description..."
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
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 justify-center items-center px-8">
          <Tag size={40} color={palette.textTertiary} strokeWidth={1.2} />
          <Text style={{ fontSize: 15, color: palette.textSecondary, marginTop: 12, textAlign: 'center' }}>
            {types.length === 0 ? 'No service types yet.\nTap + to create one.' : 'No results found.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item._id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <ServiceTypeRow
              type={item} palette={palette} accent={accent} isDark={isDark}
              onPress={() => router.push({ pathname: '/(tabs)/settings/service-type-detail' as any, params: { id: item._id } })}
            />
          )}
        />
      )}
    </SafeAreaView>
    </View>
  )
}

const ServiceTypeRow = memo(function ServiceTypeRow({
  type, palette, accent, isDark, onPress,
}: {
  type: FlightServiceTypeRef; palette: Palette; accent: string; isDark: boolean; onPress: () => void
}) {
  const color = modeColor(type.color || '#9ca3af', isDark)
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center active:opacity-70"
      style={{
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: palette.border,
      }}
    >
      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: color, marginRight: 10 }} />
      <Text style={{ fontSize: 15, fontWeight: '700', fontFamily: 'monospace', color: accent, width: 32 }}>
        {type.code}
      </Text>
      <View className="flex-1 ml-2">
        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>
          {type.name}
        </Text>
        {type.description && (
          <Text style={{ fontSize: 13, color: palette.textSecondary, marginTop: 1 }} numberOfLines={1}>
            {type.description}
          </Text>
        )}
      </View>
      <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
    </Pressable>
  )
})
