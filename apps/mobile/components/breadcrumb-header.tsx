import { View, Text, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, usePathname } from 'expo-router'
import { getBreadcrumbChain } from '@skyhub/constants'
import { useAppTheme } from '../providers/ThemeProvider'
import { TabletBreadcrumb } from './tablet-breadcrumb'

const logo = require('../assets/skyhub-logo.png')

interface BreadcrumbHeaderProps {
  moduleCode: string
}

export function BreadcrumbHeader({ moduleCode }: BreadcrumbHeaderProps) {
  const { palette, accent, isDark, isTablet } = useAppTheme()
  const router = useRouter()
  const pathname = usePathname()

  // Tablet: use the new pill-segment breadcrumb
  if (isTablet) {
    return (
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
          <TabletBreadcrumb
            pathname={pathname}
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

  // Phone: simple breadcrumb chain (existing behavior)
  const chain = getBreadcrumbChain(moduleCode)
  if (chain.length === 0) return null

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <View className="flex-row items-center flex-1">
          {chain.map((entry, i) => {
            const textColor = isDark ? '#ffffff' : accent

            return (
              <View key={entry.code} className="flex-row items-center">
                {i > 0 && (
                  <Text className="mx-1.5" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : palette.textTertiary, fontSize: 13 }}>
                    {'\u203A'}
                  </Text>
                )}
                <Text style={{ color: textColor, fontSize: 13, fontWeight: '700' }}>
                  {entry.code}
                </Text>
                <Text style={{ color: textColor, fontSize: 13, fontWeight: '400', marginLeft: 4 }}>
                  {entry.name}
                </Text>
              </View>
            )
          })}
        </View>
        <Image
          source={logo}
          style={{ width: 150, height: 40, opacity: isDark ? 0.85 : 0.9, marginRight: -30, tintColor: isDark ? '#ffffff' : undefined }}
          resizeMode="contain"
        />
      </View>
    </SafeAreaView>
  )
}
