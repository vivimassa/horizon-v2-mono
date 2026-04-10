import { useState, useCallback, useEffect, useMemo } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type DutyPatternRef } from '@skyhub/api'
import { ChevronLeft, Pencil, X, Trash2, Plus, Minus } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { useOperatorId } from '../../../hooks/useOperatorId'

const ON_COLOR = '#06C270'
const OFF_COLOR = '#FF5C5C'
const OFF_CODES = ['DO', 'RDO', 'AO', 'LV', 'REST']

export default function DutyPatternDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const operatorId = useOperatorId()

  const [pattern, setPattern] = useState<DutyPatternRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Record<string, any>>({})
  const [draftSeq, setDraftSeq] = useState<number[] | null>(null)

  useEffect(() => {
    if (!id || !operatorId) return
    setError(null)
    api.getDutyPatterns(operatorId)
      .then(list => setPattern(list.find(p => p._id === id) ?? null))
      .catch((err: any) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [id, operatorId])

  const get = (key: string) => (key in draft ? draft[key] : (pattern as any)?.[key])
  const seq = draftSeq ?? pattern?.sequence ?? []

  const handleFieldChange = useCallback((key: string, value: any) => {
    setDraft(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!pattern) return
    const payload: Partial<DutyPatternRef> = { ...draft }
    if (draftSeq) payload.sequence = draftSeq
    if (Object.keys(payload).length === 0) { setEditing(false); return }
    setSaving(true)
    try {
      const updated = await api.updateDutyPattern(pattern._id, payload)
      setPattern(updated)
      setDraft({})
      setDraftSeq(null)
      setEditing(false)
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save')
    } finally { setSaving(false) }
  }, [pattern, draft, draftSeq])

  const handleDelete = useCallback(() => {
    if (!pattern) return
    Alert.alert('Delete Pattern', `Delete pattern "${pattern.code}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.deleteDutyPattern(pattern._id); router.back() }
        catch (err: any) { Alert.alert('Cannot Delete', err.message || 'Failed') }
      }},
    ])
  }, [pattern, router])

  const startEditing = useCallback(() => {
    setDraft({})
    setDraftSeq(pattern ? [...pattern.sequence] : null)
    setEditing(true)
  }, [pattern])

  const cancelEditing = useCallback(() => {
    setDraft({})
    setDraftSeq(null)
    setEditing(false)
  }, [])

  // Computed stats
  const onDays = seq.filter((_, i) => i % 2 === 0).reduce((s, n) => s + n, 0)
  const cycleDays = seq.reduce((s, n) => s + n, 0)
  const offDays = cycleDays - onDays
  const ratio = cycleDays > 0 ? Math.round((onDays / cycleDays) * 100) : 0

  if (loading || (!pattern && !error)) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>{loading ? 'Loading...' : 'Not found'}</Text>
        </View>
      </SafeAreaView>
    )
  }
  if (error || !pattern) {
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
            <Text style={{ fontSize: 24, fontWeight: '700', fontFamily: 'monospace', color: accent, marginRight: 8 }}>
              {pattern.code}
            </Text>
            {pattern.isActive ? (
              <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7' }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#4ade80' : '#166534' }}>Active</Text>
              </View>
            ) : (
              <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#f87171' : '#991b1b' }}>Inactive</Text>
              </View>
            )}
          </View>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            {editing ? (
              <>
                <Pressable onPress={cancelEditing} className="active:opacity-60">
                  <X size={20} color={palette.textSecondary} strokeWidth={1.8} />
                </Pressable>
                <Pressable onPress={handleSave} disabled={saving}
                  className="px-4 py-2.5 rounded-lg active:opacity-60" style={{ backgroundColor: accent }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{saving ? 'Saving...' : 'Save'}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={handleDelete} className="active:opacity-60">
                  <Trash2 size={18} color={palette.textTertiary} strokeWidth={1.8} />
                </Pressable>
                <Pressable onPress={startEditing}
                  className="flex-row items-center px-3 py-1.5 rounded-lg active:opacity-60"
                  style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}>
                  <Pencil size={15} color={accent} strokeWidth={1.8} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: accent, marginLeft: 6 }}>Edit</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {/* Segment bar */}
        <View className="flex-row rounded-lg overflow-hidden mb-4" style={{ height: 12 }}>
          {seq.map((days, i) => (
            <View key={i} style={{ flex: days, backgroundColor: i % 2 === 0 ? ON_COLOR : OFF_COLOR, opacity: i % 2 === 0 ? 0.7 : 0.35 }} />
          ))}
        </View>

        {/* Stats */}
        <View className="flex-row items-center justify-around mb-4 py-3 rounded-lg" style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder }}>
          <View className="items-center">
            <Text style={{ fontSize: 22, fontWeight: '800', fontFamily: 'monospace', color: accent }}>{cycleDays}</Text>
            <Text style={{ fontSize: 12, color: palette.textTertiary }}>Cycle Days</Text>
          </View>
          <View className="items-center">
            <Text style={{ fontSize: 22, fontWeight: '800', fontFamily: 'monospace', color: ON_COLOR }}>{onDays}</Text>
            <Text style={{ fontSize: 12, color: palette.textTertiary }}>On Days</Text>
          </View>
          <View className="items-center">
            <Text style={{ fontSize: 22, fontWeight: '800', fontFamily: 'monospace', color: OFF_COLOR }}>{offDays}</Text>
            <Text style={{ fontSize: 12, color: palette.textTertiary }}>Off Days</Text>
          </View>
          <View className="items-center">
            <Text style={{ fontSize: 22, fontWeight: '800', fontFamily: 'monospace', color: palette.text }}>{ratio}%</Text>
            <Text style={{ fontSize: 12, color: palette.textTertiary }}>On Ratio</Text>
          </View>
        </View>

        {/* Sequence editor / display */}
        <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
          <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accent }} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: accent }}>Sequence</Text>
        </View>
        <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
          {seq.map((days, i) => (
            <View key={i} className="items-center rounded-lg p-2" style={{
              backgroundColor: i % 2 === 0 ? `${ON_COLOR}15` : `${OFF_COLOR}15`,
              borderWidth: 1, borderColor: i % 2 === 0 ? `${ON_COLOR}30` : `${OFF_COLOR}30`,
              minWidth: 56,
            }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: i % 2 === 0 ? ON_COLOR : OFF_COLOR, marginBottom: 4 }}>
                {i % 2 === 0 ? 'ON' : 'OFF'}
              </Text>
              {editing && draftSeq ? (
                <TextInput value={String(days)} keyboardType="numeric" textAlign="center"
                  onChangeText={(v) => {
                    const n = parseInt(v, 10)
                    if (v === '' || (!isNaN(n) && n >= 1)) {
                      const next = [...draftSeq]
                      next[i] = v === '' ? 1 : n
                      setDraftSeq(next)
                    }
                  }}
                  style={{ fontSize: 20, fontWeight: '800', fontFamily: 'monospace', color: i % 2 === 0 ? ON_COLOR : OFF_COLOR, width: 40, borderBottomWidth: 1, borderBottomColor: i % 2 === 0 ? ON_COLOR : OFF_COLOR, paddingVertical: 2 }} />
              ) : (
                <Text style={{ fontSize: 20, fontWeight: '800', fontFamily: 'monospace', color: i % 2 === 0 ? ON_COLOR : OFF_COLOR }}>
                  {days}
                </Text>
              )}
            </View>
          ))}
          {/* Add/Remove pair buttons */}
          {editing && draftSeq && (
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <Pressable onPress={() => setDraftSeq(prev => prev ? [...prev, 1, 1] : [1, 1])}
                className="items-center justify-center rounded-lg active:opacity-60"
                style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}>
                <Plus size={16} color={accent} strokeWidth={2} />
              </Pressable>
              {draftSeq.length > 2 && (
                <Pressable onPress={() => setDraftSeq(prev => prev ? prev.slice(0, -2) : null)}
                  className="items-center justify-center rounded-lg active:opacity-60"
                  style={{ width: 36, height: 36, backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}>
                  <Minus size={16} color={isDark ? '#f87171' : '#dc2626'} strokeWidth={2} />
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* Fields */}
        <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
          <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accent }} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: accent }}>Details</Text>
        </View>
        <View className={isTablet ? 'flex-row flex-wrap' : ''}>
          <Field label="Description" value={pattern.description} editing={editing} fieldKey="description"
            editValue={get('description')} onChange={handleFieldChange} palette={palette} half={isTablet} />
          <Field label="Sort Order" value={pattern.sortOrder} editing={editing} fieldKey="sortOrder"
            editValue={get('sortOrder')} onChange={handleFieldChange} palette={palette} numeric half={isTablet} />
        </View>

        {/* Off Code picker */}
        {editing ? (
          <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
            <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 6 }}>Off Code</Text>
            <View className="flex-row flex-wrap" style={{ gap: 6 }}>
              {OFF_CODES.map(code => {
                const active = (get('offCode') ?? pattern.offCode) === code
                return (
                  <Pressable key={code} onPress={() => handleFieldChange('offCode', code)}
                    className="px-3 py-2 rounded-lg"
                    style={{ backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent', borderWidth: 1, borderColor: active ? accent : palette.cardBorder }}>
                    <Text style={{ fontSize: 14, fontWeight: active ? '600' : '400', fontFamily: 'monospace', color: active ? accent : palette.text }}>{code}</Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        ) : (
          <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
            <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>Off Code</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', fontFamily: 'monospace', color: palette.text }}>{pattern.offCode}</Text>
          </View>
        )}

        {editing && (
          <ToggleField label="Active" value={pattern.isActive} editing fieldKey="isActive"
            editValue={get('isActive')} onChange={handleFieldChange} palette={palette} isDark={isDark} />
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Field({ label, value, editing, fieldKey, editValue, onChange, palette, numeric, half }: {
  label: string; value: any; editing: boolean; fieldKey: string; editValue: any;
  onChange: (k: string, v: any) => void; palette: Palette; numeric?: boolean; half?: boolean
}) {
  const halfStyle = half ? { width: '50%' as const, paddingRight: 12 } : {}
  if (editing) {
    return (
      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...halfStyle }}>
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
        <TextInput value={editValue != null ? String(editValue) : ''}
          onChangeText={(v) => onChange(fieldKey, numeric ? (v === '' ? null : Number(v)) : v)}
          keyboardType={numeric ? 'numeric' : 'default'}
          style={{ fontSize: 15, fontWeight: '500', color: palette.text, borderBottomWidth: 1, borderBottomColor: accentTint(palette.text, 0.15), paddingVertical: 4 }}
          placeholderTextColor={palette.textTertiary} />
      </View>
    )
  }
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...halfStyle }}>
      <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }}>{value ?? '\u2014'}</Text>
    </View>
  )
}

function ToggleField({ label, value, editing, fieldKey, editValue, onChange, palette, isDark }: {
  label: string; value: boolean; editing: boolean; fieldKey: string; editValue: any;
  onChange: (k: string, v: any) => void; palette: Palette; isDark: boolean
}) {
  const current = editing ? !!editValue : value
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
      <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      {editing ? (
        <Pressable onPress={() => onChange(fieldKey, !editValue)} className="self-start px-3 py-1 rounded-lg"
          style={{ backgroundColor: current ? (isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7') : (isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2') }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: current ? (isDark ? '#4ade80' : '#16a34a') : (isDark ? '#f87171' : '#dc2626') }}>
            {current ? 'Yes' : 'No'}
          </Text>
        </Pressable>
      ) : (
        <Text style={{ fontSize: 15, fontWeight: '600', color: value ? (isDark ? '#4ade80' : '#16a34a') : palette.textSecondary }}>{value ? 'Yes' : 'No'}</Text>
      )}
    </View>
  )
}
