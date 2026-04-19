import { Tabs, useRouter } from 'expo-router'
import { Home, Globe, Plane, Truck, Users, Database, ShieldCheck } from 'lucide-react-native'
import { SpotlightDock } from '@skyhub/ui'
import { useAppTheme } from '../../providers/ThemeProvider'

// Mirror apps/web/src/components/SpotlightDock.tsx TABS exactly — 7 domains.
// The `settings` folder hosts Master Database (5.x) while the new `admin`
// folder hosts System Administration (7.x). Keeping the folder named
// `settings` avoids breaking the 60+ internal routes that already target
// `/(tabs)/settings/...`; the label shown in the dock reads "Database".
const TAB_CONFIG = [
  { key: 'index', name: 'index', label: 'Home', icon: Home },
  { key: 'network', name: 'network', label: 'Network', icon: Globe },
  { key: 'flight-ops', name: 'flight-ops', label: 'Flight Ops', icon: Plane },
  { key: 'ground-ops', name: 'ground-ops', label: 'Ground Ops', icon: Truck },
  { key: 'crew-ops', name: 'crew-ops', label: 'Crew Ops', icon: Users },
  { key: 'settings', name: 'settings', label: 'Database', icon: Database },
  { key: 'admin', name: 'admin', label: 'Admin', icon: ShieldCheck },
]

export default function TabLayout() {
  const { isDark } = useAppTheme()
  const router = useRouter()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Eager-mount every tab at startup so the first swipe doesn't trigger
        // a blocking render — the perceived 500-1000ms "blank fade" is a
        // lazy-mount artefact, not a slow device.
        lazy: false,
        // DON'T freeze off-screen tabs — freezing pauses their RAF, and when
        // you swipe back the tab has to "thaw" + repaint, which reads as a
        // delay even with animation: 'none'. Keeping them alive burns a bit
        // of RAM but makes every tab switch instant.
        freezeOnBlur: false,
        // Instant cut — no transition.
        animation: 'none',
      }}
      tabBar={({ state, navigation }) => {
        // Hub home (index tab) is cinematic — hide the dock there to match
        // the web app-shell rule `{!isHome && <SpotlightDock />}`. Dock
        // reappears the moment the user lands on any module route.
        if (state.index === 0) return null
        return (
          <SpotlightDock
            key={`dock-${state.routes[state.index]?.name ?? 'root'}`}
            tabs={TAB_CONFIG}
            activeIndex={state.index}
            isDark={isDark}
            // Module pages land with the dock collapsed — matches web's
            // auto-collapse behaviour. The `key` above forces a fresh mount
            // per route so the collapsed default re-applies on every tab change.
            startCollapsed
            onTabChange={(index: number) => {
              const route = state.routes[index]
              // Database and Admin don't render their own tab screens — they
              // deep-link into the hub home with a domain pre-opened. Keeps
              // a single source of truth for module trees (the hub panel).
              if (route.name === 'settings') {
                router.navigate({ pathname: '/(tabs)/', params: { domain: 'settings' } } as any)
                return
              }
              if (route.name === 'admin') {
                router.navigate({ pathname: '/(tabs)/', params: { domain: 'sysadmin' } } as any)
                return
              }
              if (state.index === index) {
                // Already on this tab — navigate to root to reset stack
                const tabRoute = state.routes[index]
                const nestedState = tabRoute.state
                if (nestedState && nestedState.index != null && nestedState.index > 0) {
                  router.navigate(`/(tabs)/${route.name}` as any)
                }
              } else {
                navigation.navigate(route.name)
              }
            }}
          />
        )
      }}
    >
      {TAB_CONFIG.map(({ name, label }) => (
        <Tabs.Screen key={name} name={name} options={{ title: label }} />
      ))}
    </Tabs>
  )
}
