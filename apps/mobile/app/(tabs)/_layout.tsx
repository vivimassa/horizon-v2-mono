import { Tabs } from 'expo-router'
import { MODULE_THEMES } from '@skyhub/constants'

const INACTIVE = '#9ca3af'

/** Map tab route names to their module accent color */
const TAB_ACCENT: Record<string, string> = {
  index:       MODULE_THEMES.network.accent,
  operations:  MODULE_THEMES.operations.accent,
  ground:      MODULE_THEMES.ground.accent,
  workforce:   MODULE_THEMES.workforce.accent,
  integration: MODULE_THEMES.integration.accent,
  admin:       MODULE_THEMES.admin.accent,
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: TAB_ACCENT[route.name] ?? '#1e40af',
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: { borderTopWidth: 0.5, borderTopColor: '#e5e7eb' },
        headerShown: false,
      })}
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
