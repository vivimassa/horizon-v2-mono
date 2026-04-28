import { useRef, useState } from 'react'
import { Dimensions, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Bell, Briefcase, Check, Coffee, Users } from 'lucide-react-native'
import { Card, Chip, DutyDot, FieldLabel, MiniKV, Ring, Route, SectionHeader } from '../../src/components/primitives'
import { useTheme } from '../../src/theme/use-theme'
import { TYPE } from '../../src/theme/tokens'
import type { Theme } from '../../src/theme/tokens'
import { useDatabase } from '../../src/providers/DatabaseProvider'
import { syncCrewData } from '../../src/sync/sync-trigger'
import { useCrewAuthStore } from '../../src/stores/use-crew-auth-store'
import { useTodayData } from '../../src/data/use-today'
import { useFdtl } from '../../src/data/use-fdtl'
import { fmtBlock, fmtTime, greeting, initials } from '../../src/data/format'
import type { PairingLegRecord } from '@skyhub/crew-db'

export default function HomeTab() {
  const t = useTheme()
  const router = useRouter()
  const database = useDatabase()
  const profile = useCrewAuthStore((s) => s.profile)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const data = useTodayData(database, refreshKey)
  const fdtlQ = useFdtl()

  const onRefresh = async () => {
    setRefreshing(true)
    await syncCrewData(database, true)
    setRefreshKey((k) => k + 1)
    setRefreshing(false)
  }

  const init = initials(profile?.firstName, profile?.lastName)
  const firstName = profile?.firstName ?? 'Crew'
  const base = profile?.base ?? '—'
  const position = profile?.position ?? '—'

  const next = data.nextDuty
  const totalBlock = next?.legs.reduce((s, l) => s + (l.blockMinutes ?? 0), 0) ?? 0
  const reportMs = next?.pairing?.reportTimeUtcMs ?? next?.assignment.startUtcMs ?? null

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header strip */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 40,
              backgroundColor: t.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 }}>{init}</Text>
          </View>

          <Pressable onPress={() => router.push('/(tabs)/messages')} hitSlop={6}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 40,
                backgroundColor: t.card,
                borderWidth: 0.5,
                borderColor: t.cardBorder,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bell color={t.text} size={18} />
            </View>
            {data.unreadMessages > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  paddingHorizontal: 4,
                  backgroundColor: t.status.cancelled.fg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{data.unreadMessages}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Greeting */}
        <View>
          <Text style={{ ...TYPE.pageTitle, color: t.text }}>
            {greeting()}, {firstName}
          </Text>
          <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 4 }}>
            {new Date().toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })} · {base}{' '}
            Base · {position}
          </Text>
        </View>

        {/* Next Duty — sector pager */}
        {next && next.legs.length > 0 ? (
          <NextDutyCard
            t={t}
            pairingCode={next.pairing?.pairingCode ?? '—'}
            legs={next.legs}
            reportMs={reportMs}
            totalBlock={totalBlock}
            onPress={() => router.push(`/duty/${next.assignment.id}`)}
          />
        ) : (
          <Card t={t} padding={20}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ ...TYPE.cardTitle, color: t.text, fontWeight: '600' }}>All clear</Text>
              <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 6 }}>
                No duty scheduled in the next 7 days
              </Text>
            </View>
          </Card>
        )}

        {/* Today's Route — sector by sector + ground time */}
        {data.todaysLegs.length > 0 && (
          <View style={{ gap: 10 }}>
            <SectionHeader t={t}>Today's Route</SectionHeader>
            <TodayRouteList t={t} legs={data.todaysLegs} />
          </View>
        )}

        {/* Duty Limits */}
        <View style={{ gap: 10 }}>
          <SectionHeader t={t} action="Stats →">
            Duty Limits
          </SectionHeader>
          <Card t={t} padding={14}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Ring
                t={t}
                used={(fdtlQ.data?.fdpUsedMinutes ?? 0) / 60}
                limit={(fdtlQ.data?.fdpLimitMinutes ?? 780) / 60}
                size={62}
                stroke={6}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'baseline' }}>
                  <Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }}>
                    {fdtlQ.data ? fmtBlock(fdtlQ.data.fdpUsedMinutes) : '—'}
                  </Text>
                  <Text style={{ color: t.textSec, fontSize: 14 }}>
                    / {fdtlQ.data ? fmtBlock(fdtlQ.data.fdpLimitMinutes) : '—'} FDP
                  </Text>
                </View>
                <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 4 }}>
                  {fdtlQ.data ? fmtBlock(fdtlQ.data.duty7DayMinutes) : '—'} /{' '}
                  {fdtlQ.data ? fmtBlock(fdtlQ.data.duty7DayLimitMinutes) : '—'}{' '}
                  <Text style={{ color: t.textTer }}>· 7-day rolling</Text>
                </Text>
                {fdtlQ.data && fdtlQ.data.fdpUsedMinutes === 0 && (
                  <Text style={{ ...TYPE.caption, color: t.textTer, marginTop: 4, fontStyle: 'italic' }}>
                    No active duty today
                  </Text>
                )}
              </View>
              <View style={{ borderLeftWidth: 0.5, borderLeftColor: t.border, paddingLeft: 14, maxWidth: 140 }}>
                <FieldLabel t={t}>Next rest</FieldLabel>
                <Text style={{ color: t.text, fontWeight: '600', fontSize: 13, marginTop: 4 }}>
                  {fdtlQ.data ? `${Math.floor(fdtlQ.data.minRestMinutes / 60)}h min` : '—'}
                </Text>
                <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 2 }}>
                  {fdtlQ.data?.restStartUtcMs ? `starts ${fmtTime(fdtlQ.data.restStartUtcMs)}` : 'no recent duty'}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Quick Actions */}
        <View style={{ gap: 10 }}>
          <SectionHeader t={t}>Quick Actions</SectionHeader>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <QuickAction
              t={t}
              icon={<Check color={'#fff'} size={18} />}
              title="Check In"
              sub="Window opens 04:15"
              highlight
            />
            <QuickAction t={t} icon={<Briefcase color={t.text} size={18} />} title="Preflight" sub="Brief & weather" />
            <QuickAction t={t} icon={<Users color={t.text} size={18} />} title="Crew List" sub="6 on duty" />
            <QuickAction t={t} icon={<Coffee color={t.text} size={18} />} title="Fatigue" sub="Submit FRM" />
          </View>
        </View>

        {/* Notifications */}
        <View style={{ gap: 10 }}>
          <SectionHeader t={t} action="See all →">
            Notifications
          </SectionHeader>
          {data.recentMessages.length === 0 && (
            <Card t={t} padding={20}>
              <Text style={{ ...TYPE.caption, color: t.textSec, textAlign: 'center' }}>No notifications</Text>
            </Card>
          )}
          {data.recentMessages.slice(0, 2).map((m) => (
            <Card key={m.id} t={t} padding={12} onPress={() => router.push(`/message/${m.id}`)}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    marginTop: 7,
                    borderRadius: 8,
                    backgroundColor: m.readAtMs ? 'transparent' : t.accent,
                  }}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Text numberOfLines={1} style={{ color: t.text, fontSize: 13, fontWeight: '600', flex: 1 }}>
                      {m.subject ?? 'Crew Control'}
                    </Text>
                    <Text style={{ ...TYPE.caption, color: t.textTer }}>{fmtTime(m.createdAtMs)}</Text>
                  </View>
                  <Text numberOfLines={2} style={{ ...TYPE.caption, color: t.textSec, marginTop: 3 }}>
                    {m.body}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

/**
 * Next Duty card with horizontal sector pager. Each page = one leg of the
 * pairing. Swipe left/right to cycle. Tap → flight duty detail.
 */
function NextDutyCard({
  t,
  pairingCode,
  legs,
  reportMs,
  totalBlock,
  onPress,
}: {
  t: Theme
  pairingCode: string
  legs: PairingLegRecord[]
  reportMs: number | null
  totalBlock: number
  onPress: () => void
}) {
  const [pageIdx, setPageIdx] = useState(0)
  const listRef = useRef<FlatList<PairingLegRecord>>(null)
  const screenWidth = Dimensions.get('window').width
  const cardWidth = screenWidth - 32 // matches outer 16px padding both sides

  return (
    <Card t={t} padding={0}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomWidth: 0.5,
          borderBottomColor: t.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <DutyDot t={t} kind="flight" size={8} />
          <FieldLabel t={t}>{pairingCode} · Flight Duty</FieldLabel>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Text style={{ ...TYPE.caption, color: t.textSec }}>Report </Text>
          <Text style={{ ...TYPE.caption, color: t.text, fontWeight: '600' }}>
            {reportMs ? fmtTime(reportMs) : '—'}L
          </Text>
        </View>
      </View>

      {/* Sector pager */}
      <Pressable onPress={onPress}>
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
            <View style={{ width: cardWidth, paddingHorizontal: 14, paddingTop: 18, paddingBottom: 14 }}>
              <Route
                t={t}
                dep={leg.depStation}
                arr={leg.arrStation}
                depTime={fmtTime(leg.stdUtcMs)}
                arrTime={fmtTime(leg.staUtcMs)}
                accent={t.duty.flight}
              />
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
                <View style={{ flex: 1 }}>
                  <MiniKV t={t} label="Flight" value={leg.flightNumber} />
                </View>
                <View style={{ flex: 1 }}>
                  <MiniKV t={t} label="Aircraft" value={leg.aircraftTypeIcao ?? '—'} />
                </View>
                <View style={{ flex: 1 }}>
                  <MiniKV t={t} label="Tail" value={leg.tailNumber ?? '—'} />
                </View>
                <View style={{ flex: 1 }}>
                  <MiniKV t={t} label="Block" value={fmtBlock(leg.blockMinutes)} />
                </View>
              </View>
            </View>
          )}
        />
      </Pressable>

      {/* Page indicators */}
      {legs.length > 1 && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
            paddingTop: 4,
            paddingBottom: 8,
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

      {/* Footer strip */}
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTopWidth: 0.5,
          borderTopColor: t.border,
          backgroundColor: t.overlay,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Chip t={t} kind="ontime">
            On Time
          </Chip>
          <Text style={{ ...TYPE.caption, color: t.textSec }}>
            {fmtBlock(totalBlock)} block · {legs.length} sector{legs.length === 1 ? '' : 's'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Users color={t.textSec} size={12} />
          <Text style={{ ...TYPE.caption, color: t.textSec }}>2P + 4C</Text>
        </View>
      </View>
    </Card>
  )
}

/**
 * Today's Route — vertical list of sector rows with "Ground Xh Ym" chip
 * between adjacent legs (turnaround at the layover airport).
 */
function TodayRouteList({ t, legs }: { t: Theme; legs: PairingLegRecord[] }) {
  return (
    <View style={{ gap: 8 }}>
      {legs.map((leg, i) => (
        <View key={leg.id}>
          <Card t={t} padding={14}>
            <Route
              t={t}
              dep={leg.depStation}
              arr={leg.arrStation}
              depTime={fmtTime(leg.stdUtcMs)}
              arrTime={fmtTime(leg.staUtcMs)}
              accent={t.duty.flight}
              big={false}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
              <Text style={{ ...TYPE.caption, color: t.textSec }}>
                <Text style={{ color: t.text, fontWeight: '600' }}>{leg.flightNumber}</Text>
                {' · '}
                {leg.aircraftTypeIcao ?? '—'}
                {' · '}
                {leg.tailNumber ?? '—'}
              </Text>
              <Text style={{ ...TYPE.caption, color: t.text, fontWeight: '600' }}>{fmtBlock(leg.blockMinutes)}</Text>
            </View>
          </Card>
          {i < legs.length - 1 && (
            <GroundChip t={t} fromMs={leg.staUtcMs} toMs={legs[i + 1].stdUtcMs} airport={leg.arrStation} />
          )}
        </View>
      ))}
    </View>
  )
}

function GroundChip({ t, fromMs, toMs, airport }: { t: Theme; fromMs: number; toMs: number; airport: string }) {
  const minutes = Math.max(0, Math.round((toMs - fromMs) / 60_000))
  return (
    <View style={{ alignItems: 'center', paddingVertical: 6 }}>
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
          backgroundColor: t.hover,
          borderWidth: 0.5,
          borderColor: t.cardBorder,
          flexDirection: 'row',
          gap: 6,
          alignItems: 'center',
        }}
      >
        <Text style={{ ...TYPE.badge, color: t.textSec }}>GROUND</Text>
        <Text style={{ ...TYPE.caption, color: t.text, fontWeight: '600' }}>{fmtBlock(minutes)}</Text>
        <Text style={{ ...TYPE.caption, color: t.textSec }}>at {airport}</Text>
      </View>
    </View>
  )
}

function QuickAction({
  t,
  icon,
  title,
  sub,
  highlight,
}: {
  t: Theme
  icon: React.ReactNode
  title: string
  sub: string
  highlight?: boolean
}) {
  return (
    <View
      style={{
        flexBasis: '48%',
        flexGrow: 1,
        backgroundColor: t.card,
        borderWidth: 0.5,
        borderColor: highlight ? t.accent : t.cardBorder,
        borderRadius: 12,
        padding: 12,
        gap: 8,
        minHeight: 88,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 36,
          backgroundColor: highlight ? t.accent : t.hover,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>
      <View>
        <Text style={{ color: t.text, fontSize: 13, fontWeight: '600' }}>{title}</Text>
        <Text style={{ color: t.textSec, fontSize: 11, marginTop: 2 }}>{sub}</Text>
      </View>
    </View>
  )
}
