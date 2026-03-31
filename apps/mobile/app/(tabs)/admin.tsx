import { useEffect, useState } from 'react'
import { Text, View, Pressable, ScrollView, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { api, setApiBaseUrl, type ReferenceStats } from '@skyhub/api'
import { BreadcrumbHeader } from '../components/breadcrumb-header'

setApiBaseUrl('http://192.168.1.101:3002')

const CATEGORIES: {
  key: keyof ReferenceStats
  label: string
  icon: string
  bg: string
  color: string
  route?: string
}[] = [
  { key: 'airports',           label: 'Airports',        icon: '✈️', bg: 'bg-blue-50',    color: 'text-blue-700',   route: '/admin/airports' },
  { key: 'aircraftTypes',      label: 'Aircraft Types',  icon: '🛩️', bg: 'bg-indigo-50',  color: 'text-indigo-700' },
  { key: 'countries',          label: 'Countries',       icon: '🌍', bg: 'bg-green-50',   color: 'text-green-700' },
  { key: 'delayCodes',         label: 'Delay Codes',     icon: '⏱️', bg: 'bg-amber-50',   color: 'text-amber-700' },
  { key: 'crewPositions',      label: 'Crew Positions',  icon: '👤', bg: 'bg-purple-50',  color: 'text-purple-700' },
  { key: 'expiryCodes',        label: 'Expiry Codes',    icon: '📋', bg: 'bg-red-50',     color: 'text-red-700' },
  { key: 'flightServiceTypes', label: 'Service Types',   icon: '🏷️', bg: 'bg-teal-50',    color: 'text-teal-700' },
  { key: 'operators',          label: 'Operators',       icon: '🏢', bg: 'bg-gray-100',   color: 'text-gray-700' },
]

export default function Admin() {
  const [stats, setStats] = useState<ReferenceStats | null>(null)
  const router = useRouter()

  useEffect(() => {
    api.getReferenceStats().then(setStats).catch(console.error)
  }, [])

  const handleTap = (cat: typeof CATEGORIES[number]) => {
    if (cat.route) {
      router.push(cat.route as any)
    } else {
      Alert.alert(cat.label, `${cat.label} list coming soon`)
    }
  }

  return (
    <View className="flex-1 bg-white">
      <BreadcrumbHeader moduleCode="4" />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
      <Text className="text-xl font-semibold mb-1">Master Data</Text>
      <Text className="text-sm text-gray-500 mb-5">
        {stats ? `${stats.total} total records` : 'Loading…'}
      </Text>

      <Text className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
        Categories
      </Text>

      <View className="flex-row flex-wrap gap-3">
        {CATEGORIES.map(cat => (
          <Pressable
            key={cat.key}
            className="w-[48%] rounded-xl border border-gray-200 bg-white p-4 active:opacity-70"
            onPress={() => handleTap(cat)}
            style={{ minHeight: 120 }}
          >
            <View className={`w-10 h-10 rounded-lg items-center justify-center mb-3 ${cat.bg}`}>
              <Text className="text-lg">{cat.icon}</Text>
            </View>
            <Text className="text-2xl font-bold mb-0.5">
              {stats ? stats[cat.key] : '—'}
            </Text>
            <Text className="text-[13px] text-gray-500 font-medium">{cat.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
    </View>
  )
}
