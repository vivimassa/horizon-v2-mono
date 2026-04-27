import { useEffect, useState } from 'react'
import { View, Text, ScrollView, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Q } from '@nozbe/watermelondb'
import { useDatabase } from '../../src/providers/DatabaseProvider'
import { syncCrewData } from '../../src/sync/sync-trigger'
import { useCrewOperatorStore } from '../../src/stores/use-crew-operator-store'
import type { CrewAssignmentRecord, PairingRecord, PairingLegRecord } from '@skyhub/crew-db'

interface DutyView {
  assignment: CrewAssignmentRecord
  pairing: PairingRecord | null
  legs: PairingLegRecord[]
}

export default function TodayScreen() {
  const database = useDatabase()
  const accentColor = useCrewOperatorStore((s) => s.accentColor)
  const [refreshing, setRefreshing] = useState(false)
  const [next, setNext] = useState<DutyView | null>(null)

  const load = async () => {
    const now = Date.now()
    const horizon = now + 7 * 86_400_000
    const assignments = (await database
      .get<CrewAssignmentRecord>('crew_assignments')
      .query(
        Q.where('status', Q.notEq('cancelled')),
        Q.where('end_utc_ms', Q.gte(now)),
        Q.where('start_utc_ms', Q.lte(horizon)),
        Q.sortBy('start_utc_ms', Q.asc),
        Q.take(1),
      )
      .fetch()) as CrewAssignmentRecord[]

    const a = assignments[0]
    if (!a) {
      setNext(null)
      return
    }
    const pairing = (await database
      .get<PairingRecord>('pairings')
      .find(a.pairingId)
      .catch(() => null)) as PairingRecord | null
    const legs = (await database
      .get<PairingLegRecord>('pairing_legs')
      .query(Q.where('pairing_id', a.pairingId), Q.sortBy('leg_order', Q.asc))
      .fetch()) as PairingLegRecord[]
    setNext({ assignment: a, pairing, legs })
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
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} />}
      >
        <Text className="text-[28px] font-bold text-black dark:text-white">Today</Text>
        <Text className="mt-1 text-[14px] text-neutral-600 dark:text-neutral-400">Your next duty</Text>

        {!next && (
          <View className="mt-8 items-center rounded-xl bg-card-light p-8 dark:bg-card-dark">
            <Text className="text-[15px] text-neutral-500">No upcoming duty in the next 7 days.</Text>
          </View>
        )}

        {next && (
          <View
            className="mt-6 rounded-xl bg-card-light p-5 dark:bg-card-dark"
            style={{ borderLeftWidth: 3, borderLeftColor: accentColor }}
          >
            <Text className="text-[12px] font-medium uppercase tracking-wide text-neutral-500">
              Pairing {next.pairing?.pairingCode ?? '—'}
            </Text>
            <Text className="mt-1 text-[18px] font-semibold text-black dark:text-white">
              {next.pairing?.baseAirport} → {next.legs[next.legs.length - 1]?.arrStation ?? '—'}
            </Text>
            <Text className="mt-1 text-[13px] text-neutral-500">
              Report {fmtTime(next.pairing?.reportTimeUtcMs ?? next.assignment.startUtcMs)} ·{' '}
              {next.pairing?.numberOfSectors ?? next.legs.length} sectors
            </Text>

            <View className="mt-4 gap-2">
              {next.legs.map((leg) => (
                <View key={leg.id} className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Text className="w-12 text-[13px] font-medium text-neutral-700 dark:text-neutral-200">
                      {leg.flightNumber}
                    </Text>
                    <Text className="text-[13px] text-neutral-500">
                      {leg.depStation} → {leg.arrStation}
                    </Text>
                  </View>
                  <Text className="text-[13px] text-neutral-500">
                    {fmtTime(leg.stdUtcMs)} · {leg.blockMinutes}m
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function fmtTime(ms: number | null): string {
  if (!ms) return '—'
  const d = new Date(ms)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}Z`
}
