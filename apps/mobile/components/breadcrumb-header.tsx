import { View, Text, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, usePathname } from 'expo-router'
import { getBreadcrumbChain } from '@skyhub/constants'
import { useAppTheme } from '../providers/ThemeProvider'
import { TabletBreadcrumb } from './tablet-breadcrumb'

/**
 * Map mobile Expo Router paths to web-style paths that match navData routes.
 * Mobile file-based routing doesn't always match the nav tree hierarchy.
 */
const MOBILE_ROUTE_MAP: Record<string, string> = {
  // Network
  '/network': '/network',
  '/network/schedule-grid': '/network/control/schedule-grid',
  '/network/schedule-flight-detail': '/network/control/schedule-grid',
  // Ground Ops
  '/ground-ops': '/ground-ops',
  '/ground-ops/cargo-loading': '/ground-ops/cargo/cargo-manifest',
  // Settings
  '/settings': '/settings/account/profile',
  '/settings/profile': '/settings/account/profile',
  '/settings/preferences': '/settings/account/appearance',
  '/settings/security': '/settings/account/security',
  '/settings/operator-config': '/settings/admin/operator-config',
  // Master Database
  '/settings/master-database': '/admin',
  '/settings/countries': '/admin/countries',
  '/settings/country-detail': '/admin/countries',
  '/settings/airports': '/admin/airports',
  '/settings/airport-detail': '/admin/airports',
  '/settings/airport-add': '/admin/airports',
  '/settings/citypairs': '/admin/city-pairs',
  '/settings/citypair-detail': '/admin/city-pairs',
  '/settings/lopa': '/admin/lopa',
  '/settings/cabin-class-detail': '/admin/lopa',
  '/settings/cabin-class-add': '/admin/lopa',
  '/settings/lopa-config-detail': '/admin/lopa',
  '/settings/lopa-config-add': '/admin/lopa',
  '/settings/service-types': '/admin/service-types',
  '/settings/service-type-detail': '/admin/service-types',
  '/settings/service-type-add': '/admin/service-types',
  '/settings/aircraft-types': '/admin/aircraft-types',
  '/settings/aircraft-type-detail': '/admin/aircraft-types',
  '/settings/aircraft-type-add': '/admin/aircraft-types',
  '/settings/aircraft-registrations': '/admin/aircraft-registrations',
  '/settings/aircraft-registration-detail': '/admin/aircraft-registrations',
  '/settings/aircraft-registration-add': '/admin/aircraft-registrations',
  '/settings/delay-codes': '/admin/delay-codes',
  '/settings/delay-code-detail': '/admin/delay-codes',
  '/settings/delay-code-add': '/admin/delay-codes',
}

/**
 * Reverse map: web navData routes → mobile Expo Router paths.
 * Built from MOBILE_ROUTE_MAP, picking the shortest mobile path per web route.
 */
const WEB_TO_MOBILE_MAP: Record<string, string> = {}
for (const [mobilePath, webPath] of Object.entries(MOBILE_ROUTE_MAP)) {
  // Only keep the shortest (canonical) mobile path for each web route
  if (!WEB_TO_MOBILE_MAP[webPath] || mobilePath.length < WEB_TO_MOBILE_MAP[webPath].length) {
    WEB_TO_MOBILE_MAP[webPath] = mobilePath
  }
}

function resolveNavigationRoute(webRoute: string): string {
  // Direct reverse lookup
  const mobilePath = WEB_TO_MOBILE_MAP[webRoute]
  if (mobilePath) return `/(tabs)${mobilePath}`
  // Fallback: if it starts with /admin/, try mapping to settings
  if (webRoute.startsWith('/admin/')) {
    const slug = webRoute.replace('/admin/', '')
    return `/(tabs)/settings/${slug}`
  }
  return webRoute
}

const logo = require('../assets/skyhub-logo.png')

interface BreadcrumbHeaderProps {
  moduleCode: string
}

export function BreadcrumbHeader({ moduleCode }: BreadcrumbHeaderProps) {
  const { palette, accent, isDark, isTablet } = useAppTheme()
  const router = useRouter()
  const pathname = usePathname()

  // Map mobile paths to web-style paths for nav tree resolution
  const resolvedPath = MOBILE_ROUTE_MAP[pathname] ?? pathname

  // Tablet: use the new pill-segment breadcrumb
  if (isTablet) {
    return (
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
          <TabletBreadcrumb
            pathname={resolvedPath}
            palette={palette}
            isDark={isDark}
            accent={accent}
            onNavigate={(route) => router.push(resolveNavigationRoute(route) as any)}
          />
          <Image
            source={logo}
            style={{
              width: 150,
              height: 40,
              opacity: isDark ? 0.85 : 0.9,
              marginRight: -30,
              tintColor: isDark ? '#ffffff' : undefined,
            }}
            resizeMode="contain"
          />
        </View>
      </SafeAreaView>
    )
  }

  // Phone: no breadcrumbs, but still provide safe area top spacing
  return <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }} />
}
