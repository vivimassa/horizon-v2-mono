import { useCallback, useEffect, useState } from 'react'
import { Text, View, FlatList, RefreshControl } from 'react-native'
import { api, setApiBaseUrl, type Flight } from '@skyhub/api'
import { BreadcrumbHeader } from '../../components/breadcrumb-header'

setApiBaseUrl('http://192.168.1.101:3002')

/* ── Status config ───────────────────────── */

const STATUS: Record<string, { bar: string; badge: string; badgeBg: string; label: string }> = {
  onTime:    { bar: 'bg-green-500',  badge: 'text-green-700',  badgeBg: 'bg-green-100',  label: 'On Time' },
  delayed:   { bar: 'bg-amber-500',  badge: 'text-amber-700',  badgeBg: 'bg-amber-100',  label: 'Delayed' },
  cancelled: { bar: 'bg-red-500',    badge: 'text-red-700',    badgeBg: 'bg-red-100',    label: 'Cancelled' },
  departed:  { bar: 'bg-blue-500',   badge: 'text-blue-700',   badgeBg: 'bg-blue-100',   label: 'Departed' },
  diverted:  { bar: 'bg-purple-500', badge: 'text-purple-700', badgeBg: 'bg-purple-100', label: 'Diverted' },
  scheduled: { bar: 'bg-gray-400',   badge: 'text-gray-600',   badgeBg: 'bg-gray-100',   label: 'Scheduled' },
}

function cfg(status: string) {
  return STATUS[status] ?? STATUS.scheduled
}

function formatTime(ts: number | null) {
  if (!ts) return '\u2014'
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

/* ── KPI pill ────────────────────────────── */

function KpiPill({ label, value, bg, text }: { label: string; value: string | number; bg: string; text: string }) {
  return (
    <View className={`flex-1 rounded-xl px-3 py-2.5 ${bg}`}>
      <Text className={`text-lg font-bold ${text}`}>{value}</Text>
      <Text className={`text-[11px] font-medium ${text} opacity-70`}>{label}</Text>
    </View>
  )
}

/* ── Flight card ─────────────────────────── */

function FlightCard({ flight }: { flight: Flight }) {
  const s = cfg(flight.status)
  const isCancelled = flight.status === 'cancelled'

  return (
    <View className={`flex-row rounded-xl border border-gray-200 bg-white mb-2.5 overflow-hidden ${isCancelled ? 'opacity-60' : ''}`}>
      <View className={`w-[3.5px] ${s.bar}`} />
      <View className="flex-1 p-3.5">
        <View className="flex-row items-center justify-between mb-2.5">
          <View className="flex-row items-center">
            <Text className="text-[15px] font-bold">{flight.flightNumber}</Text>
            <Text className="text-xs text-gray-400 ml-2">{flight.tail.icaoType ?? ''}</Text>
          </View>
          <View className={`px-2.5 py-0.5 rounded-full ${s.badgeBg}`}>
            <Text className={`text-[10px] font-semibold ${s.badge}`}>{s.label}</Text>
          </View>
        </View>
        <View className="flex-row items-center mb-2.5">
          <View className="items-center">
            <Text className="text-lg font-bold">{flight.dep.iata}</Text>
            <Text className={`text-xs text-gray-500 ${isCancelled ? 'line-through' : ''}`}>
              {formatTime(flight.schedule.stdUtc)}
            </Text>
          </View>
          <View className="flex-1 mx-3 border-t border-gray-200" />
          <View className="items-center">
            <Text className="text-lg font-bold">{flight.arr.iata}</Text>
            <Text className={`text-xs text-gray-500 ${isCancelled ? 'line-through' : ''}`}>
              {formatTime(flight.schedule.staUtc)}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-[11px] text-gray-400">{flight.tail.registration ?? '\u2014'}</Text>
          {flight.delays.length > 0 && (
            <Text className="text-[11px] text-amber-600 font-medium">
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
  const [flights, setFlights] = useState<Flight[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(() => {
    return api.getFlights().then(setFlights).catch(console.error)
  }, [])

  useEffect(() => { load() }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  const onTime = flights.filter(f => f.status === 'onTime' || f.status === 'departed').length
  const delayed = flights.filter(f => f.status === 'delayed').length
  const cancelled = flights.filter(f => f.status === 'cancelled').length
  const otp = flights.length > 0 ? Math.round((onTime / flights.length) * 100) : 0

  return (
    <View className="flex-1 bg-white">
      <BreadcrumbHeader moduleCode="2" />
      <FlatList
        data={flights}
        keyExtractor={item => item._id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e40af" />}
        ListHeaderComponent={
          <View>
            <View className="flex-row gap-2 mb-5">
              <KpiPill label="On Time" value={onTime} bg="bg-green-50" text="text-green-700" />
              <KpiPill label="Delayed" value={delayed} bg="bg-amber-50" text="text-amber-700" />
              <KpiPill label="Cancelled" value={cancelled} bg="bg-red-50" text="text-red-700" />
              <KpiPill label="OTP" value={`${otp}%`} bg="bg-blue-50" text="text-blue-700" />
            </View>
            <Text className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
              Active flights
            </Text>
          </View>
        }
        renderItem={({ item }) => <FlightCard flight={item} />}
      />
    </View>
  )
}
