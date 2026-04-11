import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { View, FlatList, Pressable, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type CarrierCodeRef } from '@skyhub/api'
import { ListScreenHeader, SearchInput, Text, Button, EmptyState, Badge, domainIcons } from '@skyhub/ui'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'
import { useOperatorId } from '../../../hooks/useOperatorId'

const Building2 = domainIcons.airport
const ChevronRight = domainIcons.chevronRight

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
    api
      .getCarrierCodes(operatorId)
      .then(setCarriers)
      .catch((err: any) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [operatorId])

  useFocusEffect(
    useCallback(() => {
      fetchData()
    }, [fetchData]),
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return carriers
    return carriers.filter(
      (c) =>
        c.iataCode.toLowerCase().includes(q) ||
        c.icaoCode?.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q),
    )
  }, [carriers, search])

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <BreadcrumbHeader moduleCode="6" />
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={[]}>
        <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 12 }}>
          <ListScreenHeader
            icon={Building2}
            title="Carrier Codes"
            count={carriers.length}
            filteredCount={filtered.length}
            countLabel="carrier"
            addLabel="Add"
            onBack={() => router.back()}
            onAdd={() => router.push('/(tabs)/settings/carrier-code-add' as any)}
          />
          <View style={{ paddingHorizontal: 16 }}>
            <SearchInput placeholder="Search IATA, ICAO, name..." value={search} onChangeText={setSearch} />
          </View>
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <Text variant="body" muted>
              Loading carrier codes...
            </Text>
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center px-8">
            <Text variant="body" muted style={{ textAlign: 'center', marginBottom: 12 }}>
              {error}
            </Text>
            <Button title="Retry" variant="secondary" onPress={fetchData} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={
              <EmptyState
                icon={Building2}
                title="No Carrier Codes"
                subtitle="Define codeshare and wetlease carrier partners."
                actionLabel="Add Carrier"
                onAction={() => router.push('/(tabs)/settings/carrier-code-add' as any)}
              />
            }
            renderItem={({ item }) => (
              <CarrierRow
                carrier={item}
                onPress={() =>
                  router.push({ pathname: '/(tabs)/settings/carrier-code-detail' as any, params: { id: item._id } })
                }
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  )
}

const CarrierRow = memo(function CarrierRow({ carrier, onPress }: { carrier: CarrierCodeRef; onPress: () => void }) {
  const { palette, accent, isDark } = useAppTheme()
  const [logoFailed, setLogoFailed] = useState(false)

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center active:opacity-70"
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        opacity: carrier.isActive ? 1 : 0.4,
      }}
    >
      <View
        className="items-center justify-center rounded overflow-hidden mr-3"
        style={{ width: 32, height: 20, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
      >
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
      <Text variant="body" color={accent} style={{ width: 30, fontWeight: '700', fontFamily: 'monospace' }}>
        {carrier.iataCode}
      </Text>
      <View className="flex-1 ml-3">
        <Text variant="body" style={{ fontWeight: '500' }} numberOfLines={1}>
          {carrier.name}
        </Text>
        {carrier.icaoCode && (
          <Text variant="secondary" muted style={{ fontFamily: 'monospace', marginTop: 1 }}>
            {carrier.icaoCode}
          </Text>
        )}
      </View>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <Badge label={carrier.category} variant="accent" />
        <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
      </View>
    </Pressable>
  )
})
