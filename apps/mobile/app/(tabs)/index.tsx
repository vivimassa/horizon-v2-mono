import React, { memo } from 'react'
import { View, Text, FlatList, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native'
import { colors, getStatusColors, type StatusKey } from '@skyhub/ui/theme'

const ACCENT = '#1e40af'

const MOCK_KPIS = [
  { label: "Today's Flights", value: '284',    change: '+12',  trend: 'up'      as const, color: ACCENT },
  { label: 'On-Time Rate',    value: '91.2%',  change: '+2.1%',trend: 'up'      as const, color: '#16a34a' },
  { label: 'Active Disruptions', value: '7',   change: '+3',   trend: 'up'      as const, color: '#dc2626' },
  { label: 'Crew Available',  value: '1,842',  change: '+28',  trend: 'up'      as const, color: '#7c3aed' },
  { label: 'Aircraft Serviceable', value: '98/102', change: '\u2014', trend: 'neutral' as const, color: '#0f766e' },
  { label: 'Avg Delay',       value: '14m',    change: '-3m',  trend: 'down'    as const, color: '#b45309' },
]

const MOCK_FLIGHTS: { id: string; flight: string; route: string; std: string; status: StatusKey }[] = [
  { id: '1', flight: 'VJ-123', route: 'SGN \u2192 HAN', std: '06:30', status: 'onTime' },
  { id: '2', flight: 'VJ-456', route: 'SGN \u2192 DAD', std: '07:15', status: 'delayed' },
  { id: '3', flight: 'VJ-789', route: 'HAN \u2192 SGN', std: '08:00', status: 'departed' },
  { id: '4', flight: 'VJ-321', route: 'DAD \u2192 HAN', std: '09:45', status: 'onTime' },
  { id: '5', flight: 'VJ-654', route: 'SGN \u2192 CXR', std: '10:30', status: 'cancelled' },
  { id: '6', flight: 'VJ-987', route: 'HAN \u2192 DAD', std: '11:00', status: 'scheduled' },
]

const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'neutral' }) => {
  if (trend === 'up') return <TrendingUp size={12} color="#16a34a" strokeWidth={2} />
  if (trend === 'down') return <TrendingDown size={12} color="#dc2626" strokeWidth={2} />
  return <Minus size={12} color="#888888" strokeWidth={2} />
}

const KpiCard = memo(function KpiCard({
  item,
  palette,
}: {
  item: typeof MOCK_KPIS[number]
  palette: typeof colors.light
}) {
  return (
    <View
      className="flex-1 rounded-xl border p-3 m-1 shadow-sm"
      style={{ backgroundColor: palette.card, borderColor: palette.cardBorder, minWidth: '45%' }}
    >
      <Text className="text-[18px] font-semibold mb-1" style={{ color: item.color }}>
        {item.value}
      </Text>
      <Text className="text-[12px] mb-1.5" style={{ color: palette.textSecondary }}>{item.label}</Text>
      <View className="flex-row items-center gap-1">
        <TrendIcon trend={item.trend} />
        <Text className="text-[11px]" style={{ color: palette.textSecondary }}>{item.change}</Text>
      </View>
    </View>
  )
})

const FlightRow = memo(function FlightRow({
  item,
  palette,
  isDark,
}: {
  item: typeof MOCK_FLIGHTS[number]
  palette: typeof colors.light
  isDark: boolean
}) {
  const s = getStatusColors(item.status, isDark)
  const statusLabels: Record<StatusKey, string> = {
    onTime: 'On Time', delayed: 'Delayed', cancelled: 'Cancelled',
    departed: 'Departed', diverted: 'Diverted', scheduled: 'Scheduled',
  }
  return (
    <View className="flex-row items-center px-3 py-2.5 min-h-[44px]">
      <Text className="text-[13px] font-bold w-16" style={{ color: palette.text }}>
        {item.flight}
      </Text>
      <Text className="text-[13px] flex-1" style={{ color: palette.textSecondary }}>{item.route}</Text>
      <Text className="text-[12px] mr-3" style={{ color: palette.textSecondary }}>{item.std}</Text>
      <View className="rounded-md px-2 py-0.5" style={{ backgroundColor: s.bg }}>
        <Text className="text-[11px] font-semibold" style={{ color: s.text }}>
          {statusLabels[item.status]}
        </Text>
      </View>
    </View>
  )
})

export default function HomeScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      <View className="px-4 pt-3 pb-2">
        <Text className="text-[20px] font-semibold" style={{ color: palette.text }}>Home</Text>
        <Text className="text-[12px]" style={{ color: palette.textSecondary }}>
          {today} {'\u2022'} VietJet Air
        </Text>
      </View>

      <FlatList
        data={MOCK_FLIGHTS}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-4 pt-2"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View className="flex-row flex-wrap mb-6">
              {MOCK_KPIS.map((kpi) => (
                <View key={kpi.label} className="w-1/2">
                  <KpiCard item={kpi} palette={palette} />
                </View>
              ))}
            </View>

            <View className="flex-row items-center mt-2 mb-2">
              <View
                className="w-[3px] h-4 rounded-full mr-2"
                style={{ backgroundColor: ACCENT }}
              />
              <Text className="text-[15px] font-bold" style={{ color: palette.text, letterSpacing: -0.3 }}>
                Today's Flights
              </Text>
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <View
            className={`border-l border-r ${index === 0 ? 'rounded-t-xl border-t' : ''} ${index === MOCK_FLIGHTS.length - 1 ? 'rounded-b-xl border-b' : ''}`}
            style={{ backgroundColor: palette.card, borderColor: palette.cardBorder }}
          >
            <FlightRow item={item} palette={palette} isDark={isDark} />
            {index < MOCK_FLIGHTS.length - 1 && (
              <View className="ml-3 mr-3" style={{ height: 0.5, backgroundColor: palette.border }} />
            )}
          </View>
        )}
      />
    </SafeAreaView>
  )
}
