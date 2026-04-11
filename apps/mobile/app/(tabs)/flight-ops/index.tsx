import { useCallback, useEffect, useState } from 'react'
import { Text, View, FlatList, RefreshControl } from 'react-native'
import { api, type Flight } from '@skyhub/api'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { getStatusColors, type StatusKey, type Palette } from '@skyhub/ui/theme'

function formatTime(ts: number | null) {
  if (!ts) return '\u2014'
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

/* ── KPI pill ────────────────────────────── */

function KpiPill({
  label,
  value,
  color,
  palette,
}: {
  label: string
  value: string | number
  color: string
  palette: Palette
}) {
  return (
    <View
      className="flex-1 rounded-xl px-3 py-2.5"
      style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder }}
    >
      <Text className="text-lg font-bold" style={{ color }}>
        {value}
      </Text>
      <Text className="text-[11px] font-medium" style={{ color: palette.textSecondary }}>
        {label}
      </Text>
    </View>
  )
}

/* ── Flight card ─────────────────────────── */

function FlightCard({ flight, palette, isDark }: { flight: Flight; palette: Palette; isDark: boolean }) {
  const statusLabels: Record<string, string> = {
    onTime: 'On Time',
    delayed: 'Delayed',
    cancelled: 'Cancelled',
    departed: 'Departed',
    diverted: 'Diverted',
    scheduled: 'Scheduled',
  }
  const s = getStatusColors((flight.status as StatusKey) ?? 'scheduled', isDark)
  const isCancelled = flight.status === 'cancelled'

  return (
    <View
      className={`flex-row rounded-xl border mb-2.5 overflow-hidden ${isCancelled ? 'opacity-60' : ''}`}
      style={{ backgroundColor: palette.card, borderColor: palette.cardBorder }}
    >
      <View style={{ width: 3.5, backgroundColor: s.text }} />
      <View className="flex-1 p-3.5">
        <View className="flex-row items-center justify-between mb-2.5">
          <View className="flex-row items-center">
            <Text className="text-[15px] font-bold" style={{ color: palette.text }}>
              {flight.flightNumber}
            </Text>
            <Text className="text-xs ml-2" style={{ color: palette.textTertiary }}>
              {flight.tail.icaoType ?? ''}
            </Text>
          </View>
          <View className="px-2.5 py-0.5 rounded-full" style={{ backgroundColor: s.bg }}>
            <Text className="text-[10px] font-semibold" style={{ color: s.text }}>
              {statusLabels[flight.status] ?? 'Scheduled'}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center mb-2.5">
          <View className="items-center">
            <Text className="text-lg font-bold" style={{ color: palette.text }}>
              {flight.dep.iata}
            </Text>
            <Text className={`text-xs ${isCancelled ? 'line-through' : ''}`} style={{ color: palette.textSecondary }}>
              {formatTime(flight.schedule.stdUtc)}
            </Text>
          </View>
          <View className="flex-1 mx-3" style={{ height: 1, backgroundColor: palette.border }} />
          <View className="items-center">
            <Text className="text-lg font-bold" style={{ color: palette.text }}>
              {flight.arr.iata}
            </Text>
            <Text className={`text-xs ${isCancelled ? 'line-through' : ''}`} style={{ color: palette.textSecondary }}>
              {formatTime(flight.schedule.staUtc)}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-[11px]" style={{ color: palette.textTertiary }}>
            {flight.tail.registration ?? '\u2014'}
          </Text>
          {flight.delays.length > 0 && (
            <Text className="text-[11px] font-medium" style={{ color: isDark ? '#fbbf24' : '#b45309' }}>
              +{flight.delays.reduce((sum, d) => sum + d.minutes, 0)}min
            </Text>
          )}
        </View>
      </View>
    </View>
  )
}

/* ── Main screen ─────────────────────────── */

export default function FlightOps() {
  const { palette, isDark } = useAppTheme()
  const [flights, setFlights] = useState<Flight[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(() => {
    return api.getFlights().then(setFlights).catch(console.error)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  const onTime = flights.filter((f) => f.status === 'onTime' || f.status === 'departed').length
  const delayed = flights.filter((f) => f.status === 'delayed').length
  const cancelled = flights.filter((f) => f.status === 'cancelled').length
  const otp = flights.length > 0 ? Math.round((onTime / flights.length) * 100) : 0

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <BreadcrumbHeader moduleCode="2" />
      <FlatList
        data={flights}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e40af" />}
        ListHeaderComponent={
          <View>
            <View className="flex-row gap-2 mb-5">
              <KpiPill label="On Time" value={onTime} color="#16a34a" palette={palette} />
              <KpiPill label="Delayed" value={delayed} color="#b45309" palette={palette} />
              <KpiPill label="Cancelled" value={cancelled} color="#dc2626" palette={palette} />
              <KpiPill label="OTP" value={`${otp}%`} color="#1e40af" palette={palette} />
            </View>
            <Text
              className="text-[11px] font-semibold uppercase tracking-widest mb-3"
              style={{ color: palette.textTertiary }}
            >
              Active flights
            </Text>
          </View>
        }
        renderItem={({ item }) => <FlightCard flight={item} palette={palette} isDark={isDark} />}
      />
    </View>
  )
}
