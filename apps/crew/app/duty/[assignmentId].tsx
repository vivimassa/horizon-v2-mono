import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Dimensions, FlatList, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChevronLeft, MapPin } from 'lucide-react-native'
import { Q } from '@nozbe/watermelondb'
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps'
import type { CrewAssignmentRecord, PairingRecord, PairingLegRecord } from '@skyhub/crew-db'
import { Card, Chip, FieldLabel, MiniKV, Route } from '../../src/components/primitives'
import { useTheme } from '../../src/theme/use-theme'
import type { Theme } from '../../src/theme/tokens'
import { TYPE } from '../../src/theme/tokens'
import { useDatabase } from '../../src/providers/DatabaseProvider'
import { fmtBlock, fmtTime } from '../../src/data/format'
import { lookupAirport } from '../../src/data/airport-coords'

export default function DutyDetail() {
  const t = useTheme()
  const router = useRouter()
  const database = useDatabase()
  const { assignmentId } = useLocalSearchParams<{ assignmentId: string }>()

  const [assignment, setAssignment] = useState<CrewAssignmentRecord | null>(null)
  const [pairing, setPairing] = useState<PairingRecord | null>(null)
  const [legs, setLegs] = useState<PairingLegRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [pageIdx, setPageIdx] = useState(0)
  const listRef = useRef<FlatList<PairingLegRecord>>(null)
  const screenWidth = Dimensions.get('window').width

  useEffect(() => {
    if (!assignmentId) return
    void (async () => {
      try {
        const a = (await database
          .get<CrewAssignmentRecord>('crew_assignments')
          .find(assignmentId)) as CrewAssignmentRecord
        setAssignment(a)
        const p = (await database
          .get<PairingRecord>('pairings')
          .find(a.pairingId)
          .catch(() => null)) as PairingRecord | null
        setPairing(p)
        const ls = (await database
          .get<PairingLegRecord>('pairing_legs')
          .query(Q.where('pairing_id', a.pairingId), Q.sortBy('leg_order', Q.asc))
          .fetch()) as PairingLegRecord[]
        setLegs(ls)
      } catch (err) {
        console.warn('[duty]', (err as Error).message)
      } finally {
        setLoading(false)
      }
    })()
  }, [assignmentId, database])

  const currentLeg = legs[pageIdx] ?? null
  const totalBlock = legs.reduce((s, l) => s + (l.blockMinutes ?? 0), 0)

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

        {loading || !assignment ? (
          <Card t={t} padding={20}>
            <ActivityIndicator color={t.accent} />
          </Card>
        ) : (
          <>
            {/* Header */}
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ ...TYPE.pageTitle, color: t.text }}>{pairing?.pairingCode ?? '—'}</Text>
                <Chip t={t} kind="scheduled">
                  {assignment.status}
                </Chip>
              </View>
              <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 4 }}>
                {pairing?.baseAirport ?? '—'} Base · {pairing?.aircraftTypeIcao ?? '—'} · {legs.length} sector
                {legs.length === 1 ? '' : 's'} · {fmtBlock(totalBlock)} block
              </Text>
            </View>

            {/* Map of current sector */}
            {currentLeg && (
              <Card t={t} padding={0}>
                <SectorMap leg={currentLeg} t={t} />
              </Card>
            )}

            {/* Sector pager */}
            <View style={{ gap: 10 }}>
              <FieldLabel t={t}>Sectors</FieldLabel>
              <Card t={t} padding={0}>
                <FlatList
                  ref={listRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  data={legs}
                  keyExtractor={(l) => l.id}
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / (screenWidth - 32))
                    setPageIdx(idx)
                  }}
                  getItemLayout={(_, i) => ({ length: screenWidth - 32, offset: (screenWidth - 32) * i, index: i })}
                  renderItem={({ item: leg }) => (
                    <View style={{ width: screenWidth - 32, padding: 16, gap: 14 }}>
                      <Route
                        t={t}
                        dep={leg.depStation}
                        arr={leg.arrStation}
                        depTime={fmtTime(leg.stdUtcMs)}
                        arrTime={fmtTime(leg.staUtcMs)}
                        accent={t.duty.flight}
                      />
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        {[
                          { label: 'Flight', value: leg.flightNumber },
                          { label: 'Date', value: leg.flightDate },
                          { label: 'Aircraft', value: leg.aircraftTypeIcao ?? '—' },
                          { label: 'Tail', value: leg.tailNumber ?? '—' },
                          { label: 'STD', value: fmtTime(leg.stdUtcMs) },
                          { label: 'STA', value: fmtTime(leg.staUtcMs) },
                          { label: 'Block', value: fmtBlock(leg.blockMinutes) },
                          { label: 'Sector', value: `${leg.legOrder} of ${legs.length}` },
                        ].map((kv) => (
                          <View key={kv.label} style={{ width: '50%', paddingVertical: 6 }}>
                            <MiniKV t={t} label={kv.label} value={kv.value} />
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                />
              </Card>
              {legs.length > 1 && (
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                  {legs.map((_, i) => (
                    <View
                      key={i}
                      style={{
                        width: i === pageIdx ? 18 : 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: i === pageIdx ? t.accent : t.border,
                      }}
                    />
                  ))}
                </View>
              )}
            </View>

            {/* Pairing summary */}
            <Card t={t} padding={14}>
              <FieldLabel t={t}>Pairing summary</FieldLabel>
              <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap' }}>
                {[
                  { label: 'Report', value: pairing?.reportTimeUtcMs ? fmtTime(pairing.reportTimeUtcMs) : '—' },
                  { label: 'Release', value: pairing?.releaseTimeUtcMs ? fmtTime(pairing.releaseTimeUtcMs) : '—' },
                  { label: 'Sectors', value: String(legs.length) },
                  { label: 'Block', value: fmtBlock(totalBlock) },
                ].map((kv) => (
                  <View key={kv.label} style={{ width: '50%', paddingVertical: 6 }}>
                    <MiniKV t={t} label={kv.label} value={kv.value} />
                  </View>
                ))}
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function SectorMap({ leg, t }: { leg: PairingLegRecord; t: Theme }) {
  const dep = lookupAirport(leg.depStation)
  const arr = lookupAirport(leg.arrStation)

  if (!dep || !arr) {
    return (
      <View
        style={{
          height: 220,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: t.hover,
          borderRadius: 12,
          gap: 6,
        }}
      >
        <MapPin color={t.textSec} size={22} />
        <Text style={{ ...TYPE.caption, color: t.textSec }}>
          Map unavailable for {leg.depStation} → {leg.arrStation}
        </Text>
      </View>
    )
  }

  const midLat = (dep.lat + arr.lat) / 2
  const midLng = (dep.lng + arr.lng) / 2
  const latDelta = Math.max(2, Math.abs(dep.lat - arr.lat) * 1.6)
  const lngDelta = Math.max(2, Math.abs(dep.lng - arr.lng) * 1.6)

  return (
    <MapView
      provider={PROVIDER_DEFAULT}
      style={{ height: 220, borderRadius: 12 }}
      initialRegion={{
        latitude: midLat,
        longitude: midLng,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta,
      }}
      pointerEvents="none"
    >
      <Marker coordinate={{ latitude: dep.lat, longitude: dep.lng }} title={leg.depStation} />
      <Marker coordinate={{ latitude: arr.lat, longitude: arr.lng }} title={leg.arrStation} />
      <Polyline
        coordinates={[
          { latitude: dep.lat, longitude: dep.lng },
          { latitude: arr.lat, longitude: arr.lng },
        ]}
        strokeColor={t.accent}
        strokeWidth={3}
      />
    </MapView>
  )
}
