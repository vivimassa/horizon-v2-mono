import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import type { CrewActivityRecord } from '@skyhub/crew-db'
import { Card, FieldLabel } from '../../src/components/primitives'
import { useTheme } from '../../src/theme/use-theme'
import { TYPE } from '../../src/theme/tokens'
import { useDatabase } from '../../src/providers/DatabaseProvider'
import { useActivityCodes } from '../../src/data/use-activity-codes'
import { useCrewAuthStore } from '../../src/stores/use-crew-auth-store'
import { fmtBlock, fmtTime } from '../../src/data/format'

export default function ActivityDetail() {
  const t = useTheme()
  const router = useRouter()
  const database = useDatabase()
  const { activityId } = useLocalSearchParams<{ activityId: string }>()
  const profile = useCrewAuthStore((s) => s.profile)
  const { byId } = useActivityCodes()

  const [activity, setActivity] = useState<CrewActivityRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activityId) return
    void (async () => {
      try {
        const a = (await database.get<CrewActivityRecord>('crew_activities').find(activityId)) as CrewActivityRecord
        setActivity(a)
      } catch (err) {
        console.warn('[activity]', (err as Error).message)
      } finally {
        setLoading(false)
      }
    })()
  }, [activityId, database])

  const meta = activity ? byId.get(activity.activityCodeId) : null
  const color = meta?.color ?? t.duty.ground
  const durationMin = activity ? Math.max(0, Math.round((activity.endUtcMs - activity.startUtcMs) / 60_000)) : 0

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}
          hitSlop={8}
        >
          <ChevronLeft color={t.textSec} size={18} />
          <Text style={{ color: t.textSec, fontSize: 14 }}>Back</Text>
        </Pressable>

        {loading || !activity ? (
          <Card t={t} padding={20}>
            <ActivityIndicator color={t.accent} />
          </Card>
        ) : (
          <>
            {/* Hero */}
            <Card t={t} padding={18}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: color + '22',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ ...TYPE.badge, color, fontSize: 14 }}>{meta?.shortLabel ?? meta?.code ?? '—'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontWeight: '700', fontSize: 18, letterSpacing: -0.3 }}>
                    {meta?.name ?? activity.activityCodeId}
                  </Text>
                  <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 4 }}>
                    {meta?.code ?? 'Code'} · {fmtBlock(durationMin)}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Times */}
            <Card t={t} padding={14}>
              <FieldLabel t={t}>Time</FieldLabel>
              <View style={{ marginTop: 10, gap: 8 }}>
                <KV t={t} k="From" v={`${new Date(activity.startUtcMs).toLocaleString()}`} />
                <KV t={t} k="To" v={`${new Date(activity.endUtcMs).toLocaleString()}`} />
                <KV t={t} k="Start" v={fmtTime(activity.startUtcMs)} />
                <KV t={t} k="End" v={fmtTime(activity.endUtcMs)} />
                <KV t={t} k="Duration" v={fmtBlock(durationMin)} />
              </View>
            </Card>

            {/* Base + notes */}
            <Card t={t} padding={14}>
              <FieldLabel t={t}>Where</FieldLabel>
              <View style={{ marginTop: 10, gap: 8 }}>
                <KV t={t} k="Base" v={profile?.base ?? '—'} />
                {meta?.flags && meta.flags.length > 0 && <KV t={t} k="Flags" v={meta.flags.join(', ')} />}
                {activity.notes && <KV t={t} k="Notes" v={activity.notes} />}
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function KV({ t, k, v }: { t: ReturnType<typeof useTheme>; k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ ...TYPE.caption, color: t.textSec }}>{k}</Text>
      <Text style={{ color: t.text, fontSize: 14, fontWeight: '500', flex: 1, textAlign: 'right' }}>{v}</Text>
    </View>
  )
}
