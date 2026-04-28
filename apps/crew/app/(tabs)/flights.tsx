import { useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronDown, Clock } from 'lucide-react-native'
import { Card, Chip, FieldLabel, KVRow, MiniKV, Route } from '../../src/components/primitives'
import { useTheme } from '../../src/theme/use-theme'
import type { Theme } from '../../src/theme/tokens'
import { TYPE } from '../../src/theme/tokens'
import { useDatabase } from '../../src/providers/DatabaseProvider'
import { syncCrewData } from '../../src/sync/sync-trigger'
import { useFlightsDay } from '../../src/data/use-flights-day'
import { usePairingCrew } from '../../src/data/use-pairing-crew'
import { useLegWx } from '../../src/data/use-leg-wx'
import type { PairingLegRecord } from '@skyhub/crew-db'
import { addDaysLocal, fmtBlock, fmtDateShort, fmtTime, isoLocal, startOfDayLocal } from '../../src/data/format'

const DAY_RANGE_BACK = 1
const DAY_RANGE_FWD = 5

export default function FlightsTab() {
  const t = useTheme()
  const database = useDatabase()
  const today = startOfDayLocal(new Date())

  const dates = useMemo(() => {
    const arr: { iso: string; label: string; ms: number }[] = []
    for (let i = -DAY_RANGE_BACK; i <= DAY_RANGE_FWD; i++) {
      const d = addDaysLocal(today, i)
      arr.push({
        iso: isoLocal(d),
        label: i === 0 ? `${fmtDateShort(d.getTime())} · Today` : fmtDateShort(d.getTime()),
        ms: d.getTime(),
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 40, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ ...TYPE.pageTitle, color: t.text }}>Flights</Text>
        </View>

        {/* Date strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {dates.map((d) => {
            const sel = d.iso === selectedIso
            return (
              <Pressable
                key={d.iso}
                onPress={() => setSelectedIso(d.iso)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: sel ? t.accent : t.card,
                  borderWidth: 0.5,
                  borderColor: sel ? t.accent : t.cardBorder,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: sel ? '#fff' : t.text }}>{d.label}</Text>
              </Pressable>
            )
          })}
        </ScrollView>

        {/* Flight cards */}
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {data.legs.length === 0 && !data.loading && (
            <Card t={t} padding={20}>
              <Text style={{ ...TYPE.caption, color: t.textSec, textAlign: 'center' }}>No flights this day</Text>
            </Card>
          )}
          {data.legs.map((leg) => (
            <FlightCard
              key={leg.id}
              t={t}
              leg={leg}
              expanded={expanded === leg.id}
              onToggle={() => setExpanded((x) => (x === leg.id ? null : leg.id))}
            />
          ))}
        </View>

        {/* Day summary */}
        {data.legs.length > 0 && (
          <View style={{ paddingHorizontal: 16 }}>
            <Card t={t} padding={12}>
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
            </Card>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
    <Card t={t} padding={0}>
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
            <Chip t={t} kind="scheduled">
              Scheduled
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
          <Text style={{ ...TYPE.caption, color: t.textSec }}>
            Block <Text style={{ color: t.text, fontWeight: '600' }}>{fmtBlock(leg.blockMinutes)}</Text>
          </Text>
          <Text style={{ ...TYPE.caption, color: t.textSec }}>
            Tail <Text style={{ color: t.text, fontWeight: '600' }}>{leg.tailNumber ?? '—'}</Text>
          </Text>
          <Text style={{ ...TYPE.caption, color: t.textSec }}>
            Sector <Text style={{ color: t.text, fontWeight: '600' }}>{leg.legOrder}</Text>
          </Text>
        </View>
      </Pressable>

      {expanded && <ExpandedSections t={t} leg={leg} />}
    </Card>
  )
}

function ExpandedSections({ t, leg }: { t: Theme; leg: PairingLegRecord }) {
  const wxQ = useLegWx(leg.depStation, leg.arrStation)
  const crewQ = usePairingCrew(leg.pairingId)
  const wx = wxQ.data
  const crewList = crewQ.data?.crew ?? []
  return (
    <View style={{ borderTopWidth: 0.5, borderTopColor: t.border, backgroundColor: t.overlay }}>
      <ExpandSection t={t} title="Preflight">
        <View style={{ gap: 8 }}>
          <KVRow t={t} k={`METAR ${leg.depStation}`} v={wx?.metarDep ?? '—'} mono />
          <KVRow t={t} k={`METAR ${leg.arrStation}`} v={wx?.metarArr ?? '—'} mono />
          <KVRow t={t} k={`TAF ${leg.depStation}`} v={wx?.tafDep ?? '—'} mono />
          <KVRow
            t={t}
            k="Aircraft"
            v={leg.aircraftTypeIcao ? `${leg.aircraftTypeIcao} · ${leg.tailNumber ?? '—'}` : '—'}
          />
        </View>
      </ExpandSection>
      <ExpandSection t={t} title="Crew">
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
      </ExpandSection>
      <ExpandSection t={t} title="Operations">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {[
            { label: 'Gate', value: '—' },
            { label: 'Stand', value: '—' },
            { label: 'Pax', value: '—' },
            { label: 'Cargo', value: '—' },
            { label: 'Fuel', value: '—' },
            { label: 'MEL', value: '—' },
          ].map((kv) => (
            <View key={kv.label} style={{ width: '50%', paddingVertical: 5 }}>
              <MiniKV t={t} label={kv.label} value={kv.value} />
            </View>
          ))}
        </View>
      </ExpandSection>
      <ExpandSection t={t} title="Timing" last>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {[
            { label: 'STD', value: fmtTime(leg.stdUtcMs) },
            { label: 'STA', value: fmtTime(leg.staUtcMs) },
            { label: 'Block', value: fmtBlock(leg.blockMinutes) },
            { label: 'Date', value: leg.flightDate },
          ].map((kv) => (
            <View key={kv.label} style={{ width: '50%', paddingVertical: 5 }}>
              <MiniKV t={t} label={kv.label} value={kv.value} />
            </View>
          ))}
        </View>
      </ExpandSection>
    </View>
  )
}

function ExpandSection({
  t,
  title,
  children,
  last,
}: {
  t: Theme
  title: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <View
      style={{
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 0.5,
        borderBottomColor: t.border,
      }}
    >
      <FieldLabel t={t} style={{ marginBottom: 8 }}>
        {title}
      </FieldLabel>
      {children}
    </View>
  )
}
