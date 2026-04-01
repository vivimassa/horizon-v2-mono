import { Text, View } from 'react-native'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'
import { useAppTheme } from '../../../providers/ThemeProvider'

export default function CrewOps() {
  const { palette, fonts } = useAppTheme()
  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <BreadcrumbHeader moduleCode="3" />
      <View className="flex-1 justify-center items-center">
        <Text style={{ fontSize: fonts.xl, fontWeight: '600', color: palette.text }}>Crew Ops</Text>
        <Text style={{ fontSize: fonts.sm, color: palette.textSecondary, marginTop: 4 }}>Coming soon</Text>
      </View>
    </View>
  )
}
