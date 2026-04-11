import { useState, useCallback, useEffect, useMemo } from 'react'
import { Text, View, ScrollView, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  api,
  type FdtlFrameworkRef,
  type FdtlSchemeRef,
  type FdtlRuleRef,
  type FdtlTableRef,
  type FdtlTabGroup,
} from '@skyhub/api'
import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Check,
  RefreshCw,
  Clock,
  Globe,
  Timer,
  Users,
  Plane,
  BedDouble,
  Moon,
  Shield,
  AlertTriangle,
  Wrench,
  Radio,
  Settings,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'
import { useOperatorId } from '../../../hooks/useOperatorId'

const TAB_ICONS: Record<string, LucideIcon> = {
  fdp: Clock,
  fdp_unacclim: Globe,
  fdp_extended: Timer,
  fdp_augmented: Users,
  fdp_single_pilot: Plane,
  rest: BedDouble,
  split_duty: Moon,
  cumulative: Timer,
  duty: Shield,
  disruptive: AlertTriangle,
  extension: Wrench,
  standby: Radio,
  mixed_ops: Plane,
  cabin_crew: Users,
  acclimatization: Globe,
  reporting_times: Settings,
}

export default function FdtRulesScreen() {
  const { palette, isDark, accent } = useAppTheme()
  const operatorId = useOperatorId()
  const router = useRouter()

  const [frameworks, setFrameworks] = useState<FdtlFrameworkRef[]>([])
  const [tabGroups, setTabGroups] = useState<FdtlTabGroup[]>([])
  const [scheme, setScheme] = useState<FdtlSchemeRef | null>(null)
  const [rules, setRules] = useState<FdtlRuleRef[]>([])
  const [tables, setTables] = useState<FdtlTableRef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [selectedFw, setSelectedFw] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!operatorId) return
    setLoading(true)
    setError(null)
    try {
      const [fw, tg] = await Promise.all([api.getFdtlFrameworks(), api.getFdtlTabGroups()])
      setFrameworks(fw)
      setTabGroups(tg)
      try {
        const s = await api.getFdtlScheme(operatorId)
        setScheme(s)
        const [r, t] = await Promise.all([
          api.getFdtlRules(operatorId, s.frameworkCode),
          api.getFdtlTables(operatorId, s.frameworkCode),
        ])
        setRules(r)
        setTables(t)
      } catch {
        setScheme(null)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [operatorId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSeed = useCallback(
    async (code: string) => {
      setSeeding(true)
      setError(null)
      try {
        await api.seedFdtl(operatorId, code)
        await fetchData()
      } catch (err: any) {
        setError(err.message || 'Failed to seed framework')
      } finally {
        setSeeding(false)
      }
    },
    [operatorId, fetchData],
  )

  const ruleCountByTab = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rules) m.set(r.tabKey ?? r.category, (m.get(r.tabKey ?? r.category) ?? 0) + 1)
    return m
  }, [rules])

  const tableCountByTab = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of tables) m.set(t.tabKey, (m.get(t.tabKey) ?? 0) + 1)
    return m
  }, [tables])

  const activeFramework = frameworks.find((f) => f.code === scheme?.frameworkCode)

  if (loading) {
    return (
      <View className="flex-1" style={{ backgroundColor: palette.background }}>
        <BreadcrumbHeader moduleCode="6" />
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading FDTL configuration...</Text>
        </View>
      </View>
    )
  }

  // ── Framework Setup (no scheme yet) ──
  if (!scheme) {
    return (
      <View className="flex-1" style={{ backgroundColor: palette.background }}>
        <BreadcrumbHeader moduleCode="6" />
        <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={[]}>
          <View className="px-4 pt-2 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
            <View className="flex-row items-center">
              <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
                <ChevronLeft size={24} color={accent} strokeWidth={2} />
              </Pressable>
              <View
                className="items-center justify-center rounded-lg mr-3"
                style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}
              >
                <ShieldCheck size={18} color={accent} strokeWidth={1.8} />
              </View>
              <View>
                <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>FDT Rules</Text>
                <Text style={{ fontSize: 15, color: palette.textSecondary }}>Select a regulatory framework</Text>
              </View>
            </View>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
            <Text style={{ fontSize: 15, color: palette.textSecondary, marginBottom: 16, lineHeight: 22 }}>
              Select the regulatory framework for your operation. This will populate all FDP tables, rest requirements,
              cumulative limits, and augmented crew rules.
            </Text>

            {error && (
              <View
                className="rounded-lg px-3 py-2 mb-3"
                style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}
              >
                <Text style={{ fontSize: 13, color: isDark ? '#f87171' : '#dc2626' }}>{error}</Text>
              </View>
            )}

            <View className="flex-row flex-wrap" style={{ gap: 10 }}>
              {frameworks.map((fw) => {
                const isSel = selectedFw === fw.code
                return (
                  <Pressable
                    key={fw.code}
                    onPress={() => setSelectedFw(fw.code)}
                    className="rounded-xl p-4 active:opacity-70"
                    style={{
                      width: '48%',
                      borderWidth: 2,
                      borderColor: isSel ? fw.color : palette.cardBorder,
                      backgroundColor: isSel ? accentTint(fw.color, isDark ? 0.08 : 0.04) : palette.card,
                    }}
                  >
                    <View className="flex-row items-center mb-1" style={{ gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: fw.color }} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }} numberOfLines={1}>
                        {fw.name}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, color: palette.textSecondary }}>{fw.region}</Text>
                    <Text style={{ fontSize: 12, color: palette.textTertiary, marginTop: 2 }} numberOfLines={1}>
                      {fw.legalBasis}
                    </Text>
                    {isSel && (
                      <View className="flex-row items-center mt-2" style={{ gap: 4 }}>
                        <Check size={13} color={fw.color} strokeWidth={2} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: fw.color }}>Selected</Text>
                      </View>
                    )}
                  </Pressable>
                )
              })}
            </View>

            <Pressable
              onPress={() => selectedFw && handleSeed(selectedFw)}
              disabled={!selectedFw || seeding}
              className="flex-row items-center justify-center py-3.5 rounded-xl mt-6 active:opacity-70"
              style={{ backgroundColor: accent, opacity: !selectedFw || seeding ? 0.4 : 1, gap: 8 }}
            >
              <Sparkles size={16} color="#fff" strokeWidth={2} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
                {seeding ? 'Seeding rules & tables...' : 'Initialize Framework'}
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </View>
    )
  }

  // ── Tab Navigation Hub (scheme exists) ──
  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <BreadcrumbHeader moduleCode="6" />
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={[]}>
        <View className="px-4 pt-2 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <View className="flex-row items-center">
            <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
              <ChevronLeft size={24} color={accent} strokeWidth={2} />
            </Pressable>
            <View
              className="items-center justify-center rounded-lg mr-3"
              style={{
                width: 36,
                height: 36,
                backgroundColor: accentTint(activeFramework?.color ?? accent, isDark ? 0.15 : 0.1),
              }}
            >
              <ShieldCheck size={18} color={activeFramework?.color ?? accent} strokeWidth={1.8} />
            </View>
            <View className="flex-1">
              <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>FDT Rules</Text>
              <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                <View
                  style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: activeFramework?.color ?? accent }}
                />
                <Text style={{ fontSize: 14, fontWeight: '600', color: activeFramework?.color ?? accent }}>
                  {activeFramework?.name ?? scheme.frameworkCode}
                </Text>
                {activeFramework?.region && (
                  <Text style={{ fontSize: 13, color: palette.textTertiary }}>({activeFramework.region})</Text>
                )}
              </View>
            </View>
          </View>

          {/* Legend */}
          <View className="flex-row items-center mt-3" style={{ gap: 16, marginLeft: 60 }}>
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <View
                className="px-1.5 rounded"
                style={{ backgroundColor: isDark ? 'rgba(253,172,66,0.15)' : 'rgba(255,136,0,0.12)' }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#FDAC42' : '#E67A00' }}>GOV</Text>
              </View>
              <Text style={{ fontSize: 13, color: palette.textSecondary }}>Default</Text>
            </View>
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <View className="px-1.5 rounded" style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: accent }}>CO</Text>
              </View>
              <Text style={{ fontSize: 13, color: palette.textSecondary }}>Override</Text>
            </View>
          </View>
        </View>

        {error && (
          <View
            className="mx-4 mt-2 rounded-lg px-3 py-2"
            style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}
          >
            <Text style={{ fontSize: 13, color: isDark ? '#f87171' : '#dc2626' }}>{error}</Text>
          </View>
        )}

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {tabGroups.map((group) => {
            const syntheticTabs = new Set(['reporting_times'])
            const visibleTabs = group.tabs.filter(
              (tab) =>
                syntheticTabs.has(tab.key) ||
                (ruleCountByTab.get(tab.key) ?? 0) + (tableCountByTab.get(tab.key) ?? 0) > 0,
            )
            if (visibleTabs.length === 0) return null

            return (
              <View key={group.key} className="mb-5">
                {/* Group header */}
                <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
                  <View
                    style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: activeFramework?.color ?? accent }}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: palette.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    {group.label}
                  </Text>
                </View>

                {/* Tab items */}
                <View style={{ gap: 2 }}>
                  {visibleTabs.map((tab) => {
                    const Icon = TAB_ICONS[tab.key] ?? Clock
                    const rCount = ruleCountByTab.get(tab.key) ?? 0
                    const tCount = tableCountByTab.get(tab.key) ?? 0
                    const total = rCount + tCount
                    const isReporting = tab.key === 'reporting_times'

                    return (
                      <Pressable
                        key={tab.key}
                        onPress={() => {
                          if (isReporting) {
                            router.push({
                              pathname: '/(tabs)/settings/fdt-scheme-settings' as any,
                              params: { schemeId: scheme._id },
                            })
                          } else {
                            router.push({
                              pathname: '/(tabs)/settings/fdt-rule-tab' as any,
                              params: { tabKey: tab.key, frameworkCode: scheme.frameworkCode },
                            })
                          }
                        }}
                        className="flex-row items-center px-3 py-3 rounded-xl active:opacity-70"
                        style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder }}
                      >
                        <Icon size={16} color={palette.textTertiary} strokeWidth={1.8} />
                        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text, flex: 1, marginLeft: 10 }}>
                          {tab.label}
                        </Text>
                        {!isReporting && total > 0 && (
                          <Text
                            style={{
                              fontSize: 13,
                              color: palette.textTertiary,
                              fontFamily: 'monospace',
                              marginRight: 6,
                            }}
                          >
                            {total}
                          </Text>
                        )}
                        <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            )
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}
