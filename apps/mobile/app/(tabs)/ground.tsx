import { Text, View } from 'react-native'
import { BreadcrumbHeader } from '../components/breadcrumb-header'

export default function Ground() {
  return (
    <View className="flex-1 bg-white">
      <BreadcrumbHeader moduleCode="5" />
      <View className="flex-1 justify-center items-center">
        <Text className="text-xl font-semibold">Ground</Text>
      </View>
    </View>
  )
}
