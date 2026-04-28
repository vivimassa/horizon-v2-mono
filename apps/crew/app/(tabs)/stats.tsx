import { useState } from 'react'
import { ScrollView, Text, View, Pressable, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Bed, FileText } from 'lucide-react-native'
import { Card, FieldLabel, ProgressBar, SectionHeader } from '../../src/components/primitives'
import { useTheme } from '../../src/theme/use-theme'
import type { Theme } from '../../src/theme/tokens'
import { TYPE } from '../../src/theme/tokens'
import { useStats } from '../../src/data/use-stats'
import { useFdtl } from '../../src/data/use-fdtl'
import { fmtBlock, fmtTime } from '../../src/data/format'
import type { StatsPeriod } from '../../src/lib/api-client'

const PERIODS: { id: StatsPeriod; label: string }[] = [
  { id: 'month', label: 'Month' },
  { id: '28d', label: '28 Days' },
  { id: 'year', label: 'Year' },
]

export default function StatsTab() {
  const t = useTheme()
  const [period, setPeriod] = useState<StatsPeriod>('month')
  const statsQ = useStats(period)
  const fdtlQ = useFdtl()

  const stats = statsQ.data
  const fdtl = fdtlQ.data

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={{ ...TYPE.pageTitle, color: t.text }}>Stats</Text>
          <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 4 }}>
            {new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} · CAAV VAR 15
          </Text>
        </View>

        {/* Segmented control */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: t.card,
            borderWidth: 0.5,
            borderColor: t.cardBorder,
            borderRadius: 10,
            padding: 3,
            gap: 2,
          }}
        >
          {PERIODS.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setPeriod(p.id)}
              style={{
                flex: 1,
                paddingVertical: 7,
                borderRadius: 8,
                backgroundColor: period === p.id ? t.page : 'transparent',
                borderWidth: period === p.id ? 0.5 : 0,
                borderColor: t.cardBorder,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: period === p.id ? t.text : t.textSec }}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* FDTL */}
        <View style={{ gap: 10 }}>
          <SectionHeader t={t}>FDTL Compliance</SectionHeader>
          {fdtlQ.isLoading ? (
            <Card t={t} padding={20}>
              <ActivityIndicator color={t.accent} />
            </Card>
          ) : fdtl ? (
            <>
              <FdtlBar t={t} title="Today's FDP" usedMin={fdtl.fdpUsedMinutes} limitMin={fdtl.fdpLimitMinutes} />
              <FdtlBar
                t={t}
                title="7-Day Rolling"
                usedMin={fdtl.duty7DayMinutes}
                limitMin={fdtl.duty7DayLimitMinutes}
              />
              <FdtlBar
                t={t}
                title="28-Day Rolling"
                usedMin={fdtl.duty28DayMinutes}
                limitMin={fdtl.duty28DayLimitMinutes}
              />

              <Card t={t} padding={14}>
                <FieldLabel t={t}>Rest Requirement</FieldLabel>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 36,
                      backgroundColor: t.duty.rest + '22',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Bed color={t.duty.rest} size={18} />
                  </View>
                  <View>
                    <Text style={{ color: t.text, fontWeight: '600', fontSize: 15 }}>
                      {Math.floor(fdtl.minRestMinutes / 60)}h minimum
                    </Text>
                    <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 2 }}>before next duty</Text>
                  </View>
                </View>
                <View style={{ marginTop: 12, padding: 10, backgroundColor: t.overlay, borderRadius: 8 }}>
                  <RestRow t={t} k="Rest starts" v={fdtl.restStartUtcMs ? fmtTime(fdtl.restStartUtcMs) : '—'} />
                  <RestRow t={t} k="Rest ends" v={fdtl.restEndUtcMs ? fmtTime(fdtl.restEndUtcMs) : '—'} />
                  <RestRow t={t} k="Next report" v={fdtl.nextReportUtcMs ? fmtTime(fdtl.nextReportUtcMs) : '—'} />
                </View>
              </Card>
            </>
          ) : (
            <Card t={t} padding={20}>
              <Text style={{ ...TYPE.caption, color: t.textSec, textAlign: 'center' }}>FDTL unavailable</Text>
            </Card>
          )}
        </View>

        {/* Stats grid */}
        <View style={{ gap: 10 }}>
          <SectionHeader t={t}>
            This {period === 'month' ? 'Month' : period === '28d' ? '28 Days' : 'Year'}
          </SectionHeader>
          {statsQ.isLoading ? (
            <Card t={t} padding={20}>
              <ActivityIndicator color={t.accent} />
            </Card>
          ) : stats && stats.blockMinutes === 0 && stats.dutyMinutes === 0 ? (
            <Card t={t} padding={20}>
              <Text style={{ ...TYPE.caption, color: t.textSec, textAlign: 'center' }}>
                No completed duty in this period yet.
              </Text>
            </Card>
          ) : stats ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <StatCell
                t={t}
                label="Block"
                value={fmtBlock(stats.blockMinutes)}
                trend={fmtTrend(stats.trends.blockDeltaMinutes)}
              />
              <StatCell
                t={t}
                label="Duty"
                value={fmtBlock(stats.dutyMinutes)}
                trend={fmtTrend(stats.trends.dutyDeltaMinutes)}
              />
              <StatCell
                t={t}
                label="Sectors"
                value={String(stats.sectors)}
                trend={fmtTrendPlain(stats.trends.sectorsDelta)}
              />
              <StatCell t={t} label="Night Duties" value={String(stats.nightDuties)} />
              <StatCell t={t} label="Days Off" value={String(stats.daysOff)} />
              <StatCell t={t} label="Avg Block/Day" value={fmtBlock(stats.avgBlockMinutesPerDay)} />
            </View>
          ) : (
            <Card t={t} padding={20}>
              <Text style={{ ...TYPE.caption, color: t.textSec, textAlign: 'center' }}>Stats unavailable</Text>
            </Card>
          )}
        </View>

        {/* Weekly chart */}
        {stats && stats.weekly.length > 0 && (
          <View style={{ gap: 10 }}>
            <SectionHeader t={t}>Block by Week</SectionHeader>
            <Card t={t} padding={14}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, height: 130 }}>
                {stats.weekly.map((w) => {
                  const maxMin = Math.max(1, ...stats.weekly.map((x) => x.blockMinutes))
                  const h = (w.blockMinutes / maxMin) * 90
                  return (
                    <View
                      key={w.weekLabel}
                      style={{ flex: 1, alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}
                    >
                      <Text style={{ ...TYPE.caption, color: t.text, fontWeight: '600', fontSize: 11 }}>
                        {fmtBlock(w.blockMinutes)}
                      </Text>
                      <View
                        style={{ width: '70%', height: Math.max(2, h), backgroundColor: t.accent, borderRadius: 4 }}
                      />
                      <Text style={{ ...TYPE.badge, fontWeight: '500', fontSize: 11, color: t.textSec }}>
                        {w.weekLabel}
                      </Text>
                    </View>
                  )
                })}
              </View>
            </Card>
          </View>
        )}

        {/* Notice */}
        <Card t={t} padding={12} style={{ backgroundColor: t.accentSoft, borderColor: t.accent + '33' }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ marginTop: 2 }}>
              <FileText color={t.accent} size={16} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: '600', fontSize: 13 }}>CAAV VAR 15 in effect</Text>
              <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 4 }}>
                Extended FDP with in-flight rest not currently active. Contact rostering for FDP extensions.
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  )
}

