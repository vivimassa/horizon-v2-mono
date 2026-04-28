import { useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronLeft, ChevronRight, Plane, Bed, Clock, GraduationCap, Briefcase } from 'lucide-react-native'
import { Card, Chip, DutyDot, FieldLabel, SectionHeader } from '../../src/components/primitives'
import type { DutyKind } from '../../src/components/primitives'
import { useTheme } from '../../src/theme/use-theme'
import { TYPE } from '../../src/theme/tokens'
import { useDatabase } from '../../src/providers/DatabaseProvider'
import { syncCrewData } from '../../src/sync/sync-trigger'
import { type RosterDuty, useRosterMonth } from '../../src/data/use-roster-month'
import { fmtMonthShort, fmtMonthYear } from '../../src/data/format'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function RosterTab() {
  const t = useTheme()
  const database = useDatabase()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [monthIdx0, setMonthIdx0] = useState(today.getMonth())
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const data = useRosterMonth(database, year, monthIdx0, refreshKey)

  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIdx0
  const todayDom = today.getDate()
  const [selectedDom, setSelectedDom] = useState(isCurrentMonth ? todayDom : 1)

  const cells = useMemo(() => {
    // grid layout: Mon-first; pad leading blanks
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.page }} edges={['top']}>
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
                <Text style={{ ...TYPE.field, fontSize: 10, color: t.textTer }}>{d}</Text>
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
                    onPress={() => setSelectedDom(d)}
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

        {/* Day list — show selected day first, then upcoming */}
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
                  <Text style={{ ...TYPE.section, color: isSelected ? t.accent : t.text, fontSize: 13 }}>
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
                  {day.duties.map((duty, i) => (
                    <DutyRow key={i} duty={duty} t={t} />
                  ))}
                </View>
              </View>
            )
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function NavBtn({
  onPress,
  children,
  t,
}: {
  onPress: () => void
  children: React.ReactNode
  t: ReturnType<typeof useTheme>
}) {
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
  t: ReturnType<typeof useTheme>
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
          width: 22,
          height: 22,
          borderRadius: 22,
          backgroundColor: isToday ? t.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: isToday ? '#fff' : t.text, fontSize: 12, fontWeight: isToday ? '700' : '500' }}>
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

function DutyRow({ duty, t }: { duty: RosterDuty; t: ReturnType<typeof useTheme> }) {
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
    <View
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
        <Text style={{ ...TYPE.cardTitle, color: t.text, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>
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
    </View>
  )
}
