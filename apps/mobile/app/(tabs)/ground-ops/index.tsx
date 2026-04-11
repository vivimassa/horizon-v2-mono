import { Text, View, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { Package, Truck } from 'lucide-react-native'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { accentTint } from '@skyhub/ui/theme'

export default function GroundOps() {
  const { palette, accent, isDark, fonts } = useAppTheme()
  const router = useRouter()

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <BreadcrumbHeader moduleCode="5" />
      <View className="px-4 pt-4">
        <Text style={{ fontSize: fonts.xl, fontWeight: '700', color: palette.text, marginBottom: 4 }}>Ground Ops</Text>
        <Text style={{ fontSize: fonts.sm, color: palette.textSecondary, marginBottom: 20 }}>
          Ground handling &amp; cargo operations
        </Text>

        {/* Cargo Manifest card */}
        <Pressable
          onPress={() => router.push('/(tabs)/ground-ops/cargo-loading')}
          className="rounded-xl overflow-hidden"
          style={{
            backgroundColor: palette.card,
            borderWidth: 1,
            borderColor: palette.cardBorder,
          }}
        >
          <View className="flex-row items-center p-4">
            <View
              className="w-10 h-10 rounded-lg items-center justify-center mr-3"
              style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}
            >
              <Package size={20} color={accent} strokeWidth={1.8} />
            </View>
            <View className="flex-1">
              <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>Cargo Manifest</Text>
              <Text style={{ fontSize: 12, color: palette.textSecondary, marginTop: 2 }}>
                Aircraft loading &amp; cargo distribution
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: palette.textTertiary, fontWeight: '600', fontFamily: 'monospace' }}>
              5.1.1
            </Text>
          </View>
        </Pressable>

        {/* Placeholder for future */}
        <View
          className="rounded-xl mt-3 p-4 flex-row items-center"
          style={{
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
          }}
        >
          <Truck size={20} strokeWidth={1.5} color={palette.textTertiary} />
          <View className="ml-3">
            <Text style={{ fontSize: 13, fontWeight: '500', color: palette.textSecondary }}>More coming soon</Text>
            <Text style={{ fontSize: 11, color: palette.textTertiary, marginTop: 2 }}>
              Turnaround, gate management, ground handling
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}
