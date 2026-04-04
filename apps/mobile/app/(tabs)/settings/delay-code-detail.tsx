import { useState, useCallback, useEffect } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type DelayCodeRef } from '@skyhub/api'
import { ChevronLeft, Pencil, Save, X, Trash2, Timer } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { ColorSwatchPicker } from '../../../components/lopa/ColorSwatchPicker'

const CATEGORIES = [
  'Airline Internal', 'Passenger & Baggage', 'Cargo & Mail', 'Aircraft Handling',
  'Technical', 'Damage & EDP', 'Operations & Crew', 'Weather', 'ATC & Airport', 'Reactionary & Misc',
]
const CATEGORY_COLORS: Record<string, string> = {
  'Airline Internal': '#6b7280', 'Passenger & Baggage': '#3b82f6', 'Cargo & Mail': '#10b981',
  'Aircraft Handling': '#f59e0b', 'Technical': '#ef4444', 'Damage & EDP': '#e11d48',
  'Operations & Crew': '#8b5cf6', 'Weather': '#0ea5e9', 'ATC & Airport': '#6366f1',
  'Reactionary & Misc': '#a855f7',
}

export default function DelayCodeDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, isDark, accent } = useAppTheme()

  const [code, setCode] = useState<DelayCodeRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!id) return
    api.getDelayCodes().then(codes => setCode(codes.find(c => c._id === id) ?? null))
      .catch(console.error).finally(() => setLoading(false))
  }, [id])

  const get = (key: string) => (key in draft ? draft[key] : (code as any)?.[key])
  const handleFieldChange = useCallback((key: string, value: any) => { setDraft(prev => ({ ...prev, [key]: value })) }, [])

  const handleSave = useCallback(async () => {
    if (!code || Object.keys(draft).length === 0) { setEditing(false); return }
    setSaving(true)
    try { const updated = await api.updateDelayCode(code._id, draft); setCode(updated); setDraft({}); setEditing(false) }
    catch (err: any) { Alert.alert('Save Failed', err.message || 'Could not save') }
    finally { setSaving(false) }
  }, [code, draft])

  const handleDelete = useCallback(() => {
    if (!code) return
    Alert.alert('Delete Delay Code', `Delete ${code.code} — ${code.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.deleteDelayCode(code._id); router.back() }
        catch (err: any) { let msg = err.message || 'Failed'; try { const m = msg.match(/API (\d+): (.+)/); if (m) msg = JSON.parse(m[2]).error || msg } catch {}; Alert.alert('Cannot Delete', msg) }
      }},
    ])
  }, [code, router])

  if (loading || !code) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>{loading ? 'Loading...' : 'Delay code not found'}</Text>
        </View>
      </SafeAreaView>
    )
  }

  const catColor = CATEGORY_COLORS[code.category] || '#6b7280'
  const hasAhm732 = code.ahm732Process || code.ahm732Reason || code.ahm732Stakeholder

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-2 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-2">
            <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
              <ChevronLeft size={24} color={accent} strokeWidth={2} />
            </Pressable>
            <Text style={{ fontSize: 24, fontWeight: '700', fontFamily: 'monospace', color: palette.text, marginRight: 8 }}>{code.code}</Text>
            {code.alphaCode && (
              <View className="px-2 py-0.5 rounded mr-2" style={{ backgroundColor: `${catColor}20` }}>
                <Text style={{ fontSize: 13, fontWeight: '700', fontFamily: 'monospace', color: catColor }}>{code.alphaCode}</Text>
              </View>
            )}
            <Text style={{ fontSize: 18, fontWeight: '600', color: palette.text, flex: 1 }} numberOfLines={1}>{code.name}</Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            {editing ? (
              <>
                <Pressable onPress={() => { setEditing(false); setDraft({}) }} className="active:opacity-60">
                  <X size={20} color={palette.textSecondary} strokeWidth={1.8} />
                </Pressable>
                <Pressable onPress={handleSave} disabled={saving} className="px-3 py-1.5 rounded-lg active:opacity-60" style={{ backgroundColor: accent }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{saving ? 'Saving...' : 'Save'}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={handleDelete} className="active:opacity-60"><Trash2 size={18} color={palette.textTertiary} strokeWidth={1.8} /></Pressable>
                <Pressable onPress={() => { setDraft({}); setEditing(true) }} className="flex-row items-center px-3 py-1.5 rounded-lg active:opacity-60"
                  style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}>
                  <Pencil size={15} color={accent} strokeWidth={1.8} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: accent, marginLeft: 6 }}>Edit</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
        <View className="flex-row items-center mt-2 flex-wrap" style={{ gap: 6, marginLeft: 36 }}>
          <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: `${catColor}20` }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: catColor }}>{code.category}</Text>
          </View>
          {code.isIataStandard && (
            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff' }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#818cf8' : '#4338ca' }}>IATA Standard</Text>
            </View>
          )}
          {code.isActive ? (
            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7' }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#4ade80' : '#166534' }}>Active</Text>
            </View>
          ) : (
            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#f87171' : '#991b1b' }}>Inactive</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {/* AHM 732 Card */}
        <View className="rounded-xl mb-4" style={{ backgroundColor: accentTint(accent, isDark ? 0.08 : 0.04), borderWidth: 1, borderColor: accentTint(accent, 0.15), padding: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>AHM 732 Mapping</Text>
          {editing ? (
            <View className="flex-row items-center justify-center" style={{ gap: 8 }}>
              <TripleBox label="Process" value={get('ahm732Process')} onChange={(v) => handleFieldChange('ahm732Process', v)} palette={palette} accent={accent} isDark={isDark} />
              <Text style={{ fontSize: 20, fontWeight: '300', color: palette.textTertiary }}>—</Text>
              <TripleBox label="Reason" value={get('ahm732Reason')} onChange={(v) => handleFieldChange('ahm732Reason', v)} palette={palette} accent={accent} isDark={isDark} />
              <Text style={{ fontSize: 20, fontWeight: '300', color: palette.textTertiary }}>—</Text>
              <TripleBox label="Stakeholder" value={get('ahm732Stakeholder')} onChange={(v) => handleFieldChange('ahm732Stakeholder', v)} palette={palette} accent={accent} isDark={isDark} />
            </View>
          ) : hasAhm732 ? (
            <View className="items-center">
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <TripleBoxDisplay label="Process" value={code.ahm732Process} palette={palette} accent={accent} isDark={isDark} />
                <Text style={{ fontSize: 20, fontWeight: '300', color: palette.textTertiary }}>—</Text>
                <TripleBoxDisplay label="Reason" value={code.ahm732Reason} palette={palette} accent={accent} isDark={isDark} />
                <Text style={{ fontSize: 20, fontWeight: '300', color: palette.textTertiary }}>—</Text>
                <TripleBoxDisplay label="Stakeholder" value={code.ahm732Stakeholder} palette={palette} accent={accent} isDark={isDark} />
              </View>
            </View>
          ) : (
            <Text style={{ fontSize: 13, color: palette.textSecondary, textAlign: 'center' }}>No AHM 732 mapping yet</Text>
          )}
        </View>

        {/* Fields */}
        <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
          <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accent }} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: accent }}>Legacy Code</Text>
        </View>

        <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
          <View style={{ width: '50%', paddingHorizontal: 6 }}>
            <Field label="Numeric Code" value={code.code} editing={editing} fieldKey="code" editValue={get('code')} onChange={handleFieldChange} palette={palette} mono maxLength={3} />
          </View>
          <View style={{ width: '50%', paddingHorizontal: 6 }}>
            <Field label="Alpha Sub-Code" value={code.alphaCode} editing={editing} fieldKey="alphaCode" editValue={get('alphaCode')} onChange={handleFieldChange} palette={palette} mono maxLength={2} />
          </View>
          <View style={{ width: '50%', paddingHorizontal: 6 }}>
            <Field label="Name" value={code.name} editing={editing} fieldKey="name" editValue={get('name')} onChange={handleFieldChange} palette={palette} />
          </View>
          <View style={{ width: '50%', paddingHorizontal: 6 }}>
            <ToggleField label="IATA Standard" value={code.isIataStandard} editing={editing} fieldKey="isIataStandard" editValue={get('isIataStandard')} onChange={handleFieldChange} palette={palette} isDark={isDark} />
          </View>
        </View>

        <PickerField label="Category" value={code.category} options={CATEGORIES} editing={editing} fieldKey="category" editValue={get('category')} onChange={handleFieldChange} palette={palette} isDark={isDark} accent={accent} />

        <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 6 }}>Color</Text>
          <ColorSwatchPicker value={get('color') || catColor} onChange={(v) => handleFieldChange('color', v)} palette={palette} isDark={isDark} editing={editing} />
        </View>

        <Field label="Description" value={code.description} editing={editing} fieldKey="description" editValue={get('description')} onChange={handleFieldChange} palette={palette} multiline />
        <ToggleField label="Active" value={code.isActive} editing={editing} fieldKey="isActive" editValue={get('isActive')} onChange={handleFieldChange} palette={palette} isDark={isDark} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ── AHM 732 Triple Box (editable) ──
function TripleBox({ label, value, onChange, palette, accent, isDark }: {
  label: string; value: string | null; onChange: (v: string | null) => void; palette: Palette; accent: string; isDark: boolean
}) {
  return (
    <View className="items-center" style={{ gap: 4 }}>
      <TextInput
        value={value || ''}
        onChangeText={(v) => onChange(v.toUpperCase().slice(0, 1) || null)}
        maxLength={1}
        autoCapitalize="characters"
        textAlign="center"
        style={{
          width: 48, height: 48, fontSize: 22, fontWeight: '700', fontFamily: 'monospace',
          color: accent, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
          borderWidth: 2, borderColor: accentTint(accent, 0.3), borderRadius: 12,
        }}
      />
      <Text style={{ fontSize: 10, fontWeight: '600', color: palette.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
    </View>
  )
}

// ── AHM 732 Triple Box (read-only) ──
function TripleBoxDisplay({ label, value, palette, accent, isDark }: {
  label: string; value: string | null; palette: Palette; accent: string; isDark: boolean
}) {
  return (
    <View className="items-center" style={{ gap: 4 }}>
      <View className="items-center justify-center" style={{
        width: 48, height: 48, borderRadius: 12,
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
        borderWidth: 1, borderColor: palette.cardBorder,
      }}>
        <Text style={{ fontSize: 22, fontWeight: '700', fontFamily: 'monospace', color: accent }}>{value || '—'}</Text>
      </View>
      <Text style={{ fontSize: 10, fontWeight: '600', color: palette.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
    </View>
  )
}

// ── Shared field components ──
function Field({ label, value, editing, fieldKey, editValue, onChange, palette, mono, maxLength, multiline }: {
  label: string; value: any; editing: boolean; fieldKey: string; editValue: any;
  onChange: (k: string, v: any) => void; palette: Palette; mono?: boolean; maxLength?: number; multiline?: boolean
}) {
  if (editing) {
    return (
      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
        <TextInput value={editValue != null ? String(editValue) : ''} onChangeText={(v) => { if (mono) v = v.toUpperCase(); onChange(fieldKey, v) }}
          autoCapitalize={mono ? 'characters' : 'sentences'} maxLength={maxLength} multiline={multiline}
          style={{ fontSize: 15, fontWeight: '500', color: palette.text, fontFamily: mono ? 'monospace' : undefined, borderBottomWidth: 1, borderBottomColor: accentTint('#1e40af', 0.3), paddingVertical: 4, minHeight: multiline ? 60 : undefined, textAlignVertical: multiline ? 'top' : undefined }}
          placeholderTextColor={palette.textTertiary} />
      </View>
    )
  }
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
      <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text, fontFamily: mono ? 'monospace' : undefined }}>{value ?? '---'}</Text>
    </View>
  )
}

function PickerField({ label, value, options, editing, fieldKey, editValue, onChange, palette, isDark, accent }: {
  label: string; value: any; options: string[]; editing: boolean; fieldKey: string; editValue: any;
  onChange: (k: string, v: any) => void; palette: Palette; isDark: boolean; accent: string
}) {
  if (editing) {
    return (
      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
        <View className="flex-row flex-wrap" style={{ gap: 6 }}>
          {options.map(opt => {
            const active = (editValue || value) === opt
            const optColor = CATEGORY_COLORS[opt]
            return (
              <Pressable key={opt} onPress={() => onChange(fieldKey, opt)} className="flex-row items-center px-2.5 py-1.5 rounded-lg"
                style={{ backgroundColor: active ? accentTint(optColor || accent, isDark ? 0.15 : 0.08) : 'transparent', borderWidth: 1, borderColor: active ? (optColor || accent) : palette.cardBorder, gap: 4 }}>
                {optColor && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: optColor }} />}
                <Text style={{ fontSize: 11, fontWeight: active ? '600' : '400', color: active ? (optColor || accent) : palette.text }}>{opt}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    )
  }
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
      <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }}>{value ?? '---'}</Text>
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
          <Text style={{ fontSize: 13, fontWeight: '600', color: current ? (isDark ? '#4ade80' : '#16a34a') : (isDark ? '#f87171' : '#dc2626') }}>{current ? 'Yes' : 'No'}</Text>
        </Pressable>
      ) : (
        <Text style={{ fontSize: 15, fontWeight: '600', color: value ? (isDark ? '#4ade80' : '#16a34a') : palette.textSecondary }}>{value ? 'Yes' : 'No'}</Text>
      )}
    </View>
  )
}
