import { useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronDown, Clock, Search } from 'lucide-react-native'
import { Chip, FieldLabel, Glass, KVRow, MiniKV, Route } from '../../src/components/primitives'
import { useTheme } from '../../src/theme/use-theme'
import type { Theme } from '../../src/theme/tokens'
import { TYPE } from '../../src/theme/tokens'
import { useDatabase } from '../../src/providers/DatabaseProvider'
import { syncCrewData } from '../../src/sync/sync-trigger'
import { useFlightsDay } from '../../src/data/use-flights-day'
import { usePairingCrew } from '../../src/data/use-pairing-crew'
import { useLegWx } from '../../src/data/use-leg-wx'
import type { PairingLegRecord } from '@skyhub/crew-db'
import { addDaysLocal, fmtBlock, fmtTime, isoLocal, startOfDayLocal } from '../../src/data/format'

const DAY_RANGE_BACK = 1
const DAY_RANGE_FWD = 5

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export default function FlightsTab() {
  const t = useTheme()
  const database = useDatabase()
  const today = startOfDayLocal(new Date())

  const dates = useMemo(() => {
    const arr: { iso: string; dow: string; dom: string; ms: number; isToday: boolean }[] = []
    for (let i = -DAY_RANGE_BACK; i <= DAY_RANGE_FWD; i++) {
      const d = addDaysLocal(today, i)
      arr.push({
        iso: isoLocal(d),
        dow: DOW[d.getDay()]!,
        dom: String(d.getDate()).padStart(2, '0'),
        ms: d.getTime(),
        isToday: i === 0,
      })
    }
    return arr
  }, [])

  const [selectedIso, setSelectedIso] = useState(isoLocal(today))
  const selectedMs = dates.find((d) => d.iso === selectedIso)?.ms ?? today.getTime()

  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const data = useFlightsDay(database, selectedMs, refreshKey)

  const [expanded, setExpanded] = useState<string | null>(null)

  const onRefresh = async () => {
    setRefreshing(true)
    await syncCrewData(database, true)
    setRefreshKey((k) => k + 1)
    setRefreshing(false)
  }

  const dayBlock = data.legs.reduce((s, l) => s + (l.blockMinutes ?? 0), 0)
  const reportMs = data.legs[0]?.stdUtcMs ? data.legs[0].stdUtcMs - 60 * 60 * 1000 : null
  const pairingCode = data.legs[0]?.pairingId ? 'H' + data.legs[0]!.pairingId.slice(-3).toUpperCase() : null

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 120, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Title row */}
        <View
          style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View>
            <Text style={{ ...TYPE.pageTitle, color: t.text }}>Flights</Text>
            <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 2 }}>
              {new Date(selectedMs).toLocaleDateString(undefined, {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          </View>
          <Glass tier="soft" padding={0} style={{ width: 36, height: 36, borderRadius: 18 }}>
            <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
              <Search color={t.text} size={16} />
            </View>
          </Glass>
        </View>

        {/* Date strip — vertical pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {dates.map((d) => {
            const sel = d.iso === selectedIso
            return (
              <Pressable key={d.iso} onPress={() => setSelectedIso(d.iso)}>
                {sel ? (
                  <View
                    style={{
                      width: 48,
                      height: 64,
                      borderRadius: 14,
                      backgroundColor: t.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: '#fff', opacity: 0.85 }}>
                      {d.dow}
                    </Text>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>{d.dom}</Text>
                  </View>
                ) : (
                  <Glass tier="soft" padding={0} style={{ width: 48, height: 64, borderRadius: 14 }}>
                    <View style={{ width: 48, height: 64, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: t.textSec }}>
                        {d.dow}
                      </Text>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: t.text }}>{d.dom}</Text>
                    </View>
                  </Glass>
                )}
              </Pressable>
            )
          })}
        </ScrollView>

        {/* Pairing summary hero */}
        {data.legs.length > 0 && reportMs != null && pairingCode && (
          <View style={{ paddingHorizontal: 16 }}>
            <Glass tier="hero" padding={16}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ color: t.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 }}>
                    PAIRING {pairingCode}
                  </Text>
                  <Text style={{ color: t.text, fontSize: 17, fontWeight: '700', marginTop: 4, letterSpacing: -0.3 }}>
                    {data.legs.length} sector{data.legs.length === 1 ? '' : 's'} · {fmtBlock(dayBlock)} block
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ ...TYPE.caption, color: t.textSec }}>Report</Text>
                  <Text style={{ color: t.text, fontSize: 15, fontWeight: '700', marginTop: 2 }}>
                    {fmtTime(reportMs)}L
                  </Text>
                </View>
              </View>
            </Glass>
          </View>
        )}

        {/* Flight cards */}
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          {data.legs.length === 0 && !data.loading && (
            <Glass tier="soft" padding={20}>
              <Text style={{ ...TYPE.caption, color: t.textSec, textAlign: 'center' }}>No flights this day</Text>
            </Glass>
          )}
          {data.legs.map((leg, i) => (
            <View key={leg.id}>
              <FlightCard
                t={t}
                leg={leg}
                expanded={expanded === leg.id}
                onToggle={() => setExpanded((x) => (x === leg.id ? null : leg.id))}
              />
              {i < data.legs.length - 1 && (
                <GroundChip t={t} fromMs={leg.staUtcMs} toMs={data.legs[i + 1]!.stdUtcMs} airport={leg.arrStation} />
              )}
            </View>
          ))}
        </View>

        {/* Day summary */}
        {data.legs.length > 0 && (
          <View style={{ paddingHorizontal: 16 }}>
            <Glass tier="standard" padding={12}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 32,
                    backgroundColor: t.accent + '22',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Clock color={t.accent} size={16} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...TYPE.caption, color: t.textSec }}>Day Summary</Text>
                  <Text style={{ color: t.text, fontWeight: '600', fontSize: 13, marginTop: 2 }}>
                    {data.legs.length} sector{data.legs.length === 1 ? '' : 's'} · {fmtBlock(dayBlock)} block
                  </Text>
                </View>
              </View>
            </Glass>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function GroundChip({ t, fromMs, toMs, airport }: { t: Theme; fromMs: number; toMs: number; airport: string }) {
  const minutes = Math.max(0, Math.round((toMs - fromMs) / 60_000))
  return (
    <View style={{ alignItems: 'center', paddingVertical: 4 }}>
      <Glass tier="soft" padding={0} style={{ borderRadius: 999 }}>
        <View
          style={{
            paddingHorizontal: 12,
            paddingVertical: 5,
            flexDirection: 'row',
            gap: 6,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: t.textSec }}>GROUND</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: t.text }}>{fmtBlock(minutes)}</Text>
          <Text style={{ fontSize: 13, color: t.textSec }}>at {airport}</Text>
        </View>
      </Glass>
    </View>
  )
}

