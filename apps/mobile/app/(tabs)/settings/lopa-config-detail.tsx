import { useState, useCallback, useEffect, useMemo } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type LopaConfigRef, type CabinClassRef, type CabinEntry } from '@skyhub/api'
import {
  ChevronLeft, Pencil, Save, X, Trash2, Plus, Star, Plane,
} from 'lucide-react-native'
import { accentTint, modeColor, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { AircraftSeatMap } from '../../../components/lopa/AircraftSeatMap'
import { CabinEntryRow } from '../../../components/lopa/CabinEntryRow'

export default function LopaConfigDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()

  const [config, setConfig] = useState<LopaConfigRef | null>(null)
  const [cabinClasses, setCabinClasses] = useState<CabinClassRef[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Partial<LopaConfigRef>>({})
  const [draftCabins, setDraftCabins] = useState<CabinEntry[] | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([api.getLopaConfig(id), api.getCabinClasses()])
      .then(([cfg, classes]) => { setConfig(cfg); setCabinClasses(classes) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const get = (key: keyof LopaConfigRef) => (key in draft ? (draft as any)[key] : config?.[key])

  const handleFieldChange = useCallback((key: string, value: any) => {
    setDraft(prev => ({ ...prev, [key]: value }))
  }, [])

  const currentCabins = draftCabins ?? config?.cabins ?? []
  const computedTotal = useMemo(() => currentCabins.reduce((s, c) => s + c.seats, 0), [currentCabins])

  const classOptions = useMemo(
    () => cabinClasses.filter(c => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [cabinClasses]
  )

  const getClassColor = useCallback(
    (code: string) => modeColor(cabinClasses.find(c => c.code === code)?.color || '#9ca3af', isDark),
    [cabinClasses, isDark]
  )

  const getClassName = useCallback(
    (code: string) => cabinClasses.find(c => c.code === code)?.name || code,
    [cabinClasses]
  )

  const handleEdit = useCallback(() => {
    if (!config) return
    setDraft({})
    setDraftCabins([...config.cabins])
    setEditing(true)
  }, [config])

  const handleCancel = useCallback(() => {
    setDraft({})
    setDraftCabins(null)
    setEditing(false)
  }, [])

  const handleSave = useCallback(async () => {
    if (!config) { setEditing(false); return }
    const payload: Partial<LopaConfigRef> = { ...draft }
    if (draftCabins) payload.cabins = draftCabins
    if (Object.keys(payload).length === 0) { setEditing(false); return }
    setSaving(true)
    try {
      const updated = await api.updateLopaConfig(config._id, payload)
      setConfig(updated)
      setDraft({})
      setDraftCabins(null)
      setEditing(false)
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save changes')
    } finally { setSaving(false) }
  }, [config, draft, draftCabins])

  const handleDelete = useCallback(() => {
    if (!config) return
    Alert.alert(
      'Delete Configuration',
      `Delete ${config.configName} (${config.aircraftType})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteLopaConfig(config._id)
              router.back()
            } catch (err: any) {
              let msg = err.message || 'Delete failed'
              try {
                const match = msg.match(/API (\d+): (.+)/)
                if (match) { const parsed = JSON.parse(match[2]); msg = parsed.error || msg }
              } catch { /* raw */ }
              Alert.alert('Cannot Delete', msg)
            }
          },
        },
      ]
    )
  }, [config, router])

  if (loading || !config) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>
            {loading ? 'Loading...' : 'Configuration not found'}
          </Text>
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
            <View className="px-2 py-1 rounded-lg mr-2" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', fontFamily: 'monospace', color: palette.text }}>
                {config.aircraftType}
              </Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: palette.text, flex: 1 }} numberOfLines={1}>
              {config.configName}
            </Text>
            {config.isDefault && (
              <View className="flex-row items-center px-2 py-0.5 rounded-full ml-2" style={{ backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#fef3c7', gap: 3 }}>
                <Star size={10} color="#f59e0b" fill="#f59e0b" strokeWidth={1.5} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#fbbf24' : '#b45309' }}>Default</Text>
              </View>
            )}
          </View>

          <View className="flex-row items-center" style={{ gap: 8 }}>
            {editing ? (
              <>
                <Pressable onPress={handleCancel} className="active:opacity-60">
                  <X size={20} color={palette.textSecondary} strokeWidth={1.8} />
                </Pressable>
                <Pressable onPress={handleSave} disabled={saving}
                  className="px-4 py-2.5 rounded-lg active:opacity-60"
                  style={{ backgroundColor: accent }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{saving ? 'Saving...' : 'Save'}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={handleDelete} className="active:opacity-60">
                  <Trash2 size={18} color={palette.textTertiary} strokeWidth={1.8} />
                </Pressable>
                <Pressable onPress={handleEdit}
                  className="flex-row items-center px-4 py-2.5 rounded-lg active:opacity-60"
                  style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}>
                  <Pencil size={15} color={accent} strokeWidth={1.8} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: accent, marginLeft: 6 }}>Edit</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* Seat count badge */}
        <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
          <View className="px-3 py-1 rounded-full" style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: accent }}>
              {editing ? computedTotal : config.totalSeats} seats
            </Text>
          </View>
          {config.isActive ? (
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

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero: Aircraft Seat Map */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <AircraftSeatMap cabins={currentCabins} cabinClasses={cabinClasses} aircraftType={config.aircraftType} palette={palette} isDark={isDark} />
        </View>

        {/* Cabin Layout */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accent }} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>Cabin Layout</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: accent }}>{computedTotal} total seats</Text>
          </View>

          {editing && draftCabins ? (
            <View style={{ gap: 8 }}>
              {draftCabins.map((cabin, i) => (
                <CabinEntryRow
                  key={i}
                  cabin={cabin}
                  cabinClasses={cabinClasses}
                  palette={palette}
                  isDark={isDark}
                  onChangeSeats={(seats) => {
                    const u = [...draftCabins]; u[i] = { ...u[i], seats }
                    setDraftCabins(u)
                  }}
                  onRemove={draftCabins.length > 1 ? () => setDraftCabins(draftCabins.filter((_, idx) => idx !== i)) : undefined}
                />
              ))}
              <Pressable
                onPress={() => setDraftCabins([...draftCabins, { classCode: classOptions[0]?.code || 'Y', seats: 0 }])}
                className="flex-row items-center self-start px-3 py-1.5 rounded-lg active:opacity-70"
                style={{ gap: 4 }}
              >
                <Plus size={14} color={accent} strokeWidth={2} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: accent }}>Add Cabin</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 6 }}>
              {[...config.cabins].sort((a, b) => {
                const aO = cabinClasses.find(c => c.code === a.classCode)?.sortOrder ?? 99
                const bO = cabinClasses.find(c => c.code === b.classCode)?.sortOrder ?? 99
                return aO - bO
              }).map((cabin, i) => (
                <View key={i} className="flex-row items-center rounded-xl"
                  style={{ borderWidth: 1, borderColor: palette.cardBorder, paddingHorizontal: 12, paddingVertical: 10, gap: 10 }}>
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: getClassColor(cabin.classCode) }} />
                  <Text style={{ fontSize: 14, fontWeight: '700', fontFamily: 'monospace', color: palette.text, width: 28 }}>
                    {cabin.classCode}
                  </Text>
                  <Text style={{ fontSize: 13, color: palette.textSecondary, flex: 1 }} numberOfLines={1}>
                    {getClassName(cabin.classCode)}
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', fontFamily: 'monospace', color: palette.text }}>
                    {cabin.seats}
                  </Text>
                  <Text style={{ fontSize: 12, color: palette.textTertiary }}>seats</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Details */}
        <View style={{ padding: 16 }}>
          <View className="flex-row items-center mb-3" style={{ gap: 6 }}>
            <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accent }} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>Details</Text>
          </View>

          <View className={isTablet ? 'flex-row flex-wrap' : ''}>
            <Field label="Aircraft Type" value={config.aircraftType} editing={editing} fieldKey="aircraftType"
              editValue={get('aircraftType')} onChange={handleFieldChange} palette={palette} mono half={isTablet} />
            <Field label="Config Name" value={config.configName} editing={editing} fieldKey="configName"
              editValue={get('configName')} onChange={handleFieldChange} palette={palette} half={isTablet} />
            <ToggleField label="Default" value={config.isDefault} editing={editing} fieldKey="isDefault"
              editValue={get('isDefault')} onChange={handleFieldChange} palette={palette} isDark={isDark} half={isTablet} />
            <ToggleField label="Active" value={config.isActive} editing={editing} fieldKey="isActive"
              editValue={get('isActive')} onChange={handleFieldChange} palette={palette} isDark={isDark} half={isTablet} />
            <Field label="Notes" value={config.notes} editing={editing} fieldKey="notes"
              editValue={get('notes')} onChange={handleFieldChange} palette={palette} multiline />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Field ──
function Field({ label, value, editing, fieldKey, editValue, onChange, palette, mono, multiline, half }: {
  label: string; value: any; editing: boolean; fieldKey: string; editValue: any;
  onChange: (k: string, v: any) => void; palette: Palette; mono?: boolean; multiline?: boolean; half?: boolean
}) {
  const halfStyle = half ? { width: '50%' as const, paddingRight: 12 } : {}
  if (editing) {
    return (
      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...halfStyle }}>
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
        <TextInput
          value={editValue != null ? String(editValue) : ''}
          onChangeText={(v) => onChange(fieldKey, v)}
          autoCapitalize={mono ? 'characters' : 'sentences'}
          multiline={multiline}
          style={{
            fontSize: 15, fontWeight: '500', color: palette.text,
            fontFamily: mono ? 'monospace' : undefined,
            borderBottomWidth: 1, borderBottomColor: accentTint('#1e40af', 0.3), paddingVertical: 4,
            minHeight: multiline ? 60 : undefined, textAlignVertical: multiline ? 'top' : undefined,
          }}
          placeholderTextColor={palette.textTertiary}
        />
      </View>
    )
  }
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...halfStyle }}>
      <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text, fontFamily: mono ? 'monospace' : undefined }}>
        {value ?? '---'}
      </Text>
    </View>
  )
}

// ── Toggle field ──
function ToggleField({ label, value, editing, fieldKey, editValue, onChange, palette, isDark, half }: {
  label: string; value: boolean; editing: boolean; fieldKey: string; editValue: any;
  onChange: (k: string, v: any) => void; palette: Palette; isDark: boolean; half?: boolean
}) {
  const current = editing ? !!editValue : value
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...(half ? { width: '50%', paddingRight: 12 } : {}) }}>
      <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      {editing ? (
        <Pressable onPress={() => onChange(fieldKey, !editValue)}
          className="self-start px-3 py-1 rounded-lg"
          style={{ backgroundColor: current ? (isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7') : (isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2') }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: current ? (isDark ? '#4ade80' : '#16a34a') : (isDark ? '#f87171' : '#dc2626') }}>
            {current ? 'Yes' : 'No'}
          </Text>
        </Pressable>
      ) : (
        <Text style={{ fontSize: 15, fontWeight: '600', color: value ? (isDark ? '#4ade80' : '#16a34a') : palette.textSecondary }}>
          {value ? 'Yes' : 'No'}
        </Text>
      )}
    </View>
  )
}
