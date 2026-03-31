import { Text, View } from 'react-native'
import { BreadcrumbHeader } from '../components/breadcrumb-header'

export default function Integration() {
  return (
    <View className="flex-1 bg-white">
      <BreadcrumbHeader moduleCode="6" />
      <View className="flex-1 justify-center items-center">
        <Text className="text-xl font-semibold">Integration</Text>
      </View>
    </View>
  )
}
