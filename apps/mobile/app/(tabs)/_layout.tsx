import { Tabs } from 'expo-router'
import {
  Home,
  Globe,
  Plane,
  TowerControl,
  Users,
  Settings,
} from 'lucide-react-native'
import { SpotlightDock } from '@skyhub/ui/src/components/SpotlightDock'

const TAB_CONFIG = [
  { key: 'index',      name: 'index',      label: 'Home',       icon: Home },
  { key: 'network',    name: 'network',    label: 'Network',    icon: Globe },
  { key: 'flight-ops', name: 'flight-ops', label: 'Flight Ops', icon: Plane },
  { key: 'ground-ops', name: 'ground-ops', label: 'Ground Ops', icon: TowerControl },
  { key: 'crew-ops',   name: 'crew-ops',   label: 'Crew Ops',   icon: Users },
  { key: 'settings',   name: 'settings',   label: 'Settings',   icon: Settings },
]

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <SpotlightDock
          tabs={TAB_CONFIG}
          activeIndex={state.index}
          onTabChange={(index) => {
            const route = state.routes[index]
            navigation.navigate(route.name)
          }}
        />
      )}
    >
      {TAB_CONFIG.map(({ name, label }) => (
        <Tabs.Screen key={name} name={name} options={{ title: label }} />
      ))}
    </Tabs>
  )
}
