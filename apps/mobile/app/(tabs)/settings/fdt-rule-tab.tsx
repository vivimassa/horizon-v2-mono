import { useState, useCallback, useEffect, useMemo } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type FdtlRuleRef, type FdtlTableRef, type FdtlTabGroup } from '@skyhub/api'
import { ChevronLeft, ChevronDown, RotateCcw, AlertTriangle } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useOperatorId } from '../../../hooks/useOperatorId'

function minutesToHHMM(m: number | null): string {
  if (m == null || m === -1) return m === -1 ? 'N/A' : '\u2014'
  const h = Math.floor(m / 60), mm = m % 60
  return `${h}:${String(mm).padStart(2, '0')}`
}
function parseToMinutes(s: string): number | null {
  const hm = s.match(/^(\d{1,3}):(\d{2})$/)
  if (hm) return Number(hm[1]) * 60 + Number(hm[2])
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

function formatRowLabel(label: string): string {
  return label.replace(/(\d{4})-(\d{4})/, (_, a, b) =>
    `${a.slice(0, 2)}:${a.slice(2)}\u2013${b.slice(0, 2)}:${b.slice(2)}`)
}

function isLessRestrictive(rule: FdtlRuleRef): boolean {
  if (rule.isTemplateDefault || !rule.templateValue) return false
  const cur = parseFloat(rule.value), tpl = parseFloat(rule.templateValue)
  if (isNaN(cur) || isNaN(tpl)) return false
  if (rule.directionality === 'MAX_LIMIT') return cur > tpl
  if (rule.directionality === 'MIN_LIMIT') return cur < tpl
  return false
}

export default function FdtRuleTabScreen() {
  const router = useRouter()
  const { tabKey, frameworkCode } = useLocalSearchParams<{ tabKey: string; frameworkCode: string }>()
  const { palette, isDark, accent } = useAppTheme()
  const operatorId = useOperatorId()

  const [rules, setRules] = useState<FdtlRuleRef[]>([])
  const [tables, setTables] = useState<FdtlTableRef[]>([])
  const [tabGroups, setTabGroups] = useState<FdtlTabGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [cellDraft, setCellDraft] = useState('')
  const [editingRule, setEditingRule] = useState<string | null>(null)
  const [ruleDraft, setRuleDraft] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!operatorId || !tabKey || !frameworkCode) return
    setLoading(true)
    Promise.all([
      api.getFdtlRules(operatorId, frameworkCode, tabKey),
      api.getFdtlTables(operatorId, frameworkCode, tabKey),
      api.getFdtlTabGroups(),
    ])
      .then(([r, t, tg]) => { setRules(r); setTables(t); setTabGroups(tg) })
      .catch((err: any) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [operatorId, tabKey, frameworkCode])

  const tabLabel = useMemo(() =>
    tabGroups.flatMap(g => g.tabs).find(t => t.key === tabKey)?.label ?? tabKey
  , [tabGroups, tabKey])

  // ── Cell editing ──
  const handleCellSave = useCallback(async (tableId: string, rowKey: string, colKey: string) => {
    const mins = parseToMinutes(cellDraft)
    setEditingCell(null)
    try {
      const updated = await api.updateFdtlTableCell(tableId, rowKey, colKey, mins)
      setTables(prev => prev.map(t => t._id === tableId ? updated : t))
    } catch { Alert.alert('Error', 'Failed to update cell') }
  }, [cellDraft])

  const handleResetTable = useCallback(async (tableId: string) => {
    try {
      const updated = await api.resetFdtlTable(tableId)
      setTables(prev => prev.map(t => t._id === tableId ? updated : t))
    } catch { Alert.alert('Error', 'Failed to reset table') }
  }, [])

  // ── Rule editing ──
  const handleRuleSave = useCallback(async (id: string) => {
    setEditingRule(null)
    try {
      const updated = await api.updateFdtlRule(id, { value: ruleDraft })
      setRules(prev => prev.map(r => r._id === id ? updated : r))
    } catch { Alert.alert('Error', 'Failed to update rule') }
  }, [ruleDraft])

  const handleRuleToggle = useCallback(async (rule: FdtlRuleRef) => {
    const newVal = rule.value === 'true' ? 'false' : 'true'
    try {
      const updated = await api.updateFdtlRule(rule._id, { value: newVal })
      setRules(prev => prev.map(r => r._id === rule._id ? updated : r))
    } catch { Alert.alert('Error', 'Failed to toggle rule') }
  }, [])

  const handleRuleReset = useCallback(async (id: string) => {
    try {
      const updated = await api.resetFdtlRule(id)
      setRules(prev => prev.map(r => r._id === id ? updated : r))
    } catch { Alert.alert('Error', 'Failed to reset rule') }
  }, [])

  // ── Group rules by subcategory ──
  const ruleGroups = useMemo(() => {
    const map = new Map<string, FdtlRuleRef[]>()
    for (const r of rules) {
      const arr = map.get(r.subcategory)
      if (arr) arr.push(r)
      else map.set(r.subcategory, [r])
    }
    return Array.from(map.entries())
  }, [rules])

  if (loading) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      <View className="px-4 pt-4 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
            <ChevronLeft size={24} color={accent} strokeWidth={2} />
          </Pressable>
          <View className="flex-1">
            <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>{tabLabel}</Text>
            <Text style={{ fontSize: 13, color: palette.textSecondary }}>
              {tables.length > 0 ? `${tables.length} table${tables.length !== 1 ? 's' : ''}` : ''}
              {tables.length > 0 && rules.length > 0 ? ' · ' : ''}
              {rules.length > 0 ? `${rules.length} rule${rules.length !== 1 ? 's' : ''}` : ''}
            </Text>
          </View>
        </View>
      </View>

      {error && (
        <View className="mx-4 mt-2 rounded-lg px-3 py-2" style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}>
          <Text style={{ fontSize: 13, color: isDark ? '#f87171' : '#dc2626' }}>{error}</Text>
        </View>
      )}

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {/* ── Tables ── */}
        {tables.map(table => {
          const hasModified = table.cells.some(c => !c.isTemplateDefault)
          return (
            <View key={table._id} className="mb-6">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-1">
                  <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text }}>{table.label}</Text>
                  {table.legalReference && (
                    <Text style={{ fontSize: 12, color: palette.textTertiary, marginTop: 1 }}>{table.legalReference}</Text>
                  )}
                </View>
                {hasModified && (
                  <Pressable onPress={() => handleResetTable(table._id)}
                    className="flex-row items-center px-2 py-1 rounded active:opacity-60" style={{ gap: 4 }}>
                    <RotateCcw size={12} color={palette.textTertiary} strokeWidth={2} />
                    <Text style={{ fontSize: 12, color: palette.textTertiary }}>Reset</Text>
                  </Pressable>
                )}
              </View>

              {/* Matrix */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="rounded-lg overflow-hidden" style={{ borderWidth: 1, borderColor: palette.cardBorder }}>
                  {/* Col headers */}
                  <View className="flex-row" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }}>
                    <View style={{ width: 100, paddingHorizontal: 8, paddingVertical: 6, borderRightWidth: 1, borderBottomWidth: 1, borderColor: palette.cardBorder }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: palette.textTertiary, textTransform: 'uppercase' }}>
                        {table.rowAxisLabel ?? ''}
                      </Text>
                    </View>
                    {table.colKeys.map((ck, ci) => (
                      <View key={ck} style={{ width: 64, alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderColor: palette.cardBorder, borderLeftWidth: ci > 0 ? 1 : 0, borderLeftColor: palette.cardBorder }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: palette.textSecondary, textTransform: 'uppercase' }}>
                          {table.colLabels[ci] ?? ck}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Rows */}
                  {table.rowKeys.map((rk, ri) => (
                    <View key={rk} className="flex-row" style={{
                      backgroundColor: ri % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'),
                    }}>
                      <View style={{ width: 100, justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 6, borderRightWidth: 1, borderBottomWidth: 1, borderColor: palette.cardBorder }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: palette.textSecondary }}>
                          {formatRowLabel(table.rowLabels[ri] ?? rk)}
                        </Text>
                      </View>
                      {table.colKeys.map((ck, ci) => {
                        const cell = table.cells.find(c => c.rowKey === rk && c.colKey === ck)
                        const cellId = `${table._id}_${rk}_${ck}`
                        const isEditing = editingCell === cellId
                        const isModified = cell && !cell.isTemplateDefault
                        const isProhibited = cell?.valueMinutes === null
                        const isNA = cell?.valueMinutes === -1

                        return (
                          <Pressable key={ck}
                            onPress={() => {
                              if (isProhibited) return
                              setEditingCell(cellId)
                              setCellDraft(cell?.valueMinutes != null && cell.valueMinutes >= 0 ? minutesToHHMM(cell.valueMinutes) : '')
                            }}
                            style={{
                              width: 64, alignItems: 'center', justifyContent: 'center',
                              paddingVertical: 6, borderBottomWidth: 1, borderColor: palette.cardBorder,
                              borderLeftWidth: ci > 0 ? 1 : 0, borderLeftColor: palette.cardBorder,
                              backgroundColor: isProhibited ? (isDark ? 'rgba(220,38,38,0.06)' : 'rgba(220,38,38,0.04)') : undefined,
                            }}>
                            {isEditing ? (
                              <TextInput value={cellDraft} onChangeText={setCellDraft}
                                onBlur={() => handleCellSave(table._id, rk, ck)}
                                onSubmitEditing={() => handleCellSave(table._id, rk, ck)}
                                autoFocus keyboardType="numbers-and-punctuation"
                                textAlign="center"
                                style={{ fontSize: 13, fontWeight: '700', fontFamily: 'monospace', color: accent, width: 56, height: 28, borderRadius: 4, borderWidth: 1, borderColor: accentTint(accent, 0.4), backgroundColor: palette.card }} />
                            ) : isProhibited ? (
                              <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#f87171' : '#dc2626' }}>{'\u2014'}</Text>
                            ) : isNA ? (
                              <Text style={{ fontSize: 12, color: palette.textTertiary }}>N/A</Text>
                            ) : (
                              <View className="flex-row items-center" style={{ gap: 2 }}>
                                {isModified && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: accent }} />}
                                <Text style={{ fontSize: 13, fontWeight: isModified ? '700' : '500', fontFamily: 'monospace', color: isModified ? accent : palette.text }}>
                                  {minutesToHHMM(cell?.valueMinutes ?? null)}
                                </Text>
                              </View>
                            )}
                          </Pressable>
                        )
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )
        })}

        {/* ── Rules ── */}
        {ruleGroups.length > 0 && tables.length > 0 && (
          <View className="flex-row items-center mt-2 mb-3" style={{ gap: 6 }}>
            <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accent }} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: accent }}>Rule Parameters</Text>
          </View>
        )}

        {ruleGroups.map(([subcategory, subRules]) => {
          const isCollapsed = collapsed.has(subcategory)
          return (
            <View key={subcategory} className="mb-3">
              <Pressable onPress={() => setCollapsed(prev => { const n = new Set(prev); n.has(subcategory) ? n.delete(subcategory) : n.add(subcategory); return n })}
                className="flex-row items-center py-2 active:opacity-70">
                <ChevronDown size={14} color={palette.textTertiary} strokeWidth={2}
                  style={{ transform: [{ rotate: isCollapsed ? '-90deg' : '0deg' }], marginRight: 6 }} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {subcategory.replace(/_/g, ' ')}
                </Text>
                <Text style={{ fontSize: 13, color: palette.textTertiary, marginLeft: 6 }}>({subRules.length})</Text>
              </Pressable>

              {!isCollapsed && subRules.map(rule => {
                const isEditing = editingRule === rule._id
                const isModified = !rule.isTemplateDefault
                const isBool = rule.valueType === 'boolean'
                const boolVal = rule.value === 'true'
                const lessRestr = isLessRestrictive(rule)

                return (
                  <View key={rule._id} style={{ paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: palette.border }}>
                    <View className="flex-row items-center">
                      {/* Source badge */}
                      <View className="px-1.5 rounded mr-2" style={{
                        backgroundColor: rule.source === 'company'
                          ? accentTint(accent, isDark ? 0.15 : 0.1)
                          : (isDark ? 'rgba(253,172,66,0.15)' : 'rgba(255,136,0,0.12)'),
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: '700',
                          color: rule.source === 'company' ? accent : (isDark ? '#FDAC42' : '#E67A00'),
                        }}>{rule.source === 'company' ? 'CO' : 'GOV'}</Text>
                      </View>

                      {/* Label */}
                      <View className="flex-1 mr-2">
                        <View className="flex-row items-center flex-wrap" style={{ gap: 4 }}>
                          <Text style={{ fontSize: 14, fontWeight: '500', color: palette.text }}>{rule.label}</Text>
                          {rule.crewType !== 'all' && (
                            <View className="px-1 rounded" style={{ backgroundColor: rule.crewType === 'cockpit' ? (isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff') : (isDark ? 'rgba(139,92,246,0.15)' : '#f5f3ff') }}>
                              <Text style={{ fontSize: 10, fontWeight: '600', color: rule.crewType === 'cockpit' ? (isDark ? '#93c5fd' : '#1d4ed8') : (isDark ? '#c4b5fd' : '#6d28d9') }}>
                                {rule.crewType === 'cockpit' ? 'FD' : 'CC'}
                              </Text>
                            </View>
                          )}
                          {lessRestr && <AlertTriangle size={12} color={isDark ? '#fbbf24' : '#d97706'} strokeWidth={2} />}
                        </View>
                        {rule.legalReference && (
                          <Text style={{ fontSize: 11, color: palette.textTertiary, marginTop: 1 }}>{rule.legalReference}</Text>
                        )}
                      </View>

                      {/* Value */}
                      {isBool ? (
                        <Pressable onPress={() => handleRuleToggle(rule)}
                          className="px-3 py-1.5 rounded-lg"
                          style={{ backgroundColor: boolVal ? (isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7') : (isDark ? 'rgba(107,114,128,0.15)' : '#f3f4f6') }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: boolVal ? (isDark ? '#4ade80' : '#16a34a') : palette.textTertiary }}>
                            {boolVal ? 'Yes' : 'No'}
                          </Text>
                        </Pressable>
                      ) : isEditing ? (
                        <TextInput value={ruleDraft} onChangeText={setRuleDraft}
                          onBlur={() => handleRuleSave(rule._id)}
                          onSubmitEditing={() => handleRuleSave(rule._id)}
                          autoFocus keyboardType="numbers-and-punctuation" textAlign="right"
                          style={{ fontSize: 14, fontWeight: '700', fontFamily: 'monospace', color: accent, width: 70, borderBottomWidth: 1, borderBottomColor: accentTint(accent, 0.4), paddingVertical: 2 }} />
                      ) : (
                        <Pressable onPress={() => { setEditingRule(rule._id); setRuleDraft(rule.value) }}
                          className="flex-row items-center" style={{ gap: 4 }}>
                          {isModified && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: accent }} />}
                          <Text style={{ fontSize: 14, fontWeight: isModified ? '700' : '500', fontFamily: 'monospace', color: isModified ? accent : palette.text }}>
                            {rule.value}
                          </Text>
                          {rule.unit && (
                            <Text style={{ fontSize: 12, color: palette.textTertiary }}>{rule.unit}</Text>
                          )}
                        </Pressable>
                      )}

                      {/* Reset */}
                      {isModified && !isBool && (
                        <Pressable onPress={() => handleRuleReset(rule._id)} className="ml-2 p-1 active:opacity-60">
                          <RotateCcw size={12} color={palette.textTertiary} strokeWidth={2} />
                        </Pressable>
                      )}
                    </View>
                  </View>
                )
              })}
            </View>
          )
        })}

        {rules.length === 0 && tables.length === 0 && (
          <View className="items-center justify-center py-16">
            <Text style={{ fontSize: 15, color: palette.textTertiary }}>No data configured for this tab</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
