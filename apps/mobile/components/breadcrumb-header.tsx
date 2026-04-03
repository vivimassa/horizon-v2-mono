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
  '/ground-ops': '/ground-ops',
  '/ground-ops/cargo-loading': '/ground-ops/cargo/cargo-manifest',
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
            onNavigate={(route) => router.push(route as any)}
          />
          <Image
            source={logo}
            style={{ width: 150, height: 40, opacity: isDark ? 0.85 : 0.9, marginRight: -30, tintColor: isDark ? '#ffffff' : undefined }}
            resizeMode="contain"
          />
        </View>
      </SafeAreaView>
    )
  }

  // Phone: no breadcrumbs, but still provide safe area top spacing
  return <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }} />
}
