import { useState } from 'react'
import { ActivityIndicator, Dimensions, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Bed, FileText, Moon, TrendingDown, TrendingUp } from 'lucide-react-native'
import { AreaChart, FieldLabel, Glass, ProgressBar, SectionHeader, Sparkline } from '../../src/components/primitives'
import { useTheme } from '../../src/theme/use-theme'
import type { Theme } from '../../src/theme/tokens'
import { TYPE } from '../../src/theme/tokens'
import { useStats } from '../../src/data/use-stats'
import { useFdtl } from '../../src/data/use-fdtl'
import { useTopRoutes } from '../../src/data/use-top-routes'
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
  const topRoutesQ = useTopRoutes(period)

  const stats = statsQ.data
  const fdtl = fdtlQ.data
  const screenW = Dimensions.get('window').width

  const weeklyValues = stats?.weekly.map((w) => w.blockMinutes / 60) ?? []
  const blockH = (stats?.blockMinutes ?? 0) / 60
  const blockTrendDelta = (stats?.trends.blockDeltaMinutes ?? 0) / 60
  const blockTrendPct = blockH > 0 ? Math.round((blockTrendDelta / blockH) * 100) : 0

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 16 }}
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
            backgroundColor: t.hover,
            borderWidth: 1,
            borderColor: t.cardBorder,
            borderRadius: 12,
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
                paddingVertical: 8,
                borderRadius: 9,
                backgroundColor: period === p.id ? t.accent : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: period === p.id ? '#fff' : t.textSec }}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Hero block hours tile */}
        <Glass tier="hero" padding={16}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: t.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 }}>BLOCK HOURS</Text>
              <Text style={{ color: t.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.6, marginTop: 4 }}>
                {fmtBlock(stats?.blockMinutes ?? 0)}
              </Text>
              {blockTrendDelta !== 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  {blockTrendDelta > 0 ? (
                    <TrendingUp color={t.status.ontime.fg} size={14} />
                  ) : (
                    <TrendingDown color={t.status.cancelled.fg} size={14} />
                  )}
                  <Text
                    style={{
                      color: blockTrendDelta > 0 ? t.status.ontime.fg : t.status.cancelled.fg,
                      fontSize: 13,
                    }}
                  >
                    {blockTrendDelta > 0 ? '+' : ''}
                    {blockTrendPct}% vs last
                  </Text>
                </View>
              )}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <FieldLabel t={t}>Limit</FieldLabel>
              <Text style={{ color: t.text, fontSize: 14, fontWeight: '600', marginTop: 2 }}>100h</Text>
            </View>
          </View>
          {weeklyValues.length > 1 && (
            <View style={{ marginTop: 14 }}>
              <AreaChart values={weeklyValues} color={t.accent} width={screenW - 64} height={90} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                {(stats?.weekly ?? []).map((w) => (
                  <Text
                    key={w.weekLabel}
                    style={{ fontSize: 11, color: t.textSec, letterSpacing: 1, fontWeight: '500' }}
                  >
                    {w.weekLabel}
                  </Text>
                ))}
              </View>
            </View>
          )}
        </Glass>

        {/* Mini stat tiles */}
        {stats && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <StatTile
              t={t}
              label="Duty Hrs"
              value={fmtBlock(stats.dutyMinutes)}
              sub={`${Math.round((stats.dutyMinutes / 60 / 100) * 100)}% of 100h`}
              spark={weeklyValues}
            />
            <StatTile
              t={t}
              label="Sectors"
              value={String(stats.sectors)}
              sub={stats.trends.sectorsDelta > 0 ? `+${stats.trends.sectorsDelta} vs last` : 'no change'}
              spark={weeklyValues.map((v) => Math.max(1, Math.round(v / 4)))}
            />
            <StatTile
              t={t}
              label="Night duty"
              value={String(stats.nightDuties)}
              sub="this period"
              icon={<Moon color={t.duty.rest} size={14} />}
            />
            <StatTile
              t={t}
              label="Days off"
              value={String(stats.daysOff)}
              sub="this period"
              icon={<Bed color={t.duty.training} size={14} />}
            />
          </View>
        )}

        {/* FDTL Compliance */}
        <View style={{ gap: 12 }}>
          <SectionHeader t={t}>FDTL Compliance</SectionHeader>
          {fdtlQ.isLoading ? (
            <Glass tier="standard" padding={20}>
              <ActivityIndicator color={t.accent} />
            </Glass>
          ) : fdtl ? (
            <View style={{ gap: 8 }}>
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
              <Glass tier="standard" padding={14}>
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
              </Glass>
            </View>
          ) : (
            <Glass tier="standard" padding={20}>
              <Text style={{ ...TYPE.caption, color: t.textSec, textAlign: 'center' }}>FDTL unavailable</Text>
            </Glass>
          )}
        </View>

        {/* Top Routes */}
        {topRoutesQ.data && topRoutesQ.data.routes.length > 0 && (
          <View style={{ gap: 12 }}>
            <SectionHeader t={t}>Top Routes</SectionHeader>
            <Glass tier="standard" padding={14}>
              {topRoutesQ.data.routes.map((r, i, arr) => {
                const max = Math.max(...arr.map((x) => x.sectors))
                const pct = (r.sectors / max) * 100
                return (
                  <View key={`${r.depIcao}-${r.arrIcao}`} style={{ marginBottom: i === arr.length - 1 ? 0 : 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>
                        {r.depIcao} ⇄ {r.arrIcao}
                      </Text>
                      <Text style={{ ...TYPE.caption, color: t.textSec }}>
                        {r.sectors} sector{r.sectors === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <View
                      style={{
                        height: 6,
                        borderRadius: 3,
                        marginTop: 6,
                        backgroundColor: t.hover,
                        overflow: 'hidden',
                      }}
                    >
                      <View style={{ width: `${pct}%`, height: 6, backgroundColor: t.accent }} />
                    </View>
                  </View>
                )
              })}
            </Glass>
          </View>
        )}

        {/* CAAV notice */}
        <Glass tier="soft" padding={12} style={{ borderColor: t.accent + '33' }}>
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
        </Glass>
      </ScrollView>
    </SafeAreaView>
  )
}

function StatTile({
  t,
  label,
  value,
  sub,
  spark,
  icon,
}: {
  t: Theme
  label: string
  value: string
  sub: string
  spark?: number[]
  icon?: React.ReactNode
}) {
  return (
    <View style={{ width: '48.5%' }}>
      <Glass tier="standard" padding={14}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <FieldLabel t={t} style={{ fontSize: 11 }}>
            {label}
          </FieldLabel>
          {spark && <Sparkline values={spark} color={t.accent} />}
          {icon}
        </View>
        <Text style={{ color: t.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5, marginTop: 4 }}>
          {value}
        </Text>
        <Text style={{ ...TYPE.caption, color: t.textSec, marginTop: 2, fontSize: 12 }}>{sub}</Text>
      </Glass>
    </View>
  )
}

function FdtlBar({ t, title, usedMin, limitMin }: { t: Theme; title: string; usedMin: number; limitMin: number }) {
  const pct = (usedMin / Math.max(limitMin, 1)) * 100
  let color = t.duty.flight
  if (pct >= 80) color = t.status.delayed.fg
  if (pct >= 95) color = t.status.cancelled.fg
  return (
    <Glass tier="standard" padding={14}>
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
    </Glass>
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
