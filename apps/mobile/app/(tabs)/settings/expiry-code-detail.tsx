import { useState, useCallback, useEffect, useMemo } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type ExpiryCodeRef, type ExpiryCodeCategoryRef, type CrewPositionRef } from '@skyhub/api'
import { ChevronLeft, Pencil, X, Trash2 } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { useOperatorId } from '../../../hooks/useOperatorId'
import { EXPIRY_FORMULAS, SEVERITY_DEFINITIONS } from '@skyhub/logic'

const CREW_CATS: Array<{ key: string; label: string }> = [
  { key: 'both', label: 'All Crew' }, { key: 'cockpit', label: 'Flight Deck' }, { key: 'cabin', label: 'Cabin Crew' },
]

export default function ExpiryCodeDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const operatorId = useOperatorId()

  const [code, setCode] = useState<ExpiryCodeRef | null>(null)
  const [categories, setCategories] = useState<ExpiryCodeCategoryRef[]>([])
  const [positions, setPositions] = useState<CrewPositionRef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!id || !operatorId) return
    setError(null)
    Promise.all([
      api.getExpiryCodes(operatorId, true),
      api.getExpiryCodeCategories(operatorId),
      api.getCrewPositions(operatorId),
    ])
      .then(([codes, cats, pos]) => {
        setCode(codes.find(c => c._id === id) ?? null)
        setCategories(cats)
        setPositions(pos)
      })
      .catch((err: any) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [id, operatorId])

  const get = (key: string) => (key in draft ? draft[key] : (code as any)?.[key])
  const handleFieldChange = useCallback((key: string, value: any) => {
    setDraft(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!code || Object.keys(draft).length === 0) { setEditing(false); return }
    setSaving(true)
    try {
      const updated = await api.updateExpiryCode(code._id, draft)
      setCode(updated)
      setDraft({})
      setEditing(false)
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save changes')
    } finally { setSaving(false) }
  }, [code, draft])

  const handleDelete = useCallback(() => {
    if (!code) return
    Alert.alert('Delete Expiry Code', `Delete ${code.code} — ${code.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Deactivate', onPress: async () => {
        try { const u = await api.updateExpiryCode(code._id, { isActive: false }); setCode(u) }
        catch (err: any) { Alert.alert('Error', err.message || 'Failed') }
      }},
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.deleteExpiryCode(code._id); router.back() }
        catch (err: any) { Alert.alert('Cannot Delete', err.message || 'Failed') }
      }},
    ])
  }, [code, router])

  const catLabel = useMemo(() => categories.find(c => c._id === code?.categoryId)?.label ?? '', [categories, code])
  const catColor = useMemo(() => categories.find(c => c._id === code?.categoryId)?.color ?? accent, [categories, code, accent])
  const formulaDef = useMemo(() => EXPIRY_FORMULAS.find(f => f.id === code?.formula), [code])

  const filteredPositions = useMemo(() => {
    const cc = get('crewCategory') ?? code?.crewCategory ?? 'both'
    return positions
      .filter(p => cc === 'both' || p.category === cc)
      .sort((a, b) => {
        if (a.category !== b.category) return a.category === 'cockpit' ? -1 : 1
        return a.rankOrder - b.rankOrder
      })
  }, [positions, code, draft])

  if (loading || (!code && !error)) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>{loading ? 'Loading...' : 'Not found'}</Text>
        </View>
      </SafeAreaView>
    )
  }
  if (error || !code) {
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
            <View className="px-2 py-0.5 rounded mr-2" style={{ backgroundColor: `${catColor}20` }}>
              <Text style={{ fontSize: 15, fontWeight: '700', fontFamily: 'monospace', color: catColor }}>{code.code}</Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: palette.text, flex: 1 }} numberOfLines={1}>{code.name}</Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            {editing ? (
              <>
                <Pressable onPress={() => { setEditing(false); setDraft({}) }} className="active:opacity-60">
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
                <Pressable onPress={() => { setDraft({}); setEditing(true) }}
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
          <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: `${catColor}20` }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: catColor }}>{catLabel}</Text>
          </View>
          <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: accent }}>{formulaDef?.label ?? code.formula}</Text>
          </View>
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
        {/* Code Information */}
        <SectionBar label="Code Information" color={accent} />
        <View className={isTablet ? 'flex-row flex-wrap' : ''}>
          <Field label="Code" value={code.code} editing={editing} fieldKey="code" editValue={get('code')} onChange={handleFieldChange} palette={palette} mono maxLength={10} half={isTablet} />
          <Field label="Name" value={code.name} editing={editing} fieldKey="name" editValue={get('name')} onChange={handleFieldChange} palette={palette} half={isTablet} />
          <Field label="Warning Days" value={code.warningDays} editing={editing} fieldKey="warningDays" editValue={get('warningDays')} onChange={handleFieldChange} palette={palette} numeric half={isTablet} />
          {!editing && <Field label="Category" value={catLabel} editing={false} fieldKey="" editValue="" onChange={() => {}} palette={palette} half={isTablet} />}
        </View>
        {editing && (
          <PickerField label="Category" options={categories.map(c => ({ key: c._id, label: c.label, color: c.color }))}
            editValue={get('categoryId')} fieldKey="categoryId" onChange={handleFieldChange} palette={palette} isDark={isDark} accent={accent} />
        )}
        <PickerField label="Crew Category" options={CREW_CATS.map(c => ({ key: c.key, label: c.label }))}
          editValue={editing ? get('crewCategory') : code.crewCategory} fieldKey="crewCategory" onChange={handleFieldChange}
          palette={palette} isDark={isDark} accent={accent} readOnly={!editing} />
        <Field label="Description" value={code.description} editing={editing} fieldKey="description" editValue={get('description')} onChange={handleFieldChange} palette={palette} multiline />

        {/* Formula */}
        <SectionBar label="Formula Configuration" color={accent} />
        {editing ? (
          <PickerField label="Formula" options={EXPIRY_FORMULAS.map(f => ({ key: f.id, label: f.label }))}
            editValue={get('formula')} fieldKey="formula" onChange={handleFieldChange} palette={palette} isDark={isDark} accent={accent} />
        ) : (
          <Field label="Formula" value={formulaDef?.label ?? code.formula} editing={false} fieldKey="" editValue="" onChange={() => {}} palette={palette} />
        )}
        {formulaDef && formulaDef.fields.length > 0 && (
          <View className={isTablet ? 'flex-row flex-wrap' : ''}>
            {formulaDef.fields.map(f => (
              <Field key={f.key} label={`${f.label}${f.unit ? ` (${f.unit})` : ''}`}
                value={(code.formulaParams as any)?.[f.key]}
                editing={editing} fieldKey={`fp_${f.key}`}
                editValue={draft[`fp_${f.key}`] ?? (code.formulaParams as any)?.[f.key]}
                onChange={(k, v) => {
                  const params = { ...(get('formulaParams') ?? code.formulaParams ?? {}), [f.key]: f.type === 'number' ? (v === '' ? null : Number(v)) : v }
                  handleFieldChange('formulaParams', params)
                }}
                palette={palette} numeric={f.type === 'number'} half={isTablet} />
            ))}
          </View>
        )}

        {/* Severity */}
        <SectionBar label="Enforcement Rules" color={accent} />
        <View style={{ gap: 6, marginBottom: 8 }}>
          {SEVERITY_DEFINITIONS.map(sev => {
            const active = (get('severity') ?? code.severity ?? []).includes(sev.key)
            return (
              <Pressable key={sev.key} disabled={!editing}
                onPress={() => {
                  const cur: string[] = [...(get('severity') ?? code.severity ?? [])]
                  const idx = cur.indexOf(sev.key)
                  if (idx >= 0) cur.splice(idx, 1); else cur.push(sev.key)
                  handleFieldChange('severity', cur)
                }}
                className="flex-row items-start p-3 rounded-lg" style={{
                  backgroundColor: active ? accentTint(sev.isDestructive ? '#ef4444' : accent, isDark ? 0.1 : 0.05) : 'transparent',
                  borderWidth: 1, borderColor: active ? (sev.isDestructive ? (isDark ? 'rgba(239,68,68,0.3)' : '#fecaca') : accentTint(accent, 0.2)) : palette.cardBorder,
                  opacity: editing ? 1 : (active ? 1 : 0.4),
                }}>
                <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2,
                  borderColor: active ? (sev.isDestructive ? '#ef4444' : accent) : palette.textTertiary,
                  backgroundColor: active ? (sev.isDestructive ? '#ef4444' : accent) : 'transparent',
                  marginRight: 10, marginTop: 1, alignItems: 'center', justifyContent: 'center' }}>
                  {active && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                </View>
                <View className="flex-1">
                  <Text style={{ fontSize: 14, fontWeight: '600', color: sev.isDestructive && active ? (isDark ? '#f87171' : '#dc2626') : palette.text }}>{sev.label}</Text>
                  <Text style={{ fontSize: 12, color: palette.textSecondary, marginTop: 2 }}>{sev.description}</Text>
                </View>
              </Pressable>
            )
          })}
        </View>

        {/* Positions */}
        <SectionBar label="Applicable Positions" color={accent} />
        <View className="flex-row flex-wrap" style={{ gap: 6, marginBottom: 8 }}>
          {filteredPositions.map(pos => {
            const active = (get('applicablePositions') ?? code.applicablePositions ?? []).includes(pos.code)
            return (
              <Pressable key={pos._id} disabled={!editing}
                onPress={() => {
                  const cur: string[] = [...(get('applicablePositions') ?? code.applicablePositions ?? [])]
                  const idx = cur.indexOf(pos.code)
                  if (idx >= 0) cur.splice(idx, 1); else cur.push(pos.code)
                  handleFieldChange('applicablePositions', cur)
                }}
                className="px-3 py-1.5 rounded-lg" style={{
                  backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent',
                  borderWidth: 1, borderColor: active ? accent : palette.cardBorder,
                  opacity: editing ? 1 : (active ? 1 : 0.3),
                }}>
                <Text style={{ fontSize: 13, fontWeight: active ? '600' : '400', color: active ? accent : palette.text }}>
                  {pos.code} — {pos.name}
                </Text>
              </Pressable>
            )
          })}
          {filteredPositions.length === 0 && (
            <Text style={{ fontSize: 13, color: palette.textTertiary }}>No positions available for this crew category</Text>
          )}
        </View>

        {/* Notes + Active */}
        <SectionBar label="Notes" color={accent} />
        <Field label="Notes" value={code.notes} editing={editing} fieldKey="notes" editValue={get('notes')} onChange={handleFieldChange} palette={palette} multiline />
        <ToggleField label="Active" value={code.isActive} editing={editing} fieldKey="isActive" editValue={get('isActive')} onChange={handleFieldChange} palette={palette} isDark={isDark} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Shared components ──

function SectionBar({ label, color }: { label: string; color: string }) {
  return (
    <View className="flex-row items-center mt-6 mb-2" style={{ gap: 6 }}>
      <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ fontSize: 14, fontWeight: '700', color }}>{label}</Text>
    </View>
  )
}

function Field({ label, value, editing, fieldKey, editValue, onChange, palette, mono, maxLength, multiline, numeric, half }: {
  label: string; value: any; editing: boolean; fieldKey: string; editValue: any;
  onChange: (k: string, v: any) => void; palette: Palette; mono?: boolean; maxLength?: number; multiline?: boolean; numeric?: boolean; half?: boolean
}) {
  const halfStyle = half ? { width: '50%' as const, paddingRight: 12 } : {}
  if (editing) {
    return (
      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...halfStyle }}>
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
        <TextInput value={editValue != null ? String(editValue) : ''}
          onChangeText={(v) => { if (mono) v = v.toUpperCase(); onChange(fieldKey, numeric ? (v === '' ? null : Number(v)) : v) }}
          autoCapitalize={mono ? 'characters' : 'sentences'} keyboardType={numeric ? 'numeric' : 'default'}
          maxLength={maxLength} multiline={multiline}
          style={{ fontSize: 15, fontWeight: '500', color: palette.text, fontFamily: mono ? 'monospace' : undefined,
            borderBottomWidth: 1, borderBottomColor: accentTint(palette.text, 0.15), paddingVertical: 4,
            minHeight: multiline ? 60 : undefined, textAlignVertical: multiline ? 'top' : undefined }}
          placeholderTextColor={palette.textTertiary} />
      </View>
    )
  }
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...halfStyle }}>
      <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text, fontFamily: mono ? 'monospace' : undefined }}>{value ?? '\u2014'}</Text>
    </View>
  )
}

function PickerField({ label, options, editValue, fieldKey, onChange, palette, isDark, accent, readOnly }: {
  label: string; options: Array<{ key: string; label: string; color?: string }>; editValue: any; fieldKey: string;
  onChange: (k: string, v: any) => void; palette: Palette; isDark: boolean; accent: string; readOnly?: boolean
}) {
  if (readOnly) {
    const opt = options.find(o => o.key === editValue)
    return (
      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }}>{opt?.label ?? editValue ?? '\u2014'}</Text>
      </View>
    )
  }
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
      <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      <View className="flex-row flex-wrap" style={{ gap: 6 }}>
        {options.map(opt => {
          const active = editValue === opt.key
          const c = opt.color ?? accent
          return (
            <Pressable key={opt.key} onPress={() => onChange(fieldKey, opt.key)} className="flex-row items-center px-2.5 py-1.5 rounded-lg"
              style={{ backgroundColor: active ? accentTint(c, isDark ? 0.15 : 0.08) : 'transparent', borderWidth: 1, borderColor: active ? c : palette.cardBorder, gap: 4 }}>
              {opt.color && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: opt.color }} />}
              <Text style={{ fontSize: 12, fontWeight: active ? '600' : '400', color: active ? c : palette.text }}>{opt.label}</Text>
            </Pressable>
          )
        })}
      </View>
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
