import { useEffect, useState } from 'react'
import { View, Text, FlatList, Pressable, ActivityIndicator, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { crewApi, type OperatorOption } from '../../src/lib/api-client'
import { useCrewOperatorStore } from '../../src/stores/use-crew-operator-store'

export default function OperatorPicker() {
  const router = useRouter()
  const setOperator = useCrewOperatorStore((s) => s.setOperator)
  const [operators, setOperators] = useState<OperatorOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const { operators } = await crewApi.listOperators()
        setOperators(operators)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <SafeAreaView className="flex-1 bg-page-light dark:bg-page-dark">
      <View className="px-6 pt-6">
        <Text className="text-[24px] font-bold text-black dark:text-white">Choose your airline</Text>
        <Text className="mt-1 text-[14px] text-neutral-600 dark:text-neutral-400">You will only see this once.</Text>
      </View>

      {loading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1e40af" />
        </View>
      )}

      {error && (
        <View className="px-6 pt-6">
          <Text className="text-[14px] text-red-500">{error}</Text>
        </View>
      )}

      {!loading && !error && (
        <FlatList
          data={operators}
          keyExtractor={(o) => o.operatorId}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setOperator(item)
                router.replace('/login/eid-pin')
              }}
              className="flex-row items-center gap-3 rounded-xl bg-card-light p-4 dark:bg-card-dark"
              style={{
                shadowColor: '#606170',
                shadowOpacity: 0.06,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 1 },
                elevation: 2,
              }}
            >
              {item.logoUrl ? (
                <Image source={{ uri: item.logoUrl }} className="h-10 w-10 rounded-full" />
              ) : (
                <View
                  className="h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: item.accentColor }}
                >
                  <Text className="text-[14px] font-semibold text-white">
                    {(item.iataCode ?? item.code).slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <View className="flex-1">
                <Text className="text-[15px] font-medium text-black dark:text-white">{item.name}</Text>
                {item.country && (
                  <Text className="text-[13px] text-neutral-500 dark:text-neutral-400">{item.country}</Text>
                )}
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  )
}
