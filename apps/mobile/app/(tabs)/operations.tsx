import React, { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, ActivityIndicator } from 'react-native'
import { YStack, XStack, Text, useTheme } from 'tamagui'
import { Card, Badge, type StatusKey } from '@horizon/ui'
import { api, type Flight } from '@horizon/api'

function formatTime(utcMs: number): string {
  const d = new Date(utcMs)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

const FlightCard = React.memo(function FlightCard({
  flight,
}: {
  flight: Flight
}) {
  const theme = useTheme()
  const delayMin = flight.delays.reduce((sum, d) => sum + d.minutes, 0)

  return (
    <Card>
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize={15} fontWeight="700" color="$color" letterSpacing={-0.3}>
          {flight.flightNumber}
        </Text>
        <Badge variant={flight.status as StatusKey} />
      </XStack>

      <XStack alignItems="center" gap="$xs">
        <Text fontSize={14} fontWeight="600" color="$color">{flight.dep.iata}</Text>
        <Text fontSize={14} color="$colorTertiary">→</Text>
        <Text fontSize={14} fontWeight="600" color="$color">{flight.arr.iata}</Text>
        <YStack flex={1} />
        <Text fontSize={11} color="$colorSecondary">
          {flight.tail.icaoType} · {flight.tail.registration}
        </Text>
      </XStack>

      <XStack gap="$2xl" marginTop="$xs">
        <YStack gap={2}>
          <Text fontSize={12} fontWeight="600" color="$colorSecondary" textTransform="uppercase" letterSpacing={0.5}>
            STD
          </Text>
          <Text fontSize={14} color="$color">{formatTime(flight.schedule.stdUtc)}</Text>
        </YStack>
        <YStack gap={2}>
          <Text fontSize={12} fontWeight="600" color="$colorSecondary" textTransform="uppercase" letterSpacing={0.5}>
            STA
          </Text>
          <Text fontSize={14} color="$color">{formatTime(flight.schedule.staUtc)}</Text>
        </YStack>
        {delayMin > 0 && (
          <YStack gap={2}>
            <Text fontSize={12} fontWeight="600" color="$colorSecondary" textTransform="uppercase" letterSpacing={0.5}>
              DELAY
            </Text>
            <Text fontSize={14} color="#ef4444" fontWeight="600">+{delayMin}m</Text>
          </YStack>
        )}
      </XStack>
    </Card>
  )
})

export default function OperationsScreen() {
  const theme = useTheme()
  const [flights, setFlights] = useState<Flight[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchFlights = useCallback(async () => {
    try {
      const data = await api.getFlights()
      setFlights(data)
    } catch (err) {
      console.error('Failed to fetch flights:', err)
    }
  }, [])

  useEffect(() => {
    fetchFlights().finally(() => setLoading(false))
  }, [fetchFlights])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchFlights()
    setRefreshing(false)
  }, [fetchFlights])

  const renderItem = useCallback(
    ({ item }: { item: Flight }) => <FlightCard flight={item} />,
    []
  )

  return (
    <YStack flex={1} backgroundColor="$background" paddingHorizontal="$lg" paddingTop="$md">
      <YStack marginBottom="$md">
        <Text fontSize={20} fontWeight="600" color="$color">Operations</Text>
        <Text fontSize={12} color="$colorSecondary" marginTop={2}>
          {flights.length} flights
        </Text>
      </YStack>

      {loading ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <ActivityIndicator size="large" color={theme.accentColor.val} />
        </YStack>
      ) : (
        <FlatList
          data={flights}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
          ItemSeparatorComponent={() => <YStack height="$sm" />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accentColor.val}
              colors={[theme.accentColor.val]}
            />
          }
        />
      )}
    </YStack>
  )
}
