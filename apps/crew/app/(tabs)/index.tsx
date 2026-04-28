import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Bell, Briefcase, Check, Coffee, Users } from 'lucide-react-native'
import { Card, Chip, DutyDot, FieldLabel, MiniKV, Ring, Route, SectionHeader } from '../../src/components/primitives'
import { useTheme } from '../../src/theme/use-theme'
import { TYPE } from '../../src/theme/tokens'
import { useDatabase } from '../../src/providers/DatabaseProvider'
import { syncCrewData } from '../../src/sync/sync-trigger'
import { useCrewAuthStore } from '../../src/stores/use-crew-auth-store'
import { useTodayData } from '../../src/data/use-today'
import { useFdtl } from '../../src/data/use-fdtl'
import { fmtBlock, fmtTime, greeting, initials } from '../../src/data/format'

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
  const nextLeg = next?.legs[0]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.page }} edges={['top']}>
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

        {/* Next Duty */}
        {next && nextLeg ? (
          <Card t={t} padding={0}>
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
                <FieldLabel t={t}>Flight Duty</FieldLabel>
              </View>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <Text style={{ ...TYPE.caption, color: t.textSec }}>Report </Text>
                <Text style={{ ...TYPE.caption, color: t.text, fontWeight: '600' }}>
                  {fmtTime(next.pairing?.reportTimeUtcMs ?? next.assignment.startUtcMs)}L
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => router.push('/(tabs)/flights')}
              style={{ paddingHorizontal: 14, paddingTop: 18, paddingBottom: 14 }}
            >
              <Route
                t={t}
                dep={nextLeg.depStation}
                arr={next.legs[next.legs.length - 1]?.arrStation ?? nextLeg.arrStation}
                depTime={fmtTime(nextLeg.stdUtcMs)}
                arrTime={fmtTime(next.legs[next.legs.length - 1]?.staUtcMs ?? nextLeg.staUtcMs)}
                accent={t.duty.flight}
              />
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
                <View style={{ flex: 1 }}>
                  <MiniKV t={t} label="Flight" value={nextLeg.flightNumber} />
                </View>
                <View style={{ flex: 1 }}>
                  <MiniKV t={t} label="Aircraft" value={nextLeg.aircraftTypeIcao ?? '—'} />
                </View>
                <View style={{ flex: 1 }}>
                  <MiniKV t={t} label="Tail" value={nextLeg.tailNumber ?? '—'} />
                </View>
                <View style={{ flex: 1 }}>
                  <MiniKV t={t} label="Sectors" value={String(next.legs.length)} />
                </View>
              </View>
            </Pressable>

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
                  {fmtBlock(next.legs.reduce((s, l) => s + (l.blockMinutes ?? 0), 0))} block
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Users color={t.textSec} size={12} />
                <Text style={{ ...TYPE.caption, color: t.textSec }}>2P + 4C</Text>
              </View>
            </View>
          </Card>
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

        {/* Today's Route */}
        {data.todaysLegs.length > 0 && (
          <View style={{ gap: 10 }}>
            <SectionHeader t={t} action="View all">
              Today's Route
            </SectionHeader>
            <Card t={t} padding={14}>
              <RouteStrip legs={data.todaysLegs} />
            </Card>
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

function QuickAction({
  t,
  icon,
  title,
  sub,
  highlight,
}: {
  t: ReturnType<typeof useTheme>
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

function RouteStrip({ legs }: { legs: ReturnType<typeof useTodayData>['todaysLegs'] }) {
  const t = useTheme()
  if (!legs.length) return null
  // Build airport node sequence from legs (dep[0], arr[0]=dep[1], arr[1], …)
  const nodes: { code: string; time: string }[] = []
  legs.forEach((l, i) => {
    if (i === 0) nodes.push({ code: l.depStation, time: fmtTime(l.stdUtcMs) })
    nodes.push({ code: l.arrStation, time: fmtTime(l.staUtcMs) })
  })
  const flightLabels = legs.map((l) => l.flightNumber)
  const now = Date.now()
  const currentIdx = legs.findIndex((l) => l.staUtcMs > now)

  return (
    <View style={{ paddingVertical: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {nodes.map((n, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', flex: i === nodes.length - 1 ? 0 : 1 }}>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  backgroundColor: i === 0 ? t.accent : t.card,
                  borderWidth: 0.5,
                  borderColor: i === 0 ? t.accent : t.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    letterSpacing: 0.3,
                    color: i === 0 ? '#fff' : t.text,
                  }}
                >
                  {n.code}
                </Text>
              </View>
              <Text style={{ ...TYPE.badge, fontWeight: '400', fontSize: 10, color: t.textSec }}>{n.time}</Text>
            </View>
            {i < nodes.length - 1 && (
              <View style={{ flex: 1, height: 22, position: 'relative', justifyContent: 'center' }}>
                <View
                  style={{
                    height: 2,
                    borderRadius: 2,
                    backgroundColor: i === currentIdx ? t.accent : t.border,
                    opacity: i < currentIdx ? 0.4 : 1,
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    top: -10,
                    alignSelf: 'center',
                    backgroundColor: t.card,
                    paddingHorizontal: 4,
                  }}
                >
                  <Text
                    style={{
                      ...TYPE.badge,
                      fontSize: 10,
                      fontWeight: '600',
                      color: i === currentIdx ? t.accent : t.textSec,
                    }}
                  >
                    {flightLabels[i]}
                  </Text>
                </View>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  )
}