function fmtTrend(deltaMin: number): string | undefined {
  if (deltaMin === 0) return undefined
  const sign = deltaMin > 0 ? '+' : '−'
  return `${sign}${fmtBlock(Math.abs(deltaMin))}`
}

function fmtTrendPlain(delta: number): string | undefined {
  if (delta === 0) return undefined
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`
}

function FdtlBar({ t, title, usedMin, limitMin }: { t: Theme; title: string; usedMin: number; limitMin: number }) {
  const pct = (usedMin / Math.max(limitMin, 1)) * 100
  let color = t.duty.flight
  if (pct >= 80) color = t.status.delayed.fg
  if (pct >= 95) color = t.status.cancelled.fg
  return (
    <Card t={t} padding={14}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <FieldLabel t={t}>{title}</FieldLabel>
        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'baseline' }}>
          <Text style={{ color, fontWeight: '700', fontSize: 17 }}>{fmtBlock(usedMin)}</Text>
          <Text style={{ color: t.textSec, fontSize: 14 }}>/ {fmtBlock(limitMin)}</Text>
        </View>
      </View>
      <ProgressBar t={t} used={usedMin} limit={limitMin} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ ...TYPE.caption, color: t.textTer }}>{Math.round(pct)}% used</Text>
        <Text style={{ ...TYPE.caption, color: t.textTer }}>{fmtBlock(Math.max(0, limitMin - usedMin))} remaining</Text>
      </View>
    </Card>
  )
}

function StatCell({ t, label, value, trend }: { t: Theme; label: string; value: string; trend?: string }) {
  const up = trend?.startsWith('+')
  const down = trend?.startsWith('−') || trend?.startsWith('-')
  return (
    <View style={{ width: '50%', padding: 5 }}>
      <Card t={t} padding={12}>
        <FieldLabel t={t} style={{ fontSize: 11 }}>
          {label}
        </FieldLabel>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
          <Text style={{ color: t.text, fontWeight: '700', fontSize: 22, letterSpacing: -0.5 }}>{value}</Text>
          {trend && (
            <Text
              style={{
                ...TYPE.badge,
                fontSize: 11,
                color: up ? t.status.ontime.fg : down ? t.status.cancelled.fg : t.textSec,
              }}
            >
              {trend}
            </Text>
          )}
        </View>
      </Card>
    </View>
  )
}

function RestRow({ t, k, v }: { t: Theme; k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
      <Text style={{ ...TYPE.caption, color: t.textSec }}>{k}</Text>
      <Text style={{ ...TYPE.caption, color: t.text, fontWeight: '600' }}>{v}</Text>
    </View>
  )
}
