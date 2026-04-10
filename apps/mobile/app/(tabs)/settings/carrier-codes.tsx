import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, FlatList, TextInput, Pressable } from 'react-native'
import { Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type CarrierCodeRef } from '@skyhub/api'
import {
  Search, ChevronLeft, ChevronRight, Building2, Plus, RefreshCw,
} from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'
import { useOperatorId } from '../../../hooks/useOperatorId'

export default function CarrierCodesList() {
  const { palette, isDark, accent } = useAppTheme()
  const operatorId = useOperatorId()
  const [carriers, setCarriers] = useState<CarrierCodeRef[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const fetchData = useCallback(() => {
    if (!operatorId) return
    setLoading(true)
    setError(null)
    api.getCarrierCodes(operatorId)
      .then(setCarriers)
      .catch((err: any) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [operatorId])

  useFocusEffect(useCallback(() => { fetchData() }, [fetchData]))

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return carriers
    return carriers.filter(c =>
      c.iataCode.toLowerCase().includes(q) ||
      (c.icaoCode?.toLowerCase().includes(q)) ||
      c.name.toLowerCase().includes(q)
    )
  }, [carriers, search])

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
    <BreadcrumbHeader moduleCode="6" />
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={[]}>
      <View className="px-4 pt-2 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="flex-row items-center mb-3">
          <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
            <ChevronLeft size={24} color={accent} strokeWidth={2} />
          </Pressable>
          <View className="items-center justify-center rounded-lg mr-3"
            style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}>
            <Building2 size={18} color={accent} strokeWidth={1.8} />
          </View>
          <View className="flex-1">
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Carrier Codes</Text>
            <Text style={{ fontSize: 15, color: palette.textSecondary }}>
              {filtered.length === carriers.length
                ? `${carriers.length} carrier${carriers.length !== 1 ? 's' : ''}`
                : `${filtered.length} / ${carriers.length} carriers`}
            </Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/settings/carrier-code-add' as any)}
            className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
            style={{ backgroundColor: accent, gap: 4 }}>
            <Plus size={16} color="#fff" strokeWidth={2} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Add</Text>
          </Pressable>
        </View>
        <View className="flex-row items-center rounded-xl" style={{
          backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder, paddingHorizontal: 12,
        }}>
          <Search size={16} color={palette.textTertiary} strokeWidth={1.8} />
          <TextInput className="flex-1 py-2.5 ml-2" style={{ fontSize: 15, color: palette.text }}
            placeholder="Search IATA, ICAO, name..." placeholderTextColor={palette.textTertiary}
            value={search} onChangeText={setSearch} autoCapitalize="none" autoCorrect={false} />
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading carrier codes...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center px-8">
          <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center', marginBottom: 12 }}>{error}</Text>
          <Pressable onPress={fetchData} className="flex-row items-center px-4 py-2 rounded-lg active:opacity-70"
            style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08), gap: 6 }}>
            <RefreshCw size={14} color={accent} strokeWidth={2} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: accent }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item._id}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center px-8 pt-16">
              <View className="items-center justify-center rounded-full mb-4"
                style={{ width: 64, height: 64, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}>
                <Building2 size={28} color={accent} strokeWidth={1.5} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text, textAlign: 'center', marginBottom: 8 }}>
                No Carrier Codes
              </Text>
              <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center', marginBottom: 20 }}>
                Define codeshare and wetlease carrier partners.
              </Text>
              <Pressable onPress={() => router.push('/(tabs)/settings/carrier-code-add' as any)}
                className="flex-row items-center px-4 py-2.5 rounded-lg active:opacity-70"
                style={{ backgroundColor: accent, gap: 6 }}>
                <Plus size={16} color="#fff" strokeWidth={2} />
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Add Carrier</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <CarrierRow carrier={item} palette={palette} accent={accent} isDark={isDark}
              onPress={() => router.push({ pathname: '/(tabs)/settings/carrier-code-detail' as any, params: { id: item._id } })} />
          )}
        />
      )}
    </SafeAreaView>
    </View>
  )
}

const CarrierRow = memo(function CarrierRow({
  carrier, palette, accent, isDark, onPress,
}: {
  carrier: CarrierCodeRef; palette: Palette; accent: string; isDark: boolean; onPress: () => void
}) {
  const [logoFailed, setLogoFailed] = useState(false)

  return (
    <Pressable onPress={onPress} className="flex-row items-center active:opacity-70" style={{
      paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.border,
      opacity: carrier.isActive ? 1 : 0.4,
    }}>
      {/* Airline logo thumbnail */}
      <View className="items-center justify-center rounded overflow-hidden mr-3"
        style={{ width: 32, height: 20, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
        {!logoFailed ? (
          <Image
            source={{ uri: `https://pics.avs.io/200/80/${carrier.iataCode}.png` }}
            style={{ width: 32, height: 20 }}
            resizeMode="contain"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <Building2 size={12} color={palette.textTertiary} strokeWidth={1.5} />
        )}
      </View>
      <Text style={{ width: 30, fontSize: 15, fontWeight: '700', fontFamily: 'monospace', color: accent }}>
        {carrier.iataCode}
      </Text>
      <View className="flex-1 ml-3">
        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>{carrier.name}</Text>
        {carrier.icaoCode && (
          <Text style={{ fontSize: 13, fontFamily: 'monospace', color: palette.textTertiary, marginTop: 1 }}>{carrier.icaoCode}</Text>
        )}
      </View>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <View className="px-1.5 py-0.5 rounded" style={{ backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff' }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#818cf8' : '#4338ca' }}>{carrier.category}</Text>
        </View>
        <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
      </View>
    </Pressable>
  )
})
