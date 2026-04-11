import { View, Text } from 'react-native'
import { PlaneTakeoff } from 'lucide-react-native'
import type { CargoFlight } from '../../types/cargo'
import { STATUS_CONFIG } from '../../data/mock-cargo'

interface FlightCardProps {
  flight: CargoFlight
  accent: string
}

export function FlightCard({ flight, accent }: FlightCardProps) {
  return (
    <View className="rounded-xl mb-4 p-3.5" style={{ backgroundColor: accent }}>
      <View className="flex-row items-center justify-between mb-1.5">
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>{flight.id}</Text>
        <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>
            {STATUS_CONFIG[flight.status]?.label ?? 'Scheduled'}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center mb-2">
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>{flight.dep}</Text>
        <View className="flex-1 mx-2 flex-row items-center">
          <View className="flex-1" style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.25)' }} />
          <PlaneTakeoff size={14} color="rgba(255,255,255,0.5)" style={{ marginHorizontal: 6 }} />
          <View className="flex-1" style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.25)' }} />
        </View>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>{flight.arr}</Text>
      </View>
      <View className="flex-row items-center justify-between">
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
          {flight.std} — {flight.sta}
        </Text>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
          {flight.aircraftType} · {flight.tailNumber}
        </Text>
      </View>
    </View>
  )
}