function FlightCard({
  t,
  leg,
  expanded,
  onToggle,
}: {
  t: Theme
  leg: PairingLegRecord
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <Glass tier={expanded ? 'hero' : 'standard'} padding={0}>
      <Pressable onPress={onToggle} style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: t.text, fontSize: 14, fontWeight: '700' }}>{leg.flightNumber}</Text>
            <Text style={{ ...TYPE.caption, color: t.textSec }}>· {leg.aircraftTypeIcao ?? '—'}</Text>
            {leg.isDeadhead && (
              <View
                style={{
                  backgroundColor: t.duty.ground + '22',
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: 4,
                }}
              >
                <Text style={{ ...TYPE.badge, color: t.duty.ground, fontSize: 10 }}>DH</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Chip t={t} kind="ontime">
              On Time
            </Chip>
            <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
              <ChevronDown color={t.textTer} size={16} />
            </View>
          </View>
        </View>
        <Route
          t={t}
          dep={leg.depStation}
          arr={leg.arrStation}
          depTime={fmtTime(leg.stdUtcMs)}
          arrTime={fmtTime(leg.staUtcMs)}
          accent={t.duty.flight}
          big={false}
        />
        {!expanded && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
            <Text style={{ ...TYPE.caption, color: t.textSec }}>
              {leg.aircraftTypeIcao ?? '—'} · {leg.tailNumber ?? '—'} · {fmtBlock(leg.blockMinutes)}
            </Text>
            <Text style={{ ...TYPE.caption, color: t.text, fontWeight: '600' }}>Sector {leg.legOrder}</Text>
          </View>
        )}
      </Pressable>

      {expanded && <ExpandedSections t={t} leg={leg} />}
    </Glass>
  )
}

function ExpandedSections({ t, leg }: { t: Theme; leg: PairingLegRecord }) {
  const wxQ = useLegWx(leg.depStation, leg.arrStation)
  const crewQ = usePairingCrew(leg.pairingId)
  const wx = wxQ.data
  const crewList = crewQ.data?.crew ?? []
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: t.border, padding: 14, gap: 14 }}>
      <View>
        <FieldLabel t={t}>Preflight</FieldLabel>
        <View style={{ gap: 8, marginTop: 8 }}>
          <KVRow t={t} k={`METAR ${leg.depStation}`} v={wx?.metarDep ?? '—'} mono />
          <KVRow t={t} k={`METAR ${leg.arrStation}`} v={wx?.metarArr ?? '—'} mono />
          <KVRow t={t} k={`TAF ${leg.depStation}`} v={wx?.tafDep ?? '—'} mono />
        </View>
      </View>

      <View>
        <FieldLabel t={t}>Crew</FieldLabel>
        <View style={{ marginTop: 8 }}>
          {crewQ.isLoading ? (
            <Text style={{ ...TYPE.caption, color: t.textSec }}>Loading…</Text>
          ) : crewList.length === 0 ? (
            <Text style={{ ...TYPE.caption, color: t.textSec }}>No other crew assigned.</Text>
          ) : (
            <View style={{ gap: 6 }}>
              {crewList.map((c) => (
                <View key={c.crewId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View
                    style={{
                      backgroundColor: t.accent + '22',
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 6,
                      minWidth: 38,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ ...TYPE.badge, color: t.accent }}>{c.positionCode ?? '—'}</Text>
                  </View>
                  <Text style={{ color: t.text, fontSize: 14 }}>
                    {c.firstName} {c.lastName}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      <View>
        <FieldLabel t={t}>Operations</FieldLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
          {[
            { label: 'STD', value: fmtTime(leg.stdUtcMs) },
            { label: 'STA', value: fmtTime(leg.staUtcMs) },
            { label: 'Block', value: fmtBlock(leg.blockMinutes) },
            { label: 'Tail', value: leg.tailNumber ?? '—' },
            { label: 'Aircraft', value: leg.aircraftTypeIcao ?? '—' },
            { label: 'Date', value: leg.flightDate },
          ].map((kv) => (
            <View key={kv.label} style={{ width: '50%', paddingVertical: 5 }}>
              <MiniKV t={t} label={kv.label} value={kv.value} />
            </View>
          ))}
        </View>
      </View>

      {/* Action buttons */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
        <Glass tier="soft" padding={0} style={{ flex: 1, height: 40, borderRadius: 10 }}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: t.text, fontSize: 13, fontWeight: '600' }}>Briefing</Text>
          </View>
        </Glass>
        <View
          style={{
            flex: 1,
            height: 40,
            borderRadius: 10,
            backgroundColor: t.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Open Duty</Text>
        </View>
      </View>
    </View>
  )
}
