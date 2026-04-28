import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Dimensions, FlatList, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChevronLeft, ChevronRight, MapPin, MoreHorizontal } from 'lucide-react-native'
import { Q } from '@nozbe/watermelondb'
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps'
import type { CrewAssignmentRecord, PairingRecord, PairingLegRecord } from '@skyhub/crew-db'
import { Glass, MiniKV, Route } from '../../src/components/primitives'
import { useTheme } from '../../src/theme/use-theme'
import type { Theme } from '../../src/theme/tokens'
import { TYPE } from '../../src/theme/tokens'
import { useDatabase } from '../../src/providers/DatabaseProvider'
import { usePairingCrew } from '../../src/data/use-pairing-crew'
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
  const cardWidth = screenWidth - 32
  const crewQ = usePairingCrew(pairing?.id ?? '')
  const crewList = crewQ.data?.crew ?? []

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
  const sectorChain = legs.length > 0 ? [legs[0]!.depStation, ...legs.map((l) => l.arrStation)].join(' → ') : '—'

  const goSector = (delta: number) => {
    const next = Math.max(0, Math.min(legs.length - 1, pageIdx + delta))
    setPageIdx(next)
    listRef.current?.scrollToOffset({ offset: next * cardWidth, animated: true })
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => router.back()}>
            <Glass tier="soft" padding={0} style={{ width: 36, height: 36, borderRadius: 18 }}>
              <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <ChevronLeft color={t.text} size={18} />
              </View>
            </Glass>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 }}>
              PAIRING {pairing?.pairingCode ?? '—'}
            </Text>
            <Text style={{ color: t.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginTop: 2 }}>
              {sectorChain}
            </Text>
          </View>
          <Glass tier="soft" padding={0} style={{ width: 36, height: 36, borderRadius: 18 }}>
            <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
              <MoreHorizontal color={t.text} size={18} />
            </View>
          </Glass>
        </View>

        {loading || !assignment ? (
          <Glass tier="hero" padding={20}>
            <ActivityIndicator color={t.accent} />
          </Glass>
        ) : (
          <>
            {/* Hero: map + sector pager merged */}
            <Glass tier="hero" padding={0}>
              {currentLeg && <SectorMap leg={currentLeg} t={t} />}

              {/* Sector header */}
              <View
                style={{
                  paddingHorizontal: 14,
                  paddingTop: 12,
                  paddingBottom: 0,
                  borderTopWidth: 1,
                  borderTopColor: t.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.duty.flight }} />
                  <Text style={{ color: t.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 }}>
                    SECTOR {pageIdx + 1} OF {legs.length}
                  </Text>
                </View>
                {legs.length > 1 && (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <SectorChevron t={t} onPress={() => goSector(-1)} disabled={pageIdx === 0}>
                      <ChevronLeft color={t.accent} size={14} />
                    </SectorChevron>
                    <SectorChevron t={t} onPress={() => goSector(1)} disabled={pageIdx === legs.length - 1}>
                      <ChevronRight color={t.accent} size={14} />
                    </SectorChevron>
                  </View>
                )}
              </View>

              {/* Sector pager */}
              <FlatList
                ref={listRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                data={legs}
                keyExtractor={(l) => l.id}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / cardWidth)
                  setPageIdx(idx)
                }}
                getItemLayout={(_, i) => ({ length: cardWidth, offset: cardWidth * i, index: i })}
                renderItem={({ item: leg }) => (
                  <View style={{ width: cardWidth, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14 }}>
                    <Route
                      t={t}
                      dep={leg.depStation}
                      arr={leg.arrStation}
                      depTime={fmtTime(leg.stdUtcMs)}
                      arrTime={fmtTime(leg.staUtcMs)}
                      accent={t.duty.flight}
                    />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
                      {[
                        { label: 'Flight', value: leg.flightNumber },
                        { label: 'Aircraft', value: `${leg.aircraftTypeIcao ?? '—'} · ${leg.tailNumber ?? '—'}` },
                        { label: 'Block', value: fmtBlock(leg.blockMinutes) },
                        { label: 'Date', value: leg.flightDate },
                      ].map((kv) => (
                        <View key={kv.label} style={{ width: '50%', paddingVertical: 5 }}>
                          <MiniKV t={t} label={kv.label} value={kv.value} />
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              />

              {/* Page dots */}
              {legs.length > 1 && (
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                    paddingBottom: 12,
                  }}
                >
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
            </Glass>

            {/* Timeline */}
            <View style={{ gap: 12 }}>
              <Eyebrow t={t}>TIMELINE</Eyebrow>
              <Glass tier="standard" padding={14}>
                <Timeline t={t} legs={legs} pairing={pairing} />
              </Glass>
            </View>

            {/* Crew */}
            {crewList.length > 0 && (
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Eyebrow t={t}>CREW</Eyebrow>
                  <Text style={{ color: t.accent, fontSize: 13, fontWeight: '600' }}>{crewList.length}</Text>
                </View>
                <Glass tier="standard" padding={14}>
                  {crewList.map((c, i) => (
                    <View
                      key={c.crewId}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingVertical: 8,
                        borderBottomWidth: i === crewList.length - 1 ? 0 : 1,
                        borderBottomColor: t.border,
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: pickAvatarColor(t, c.positionCode),
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
                          {(c.firstName?.[0] ?? '') + (c.lastName?.[0] ?? '')}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>
                          {c.firstName} {c.lastName}
                        </Text>
                        <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 2 }}>
                          {c.positionLabel ?? c.positionCode ?? '—'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </Glass>
              </View>
            )}

            {/* Pairing summary */}
            <Glass tier="standard" padding={14}>
              <Eyebrow t={t}>PAIRING SUMMARY</Eyebrow>
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
            </Glass>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function pickAvatarColor(t: Theme, position: string | null): string {
  if (!position) return t.duty.ground
  const code = position.toUpperCase()
  if (code.startsWith('CPT') || code === 'PIC') return t.accent
  if (code === 'FO' || code.startsWith('F/O')) return t.duty.standby
  if (code.startsWith('SCC') || code.startsWith('SC')) return t.duty.rest
  return t.duty.training
}

function Timeline({ t, legs, pairing }: { t: Theme; legs: PairingLegRecord[]; pairing: PairingRecord | null }) {
  const items: { time: string; label: string; kind: 'flight' | 'rest' }[] = []
  if (pairing?.reportTimeUtcMs) {
    items.push({
      time: fmtTime(pairing.reportTimeUtcMs),
      label: `Report at ${legs[0]?.depStation ?? '—'}`,
      kind: 'flight',
    })
  }
  for (const l of legs) {
    items.push({ time: fmtTime(l.stdUtcMs), label: `Off-blocks ${l.flightNumber}`, kind: 'flight' })
    items.push({ time: fmtTime(l.staUtcMs), label: `On-blocks ${l.arrStation}`, kind: 'flight' })
  }
  if (pairing?.releaseTimeUtcMs) {
    items.push({ time: fmtTime(pairing.releaseTimeUtcMs), label: 'Debrief & off-duty', kind: 'rest' })
  }

  return (
    <View>
      {items.map((it, i) => {
        const last = i === items.length - 1
        const color = it.kind === 'flight' ? t.duty.flight : t.duty.rest
        return (
          <View key={i} style={{ flexDirection: 'row', gap: 12, paddingBottom: last ? 0 : 14 }}>
            <Text style={{ width: 50, color: t.textSec, fontSize: 13, fontWeight: '600' }}>{it.time}</Text>
            <View style={{ width: 10, alignItems: 'center' }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginTop: 2 }} />
              {!last && <View style={{ width: 1, flex: 1, backgroundColor: t.border, marginTop: 2 }} />}
            </View>
            <Text style={{ flex: 1, color: t.text, fontSize: 14 }}>{it.label}</Text>
          </View>
        )
      })}
    </View>
  )
}

function SectorChevron({
  t,
  onPress,
  disabled,
  children,
}: {
  t: Theme
  onPress: () => void
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: t.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </Pressable>
  )
}

function Eyebrow({ t, children }: { t: Theme; children: React.ReactNode }) {
  return <Text style={{ color: t.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 }}>{children}</Text>
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
      style={{ height: 220 }}
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
