import { Tabs, useRouter } from 'expo-router'
import {
  Home,
  Globe,
  Plane,
  TowerControl,
  Users,
  Settings,
} from 'lucide-react-native'
import { SpotlightDock } from '@skyhub/ui'
import { useAppTheme } from '../../providers/ThemeProvider'

const TAB_CONFIG = [
  { key: 'index',      name: 'index',      label: 'Home',       icon: Home },
  { key: 'network',    name: 'network',    label: 'Network',    icon: Globe },
  { key: 'flight-ops', name: 'flight-ops', label: 'Flight Ops', icon: Plane },
  { key: 'ground-ops', name: 'ground-ops', label: 'Ground Ops', icon: TowerControl },
  { key: 'crew-ops',   name: 'crew-ops',   label: 'Crew Ops',   icon: Users },
  { key: 'settings',   name: 'settings',   label: 'Settings',   icon: Settings },
]

export default function TabLayout() {
  const { isDark } = useAppTheme()
  const router = useRouter()

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <SpotlightDock
          tabs={TAB_CONFIG}
          activeIndex={state.index}
          isDark={isDark}
          onTabChange={(index: number) => {
            const route = state.routes[index]
            if (state.index === index) {
              // Already on this tab — navigate to root to reset stack
              const tabRoute = state.routes[index]
              const nestedState = tabRoute.state
              if (nestedState && nestedState.index != null && nestedState.index > 0) {
                router.navigate((`/(tabs)/${route.name}`) as any)
              }
            } else {
              navigation.navigate(route.name)
            }
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
