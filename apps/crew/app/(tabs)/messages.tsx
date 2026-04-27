import { useEffect, useState } from 'react'
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Q } from '@nozbe/watermelondb'
import { useRouter } from 'expo-router'
import { useDatabase } from '../../src/providers/DatabaseProvider'
import { syncCrewData } from '../../src/sync/sync-trigger'
import { useCrewOperatorStore } from '../../src/stores/use-crew-operator-store'
import type { CrewMessageRecord } from '@skyhub/crew-db'

export default function MessagesScreen() {
  const database = useDatabase()
  const router = useRouter()
  const accentColor = useCrewOperatorStore((s) => s.accentColor)
  const [messages, setMessages] = useState<CrewMessageRecord[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    const rows = (await database
      .get<CrewMessageRecord>('crew_messages')
      .query(Q.sortBy('created_at_ms', Q.desc))
      .fetch()) as CrewMessageRecord[]
    setMessages(rows)
  }

  useEffect(() => {
    void load()
  }, [database])

  const onRefresh = async () => {
    setRefreshing(true)
    await syncCrewData(database, true)
    await load()
    setRefreshing(false)
  }

  return (
    <SafeAreaView className="flex-1 bg-page-light dark:bg-page-dark">
      <View className="px-4 pt-4">
        <Text className="text-[24px] font-bold text-black dark:text-white">Messages</Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/message/${item.id}`)}
            className="rounded-lg bg-card-light p-4 dark:bg-card-dark"
            style={item.isRead ? undefined : { borderLeftWidth: 3, borderLeftColor: accentColor }}
          >
            <View className="flex-row items-center justify-between">
              <Text
                className={`flex-1 text-[15px] ${item.isRead ? 'text-neutral-700 dark:text-neutral-300' : 'font-semibold text-black dark:text-white'}`}
                numberOfLines={1}
              >
                {item.subject ?? 'Message from Crew Control'}
              </Text>
              <Text className="ml-3 text-[12px] text-neutral-500">
                {new Date(item.createdAtMs).toLocaleDateString()}
              </Text>
            </View>
            <Text className="mt-1 text-[13px] text-neutral-500" numberOfLines={2}>
              {item.body}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="items-center pt-16">
            <Text className="text-[14px] text-neutral-500">No messages.</Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}
