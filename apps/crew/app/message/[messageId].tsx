import { useEffect, useState } from 'react'
import { View, Text, ScrollView, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useDatabase } from '../../src/providers/DatabaseProvider'
import { syncCrewData } from '../../src/sync/sync-trigger'
import type { CrewMessageRecord } from '@skyhub/crew-db'

export default function MessageDetail() {
  const { messageId } = useLocalSearchParams<{ messageId: string }>()
  const database = useDatabase()
  const [msg, setMsg] = useState<CrewMessageRecord | null>(null)

  useEffect(() => {
    if (!messageId) return
    void (async () => {
      try {
        const m = (await database.get<CrewMessageRecord>('crew_messages').find(messageId)) as CrewMessageRecord
        setMsg(m)
        if (!m.isRead) {
          await m.markRead()
          // Push the read receipt back to the server on next sync window.
          void syncCrewData(database, true)
        }
      } catch (err) {
        console.warn('[message] not found locally', (err as Error).message)
      }
    })()
  }, [messageId, database])

  if (!msg) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-page-light dark:bg-page-dark">
        <ActivityIndicator />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-page-light dark:bg-page-dark">
      <Stack.Screen options={{ title: msg.subject ?? 'Message' }} />
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text className="text-[20px] font-bold text-black dark:text-white">
          {msg.subject ?? 'Message from Crew Control'}
        </Text>
        <Text className="mt-2 text-[12px] text-neutral-500">{new Date(msg.createdAtMs).toLocaleString()}</Text>
        <Text className="mt-6 text-[15px] leading-relaxed text-black dark:text-white">{msg.body}</Text>
      </ScrollView>
    </SafeAreaView>
  )
}
