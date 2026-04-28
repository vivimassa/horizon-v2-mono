import { useMemo, useState } from 'react'
import { Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronLeft, ChevronRight, Plane, Bed, Clock, GraduationCap, Briefcase, X } from 'lucide-react-native'
import { Card, Chip, DutyDot, FieldLabel } from '../../src/components/primitives'
import type { DutyKind } from '../../src/components/primitives'
import { useTheme } from '../../src/theme/use-theme'
import type { Theme } from '../../src/theme/tokens'
import { TYPE } from '../../src/theme/tokens'
import { useDatabase } from '../../src/providers/DatabaseProvider'
import { syncCrewData } from '../../src/sync/sync-trigger'
import { type RosterDuty, useRosterMonth } from '../../src/data/use-roster-month'
import { useActivityCodes } from '../../src/data/use-activity-codes'
import { summarizeDay } from '../../src/data/use-day-summary'
import { fmtBlock, fmtMonthShort, fmtMonthYear } from '../../src/data/format'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function RosterTab() {
  const t = useTheme()
  const router = useRouter()
  const database = useDatabase()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [monthIdx0, setMonthIdx0] = useState(today.getMonth())
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const codesQ = useActivityCodes()
  const data = useRosterMonth(database, year, monthIdx0, codesQ.byId, refreshKey)

  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIdx0
  const todayDom = today.getDate()
  const [selectedDom, setSelectedDom] = useState(isCurrentMonth ? todayDom : 1)
  const [tooltipDom, setTooltipDom] = useState<number | null>(null)

  const cells = useMemo(() => {
    const firstWeekday = new Date(year, monthIdx0, 1).getDay() // 0=Sun
    const lead = (firstWeekday + 6) % 7 // Mon=0
    const dim = new Date(year, monthIdx0 + 1, 0).getDate()
    const arr: (number | null)[] = []
    for (let i = 0; i < lead; i++) arr.push(null)
    for (let d = 1; d <= dim; d++) arr.push(d)
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [year, monthIdx0])

  const onPrev = () => {
    if (monthIdx0 === 0) {
      setMonthIdx0(11)
      setYear(year - 1)
    } else {
      setMonthIdx0(monthIdx0 - 1)
    }
  }
  const onNext = () => {
    if (monthIdx0 === 11) {
      setMonthIdx0(0)
      setYear(year + 1)
    } else {
      setMonthIdx0(monthIdx0 + 1)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await syncCrewData(database, true)
    setRefreshKey((k) => k + 1)
    setRefreshing(false)
  }

  const onDutyTap = (duty: RosterDuty) => {
    if (duty.kind === 'flight') router.push(`/duty/${duty.id}`)
    else router.push(`/activity/${duty.id}`)
  }

  const tooltipDuties = tooltipDom != null ? (data.byDom[tooltipDom] ?? []) : []
  const tooltipSummary = summarizeDay(tooltipDuties)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Month nav */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <NavBtn onPress={onPrev} t={t}>
            <ChevronLeft color={t.text} size={16} />
          </NavBtn>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ ...TYPE.pageTitle, color: t.text }}>{fmtMonthYear(year, monthIdx0)}</Text>
            <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 2 }}>
              {data.days.length} active day{data.days.length === 1 ? '' : 's'}
            </Text>
          </View>
          <NavBtn onPress={onNext} t={t}>
            <ChevronRight color={t.text} size={16} />
          </NavBtn>
        </View>

        {/* Calendar */}
        <Card t={t} padding={10}>
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            {WEEKDAYS.map((d) => (
              <View key={d} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ ...TYPE.field, fontSize: 11, color: t.textTer }}>{d}</Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((d, i) => (
              <View key={i} style={{ width: `${100 / 7}%`, padding: 2 }}>
                {d === null ? (
                  <View style={{ aspectRatio: 1 }} />
                ) : (
                  <DayCell
                    t={t}
                    dom={d}
                    isToday={isCurrentMonth && d === todayDom}
                    isSelected={d === selectedDom}
                    duties={data.byDom[d] ?? []}
                    onPress={() => {
                      setSelectedDom(d)
                      setTooltipDom(d)
                    }}
                  />
                )}
              </View>
            ))}
          </View>
        </Card>

        {/* Legend */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {[
            { k: 'flight' as const, l: 'Flight' },
            { k: 'standby' as const, l: 'Standby' },
            { k: 'rest' as const, l: 'Rest' },
            { k: 'training' as const, l: 'Training' },
          ].map((x) => (
            <View key={x.k} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <DutyDot t={t} kind={x.k} size={6} />
              <Text style={{ ...TYPE.caption, color: t.textSec }}>{x.l}</Text>
            </View>
          ))}
        </View>

        {/* Day list */}
        <View style={{ gap: 18 }}>
          {data.days.length === 0 && (
            <Card t={t} padding={20}>
              <Text style={{ ...TYPE.caption, color: t.textSec, textAlign: 'center' }}>
                No duties this month. Pull down to sync.
              </Text>
            </Card>
          )}
          {data.days.map((day) => {
            const isSelected = day.dom === selectedDom
            const isToday = isCurrentMonth && day.dom === todayDom
            return (
              <View key={day.iso}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Text style={{ ...TYPE.section, color: isSelected ? t.accent : t.text, fontSize: 14 }}>
                    {day.dayOfWeek} {day.dom} {fmtMonthShort(monthIdx0)}
                  </Text>
                  {isToday && (
                    <View
                      style={{ backgroundColor: t.accent, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}
                    >
                      <Text style={{ ...TYPE.badge, color: '#fff' }}>Today</Text>
                    </View>
                  )}
                </View>
                <View style={{ gap: 6 }}>
                  {day.duties.map((duty) => (
                    <DutyRow key={duty.id} duty={duty} t={t} onPress={() => onDutyTap(duty)} />
                  ))}
                </View>
              </View>
            )
          })}
        </View>
      </ScrollView>

      {/* Day tooltip modal */}
      <Modal visible={tooltipDom != null} transparent animationType="fade" onRequestClose={() => setTooltipDom(null)}>
        <Pressable
          onPress={() => setTooltipDom(null)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.55)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: t.card,
              borderRadius: 16,
              borderWidth: 0.5,
              borderColor: t.cardBorder,
              padding: 18,
              minWidth: 260,
              maxWidth: 320,
            }}
          >
            <View
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}
            >
              <Text style={{ ...TYPE.section, color: t.text }}>
                {tooltipDom != null
                  ? new Date(year, monthIdx0, tooltipDom).toLocaleDateString(undefined, {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'short',
                    })
                  : ''}
              </Text>
              <Pressable onPress={() => setTooltipDom(null)} hitSlop={8}>
                <X color={t.textSec} size={18} />
              </Pressable>
            </View>
            {tooltipDuties.length === 0 ? (
              <Text style={{ ...TYPE.caption, color: t.textSec }}>No duties this day.</Text>
            ) : (
              <View style={{ gap: 8 }}>
                <SummaryRow t={t} k="Flights" v={String(tooltipSummary.flightCount)} />
                <SummaryRow t={t} k="Block hours" v={fmtBlock(tooltipSummary.blockMinutes)} />
                <SummaryRow t={t} k="Duty hours" v={fmtBlock(tooltipSummary.dutyMinutes)} />
                {tooltipSummary.activityNames.length > 0 && (
                  <SummaryRow t={t} k="Activity" v={tooltipSummary.activityNames.join(', ')} />
                )}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

function SummaryRow({ t, k, v }: { t: Theme; k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <Text style={{ ...TYPE.caption, color: t.textSec }}>{k}</Text>
      <Text style={{ color: t.text, fontWeight: '600', fontSize: 14, textAlign: 'right', flex: 1 }} numberOfLines={2}>
        {v}
      </Text>
    </View>
  )
}

function NavBtn({ onPress, children, t }: { onPress: () => void; children: React.ReactNode; t: Theme }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: t.card,
        borderWidth: 0.5,
        borderColor: t.cardBorder,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </Pressable>
  )
}

function DayCell({
  t,
  dom,
  isToday,
  isSelected,
  duties,
  onPress,
}: {
  t: Theme
  dom: number
  isToday: boolean
  isSelected: boolean
  duties: RosterDuty[]
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        aspectRatio: 1,
        borderRadius: 8,
        backgroundColor: isSelected ? t.hover : 'transparent',
        borderWidth: 0.5,
        borderColor: isSelected ? t.accent : 'transparent',
        padding: 4,
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 24,
          backgroundColor: isToday ? t.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: isToday ? '#fff' : t.text, fontSize: 13, fontWeight: isToday ? '700' : '500' }}>
          {dom}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center', minHeight: 6 }}>
        {duties.slice(0, 2).map((d, i) => (
          <DutyDot key={i} t={t} kind={d.type} size={5} />
        ))}
      </View>
      <View style={{ minHeight: 9 }} />
    </Pressable>
  )
}

function DutyRow({ duty, t, onPress }: { duty: RosterDuty; t: Theme; onPress: () => void }) {
  const color = t.duty[duty.type as DutyKind] ?? t.duty.ground
  const Icon =
    duty.type === 'flight'
      ? Plane
      : duty.type === 'rest'
        ? Bed
        : duty.type === 'standby'
          ? Clock
          : duty.type === 'training'
            ? GraduationCap
            : Briefcase
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: t.card,
        borderWidth: 0.5,
        borderColor: t.cardBorder,
        borderRadius: 12,
        padding: 12,
        paddingLeft: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: color }} />
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: color + '22',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon color={color} size={16} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...TYPE.cardTitle, color: t.text, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
          {duty.title}
        </Text>
        <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 2 }}>{duty.sub}</Text>
      </View>
      {duty.status === 'delayed' && (
        <Chip t={t} kind="delayed">
          Delayed
        </Chip>
      )}
      {duty.status === 'cancelled' && (
        <Chip t={t} kind="cancelled">
          Cancelled
        </Chip>
      )}
    </Pressable>
  )
}
