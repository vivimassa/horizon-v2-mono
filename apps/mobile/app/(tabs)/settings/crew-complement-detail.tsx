import { useState, useCallback, useEffect, useMemo, memo } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type CrewComplementRef, type CrewPositionRef } from '@skyhub/api'
import { ChevronLeft, ChevronRight, Pencil, X, Trash2, Lock } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { useOperatorId } from '../../../hooks/useOperatorId'
import { COMPLEMENT_TEMPLATES } from '@skyhub/logic'

const PROTECTED = new Set(['standard', 'aug1', 'aug2'])
const TEMPLATE_COLORS: Record<string, string> = { standard: '#22c55e', aug1: '#f59e0b', aug2: '#ef4444' }

export default function CrewComplementDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const operatorId = useOperatorId()

  const [comp, setComp] = useState<CrewComplementRef | null>(null)
  const [positions, setPositions] = useState<CrewPositionRef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draftCounts, setDraftCounts] = useState<Record<string, string>>({})
  const [draftNotes, setDraftNotes] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !operatorId) return
    setError(null)
    Promise.all([api.getCrewComplements(operatorId), api.getCrewPositions(operatorId)])
      .then(([comps, pos]) => {
        setComp(comps.find(c => c._id === id) ?? null)
        setPositions(pos.sort((a, b) => {
          if (a.category !== b.category) return a.category === 'cockpit' ? -1 : 1
          return a.rankOrder - b.rankOrder
        }))
      })
      .catch((err: any) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [id, operatorId])

  const handleSave = useCallback(async () => {
    if (!comp) return
    setSaving(true)
    try {
      const counts: Record<string, number> = {}
      for (const [k, v] of Object.entries(draftCounts)) {
        const n = parseInt(v, 10)
        if (!isNaN(n) && n >= 0) counts[k] = n
      }
      const payload: Partial<CrewComplementRef> = {}
      if (Object.keys(counts).length > 0) payload.counts = { ...comp.counts, ...counts }
      if (draftNotes !== null) payload.notes = draftNotes || null
      if (Object.keys(payload).length === 0) { setEditing(false); return }
      const updated = await api.updateCrewComplement(comp._id, payload)
      setComp(updated)
      setDraftCounts({})
      setDraftNotes(null)
      setEditing(false)
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save')
    } finally { setSaving(false) }
  }, [comp, draftCounts, draftNotes])

  const handleDelete = useCallback(() => {
    if (!comp) return
    if (PROTECTED.has(comp.templateKey)) {
      Alert.alert('Cannot Delete', 'Standard, Augmented 1 and Augmented 2 templates are protected and cannot be deleted.')
      return
    }
    Alert.alert('Delete Template', `Delete "${comp.templateKey}" for ${comp.aircraftTypeIcao}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.deleteCrewComplement(comp._id); router.back() }
        catch (err: any) { Alert.alert('Cannot Delete', err.message || 'Failed') }
      }},
    ])
  }, [comp, router])

  const tplDef = useMemo(() => COMPLEMENT_TEMPLATES.find(t => t.key === comp?.templateKey), [comp])
  const badgeColor = comp ? (TEMPLATE_COLORS[comp.templateKey] ?? accent) : accent
  const isProtected = comp ? PROTECTED.has(comp.templateKey) : false

  const cockpitPositions = useMemo(() => positions.filter(p => p.category === 'cockpit'), [positions])
  const cabinPositions = useMemo(() => positions.filter(p => p.category === 'cabin'), [positions])

  const getCount = (posCode: string): string => {
    if (posCode in draftCounts) return draftCounts[posCode]
    return String(comp?.counts[posCode] ?? 0)
  }
  const total = useMemo(() => {
    if (!comp) return 0
    let sum = 0
    for (const p of positions) {
      const v = posCode(p) in draftCounts ? parseInt(draftCounts[posCode(p)], 10) : (comp.counts[posCode(p)] ?? 0)
      if (!isNaN(v)) sum += v
    }
    return sum
  }, [comp, positions, draftCounts])

  if (loading || (!comp && !error)) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>{loading ? 'Loading...' : 'Not found'}</Text>
        </View>
      </SafeAreaView>
    )
  }
  if (error || !comp) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="px-4 pt-4 pb-4" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <ChevronLeft size={24} color={accent} strokeWidth={2} />
          </Pressable>
        </View>
        <View className="flex-1 justify-center items-center px-8">
          <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center' }}>{error ?? 'Not found'}</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-4 pb-4" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-2">
            <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
              <ChevronLeft size={24} color={accent} strokeWidth={2} />
            </Pressable>
            <Text style={{ fontSize: 20, fontWeight: '700', fontFamily: 'monospace', color: accent, marginRight: 8 }}>
              {comp.aircraftTypeIcao}
            </Text>
            <View className="px-2 py-0.5 rounded" style={{ backgroundColor: `${badgeColor}20` }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: badgeColor }}>
                {tplDef?.badge ?? comp.templateKey.toUpperCase()}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            {editing ? (
              <>
                <Pressable onPress={() => { setEditing(false); setDraftCounts({}); setDraftNotes(null) }} className="active:opacity-60">
                  <X size={20} color={palette.textSecondary} strokeWidth={1.8} />
                </Pressable>
                <Pressable onPress={handleSave} disabled={saving}
                  className="px-4 py-2.5 rounded-lg active:opacity-60" style={{ backgroundColor: accent }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{saving ? 'Saving...' : 'Save'}</Text>
                </Pressable>
              </>
            ) : (
              <>
                {!isProtected && (
                  <Pressable onPress={handleDelete} className="active:opacity-60">
                    <Trash2 size={18} color={palette.textTertiary} strokeWidth={1.8} />
                  </Pressable>
                )}
                <Pressable onPress={() => { setDraftCounts({}); setDraftNotes(null); setEditing(true) }}
                  className="flex-row items-center px-3 py-1.5 rounded-lg active:opacity-60"
                  style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}>
                  <Pencil size={15} color={accent} strokeWidth={1.8} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: accent, marginLeft: 6 }}>Edit</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
        <View className="flex-row items-center mt-2 flex-wrap" style={{ gap: 6, marginLeft: 36 }}>
          <Text style={{ fontSize: 14, color: palette.textSecondary }}>{tplDef?.label ?? comp.templateKey}</Text>
          {isProtected && <Lock size={11} color={palette.textTertiary} strokeWidth={2} />}
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {/* Total */}
        <View className="flex-row items-center justify-between mb-4 px-1">
          <Text style={{ fontSize: 14, fontWeight: '600', color: palette.textSecondary }}>Total Crew</Text>
          <Text style={{ fontSize: 22, fontWeight: '800', fontFamily: 'monospace', color: accent }}>{total}</Text>
        </View>

        {/* Flight Deck accordion */}
        {cockpitPositions.length > 0 && (
          <PositionAccordion
            label="Flight Deck"
            sectionColor="#3b82f6"
            positions={cockpitPositions}
            getCount={getCount}
            editing={editing}
            onCountChange={(code, v) => setDraftCounts(prev => ({ ...prev, [code]: v }))}
            palette={palette}
            isDark={isDark}
            accent={accent}
          />
        )}

        {/* Cabin Crew accordion */}
        {cabinPositions.length > 0 && (
          <PositionAccordion
            label="Cabin Crew"
            sectionColor="#f59e0b"
            positions={cabinPositions}
            getCount={getCount}
            editing={editing}
            onCountChange={(code, v) => setDraftCounts(prev => ({ ...prev, [code]: v }))}
            palette={palette}
            isDark={isDark}
            accent={accent}
          />
        )}

        {/* Notes */}
        <View className="flex-row items-center mt-6 mb-2" style={{ gap: 6 }}>
          <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accent }} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: accent }}>Notes</Text>
        </View>
        {editing ? (
          <TextInput
            value={draftNotes ?? comp.notes ?? ''}
            onChangeText={setDraftNotes}
            placeholder="Optional notes..."
            placeholderTextColor={palette.textTertiary}
            multiline
            style={{ fontSize: 15, color: palette.text, minHeight: 60, textAlignVertical: 'top',
              borderWidth: 1, borderColor: palette.cardBorder, borderRadius: 10,
              paddingHorizontal: 12, paddingVertical: 10, backgroundColor: palette.card }}
          />
        ) : (
          <Text style={{ fontSize: 15, color: comp.notes ? palette.text : palette.textTertiary, paddingVertical: 8 }}>
            {comp.notes ?? '\u2014'}
          </Text>
        )}

        {/* Template description */}
        {tplDef?.description && (
          <View className="mt-4 p-3 rounded-lg" style={{ backgroundColor: accentTint(badgeColor, isDark ? 0.06 : 0.03), borderWidth: 1, borderColor: accentTint(badgeColor, 0.1) }}>
            <Text style={{ fontSize: 13, color: palette.textSecondary, lineHeight: 18 }}>{tplDef.description}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function posCode(p: CrewPositionRef): string { return p.code }

const PositionAccordion = memo(function PositionAccordion({
  label, sectionColor, positions, getCount, editing, onCountChange, palette, isDark, accent,
}: {
  label: string; sectionColor: string; positions: CrewPositionRef[];
  getCount: (code: string) => string; editing: boolean;
  onCountChange: (code: string, v: string) => void;
  palette: Palette; isDark: boolean; accent: string
}) {
  const [expanded, setExpanded] = useState(true)
  const sectionTotal = positions.reduce((s, p) => s + (parseInt(getCount(p.code), 10) || 0), 0)

  return (
    <View className="rounded-xl mb-3 overflow-hidden" style={{
      borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.card,
    }}>
      {/* Accordion header */}
      <Pressable
        onPress={() => setExpanded(prev => !prev)}
        className="flex-row items-center px-4 py-3 active:opacity-70"
        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)' }}
      >
        <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: sectionColor, marginRight: 8 }} />
        <ChevronRight size={14} color={palette.textTertiary} strokeWidth={2}
          style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }], marginRight: 6 }} />
        <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text, flex: 1 }}>{label}</Text>
        <Text style={{ fontSize: 15, fontWeight: '700', fontFamily: 'monospace', color: sectionColor }}>{sectionTotal}</Text>
      </Pressable>

      {/* Horizontal position row */}
      {expanded && (
        <View className="flex-row" style={{ borderTopWidth: 1, borderTopColor: palette.cardBorder }}>
          {positions.map((p, i) => {
            const color = p.color ?? accent
            const val = getCount(p.code)
            return (
              <View key={p._id} className="items-center flex-1 py-3" style={{
                borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: palette.cardBorder,
              }}>
                {/* Position code label */}
                <View className="flex-row items-center mb-2" style={{ gap: 3 }}>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />
                  <Text style={{ fontSize: 13, fontWeight: '700', fontFamily: 'monospace', color }}>{p.code}</Text>
                </View>
                {/* Count value */}
                {editing ? (
                  <TextInput
                    value={val}
                    onChangeText={(v) => onCountChange(p.code, v.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    maxLength={3}
                    textAlign="center"
                    style={{
                      fontSize: 22, fontWeight: '800', fontFamily: 'monospace', color: accent,
                      width: 44, height: 40, borderRadius: 8,
                      borderWidth: 1, borderColor: accentTint(accent, 0.3),
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    }}
                  />
                ) : (
                  <Text style={{ fontSize: 22, fontWeight: '800', fontFamily: 'monospace', color: accent }}>
                    {val}
                  </Text>
                )}
                {/* Position name below */}
                <Text style={{ fontSize: 11, color: palette.textTertiary, marginTop: 3, textAlign: 'center' }} numberOfLines={1}>
                  {p.name}
                </Text>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
})
