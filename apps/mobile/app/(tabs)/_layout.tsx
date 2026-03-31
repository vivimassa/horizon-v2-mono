import { Tabs } from 'expo-router'

const ACTIVE = '#1e40af'
const INACTIVE = '#9ca3af'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: { borderTopWidth: 0.5, borderTopColor: '#e5e7eb' },
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Network' }} />
      <Tabs.Screen name="operations" options={{ title: 'Operations' }} />
      <Tabs.Screen name="ground" options={{ title: 'Ground' }} />
      <Tabs.Screen name="workforce" options={{ title: 'Workforce' }} />
      <Tabs.Screen name="integration" options={{ title: 'Integration' }} />
      <Tabs.Screen name="admin" options={{ title: 'Admin' }} />
    </Tabs>
  )
}
