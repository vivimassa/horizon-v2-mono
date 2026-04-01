import { Text, View } from 'react-native'
import { BreadcrumbHeader } from '../../components/breadcrumb-header'

export default function CrewOps() {
  return (
    <View className="flex-1 bg-white">
      <BreadcrumbHeader moduleCode="3" />
      <View className="flex-1 justify-center items-center">
        <Text className="text-xl font-semibold text-[#111111]">Crew Ops</Text>
        <Text className="text-sm text-[#888888] mt-1">Coming soon</Text>
      </View>
    </View>
  )
}
