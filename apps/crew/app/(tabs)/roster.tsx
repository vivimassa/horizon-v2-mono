import { useEffect, useState } from 'react'
import { View, Text, FlatList, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Q } from '@nozbe/watermelondb'
import { useDatabase } from '../../src/providers/DatabaseProvider'
import { syncCrewData } from '../../src/sync/sync-trigger'
import { useCrewOperatorStore } from '../../src/stores/use-crew-operator-store'
import type { CrewAssignmentRecord, PairingRecord } from '@skyhub/crew-db'

interface RosterItem {
  id: string
  date: string
  pairingCode: string
  base: string
  startMs: number
}

export default function RosterScreen() {
  const database = useDatabase()
  const accentColor = useCrewOperatorStore((s) => s.accentColor)
  const [items, setItems] = useState<RosterItem[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    const from = Date.now() - 30 * 86_400_000
    const to = Date.now() + 90 * 86_400_000
    const assignments = (await database
      .get<CrewAssignmentRecord>('crew_assignments')
      .query(Q.where('end_utc_ms', Q.gte(from)), Q.where('start_utc_ms', Q.lte(to)), Q.sortBy('start_utc_ms', Q.asc))
      .fetch()) as CrewAssignmentRecord[]

    const out: RosterItem[] = []
    for (const a of assignments) {
      const pairing = (await database
        .get<PairingRecord>('pairings')
        .find(a.pairingId)
        .catch(() => null)) as PairingRecord | null
      out.push({
        id: a.id,
        date: new Date(a.startUtcMs).toISOString().slice(0, 10),
        pairingCode: pairing?.pairingCode ?? '—',
        base: pairing?.baseAirport ?? '—',
        startMs: a.startUtcMs,
      })
    }
    setItems(out)
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
        <Text className="text-[24px] font-bold text-black dark:text-white">Roster</Text>
        <Text className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">Last 30 days · Next 90 days</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} />}
        renderItem={({ item }) => (
          <View
            className="flex-row items-center justify-between rounded-lg bg-card-light p-4 dark:bg-card-dark"
            style={{ borderLeftWidth: 3, borderLeftColor: accentColor }}
          >
            <View>
              <Text className="text-[13px] text-neutral-500">{item.date}</Text>
              <Text className="mt-1 text-[15px] font-medium text-black dark:text-white">{item.pairingCode}</Text>
            </View>
            <Text className="text-[13px] text-neutral-500">{item.base}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center pt-16">
            <Text className="text-[14px] text-neutral-500">No duties in window. Pull to refresh.</Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}
