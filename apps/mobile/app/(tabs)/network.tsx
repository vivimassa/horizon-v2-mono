import { Text, View, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { BreadcrumbHeader } from '../components/breadcrumb-header'

export default function Network() {
  const router = useRouter()
  return (
    <View className="flex-1 bg-white">
      <BreadcrumbHeader moduleCode="1" />
      <View className="flex-1 justify-center items-center gap-4">
        <Text className="text-xl font-semibold text-[#111111]">Network</Text>
        <Text className="text-sm text-[#888888]">Coming soon</Text>
        <Pressable
          onPress={() => router.push('/design-system')}
          className="rounded-lg bg-blue-600 px-4 py-2"
        >
          <Text className="text-white text-sm font-semibold">Design System</Text>
        </Pressable>
      </View>
    </View>
  )
}
