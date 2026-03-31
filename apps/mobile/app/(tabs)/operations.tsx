import { useEffect, useState } from 'react'
import { Text, View, FlatList } from 'react-native'
import { api, setApiBaseUrl, type Flight } from '@skyhub/api'

setApiBaseUrl('http://192.168.1.101:3001')

export default function Operations() {
  const [flights, setFlights] = useState<Flight[]>([])

  useEffect(() => {
    api.getFlights().then(setFlights).catch(console.error)
  }, [])

  return (
    <View className="flex-1 bg-white pt-12 px-4">
      <Text className="text-xl font-semibold mb-4">Operations</Text>
      <Text className="text-sm text-gray-500 mb-4">{flights.length} flights</Text>
      <FlatList
        data={flights}
        keyExtractor={item => item._id}
        renderItem={({ item }) => (
          <View className="bg-gray-50 rounded-xl p-3 mb-2 border border-gray-200">
            <Text className="text-base font-bold">{item.flightNumber}</Text>
            <Text className="text-sm text-gray-600">{item.dep.iata} → {item.arr.iata}</Text>
          </View>
        )}
      />
    </View>
  )
}
