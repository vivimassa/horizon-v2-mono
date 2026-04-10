import { useState, useCallback, useEffect } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type FlightServiceTypeRef } from '@skyhub/api'
import {
  ChevronLeft, Pencil, Save, X, Trash2, Tag,
} from 'lucide-react-native'
import { accentTint, modeColor, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { ColorSwatchPicker } from '../../../components/lopa/ColorSwatchPicker'

export default function ServiceTypeDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()

  const [serviceType, setServiceType] = useState<FlightServiceTypeRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Partial<FlightServiceTypeRef>>({})

  useEffect(() => {
    if (!id) return
    api.getFlightServiceTypes()
      .then(types => setServiceType(types.find(t => t._id === id) ?? null))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const get = (key: keyof FlightServiceTypeRef) => (key in draft ? (draft as any)[key] : serviceType?.[key])

  const handleFieldChange = useCallback((key: string, value: any) => {
    setDraft(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!serviceType || Object.keys(draft).length === 0) { setEditing(false); return }
    setSaving(true)
    try {
      const updated = await api.updateFlightServiceType(serviceType._id, draft)
      setServiceType(updated)
      setDraft({})
      setEditing(false)
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save changes')
    } finally { setSaving(false) }
  }, [serviceType, draft])

  const handleDelete = useCallback(() => {
    if (!serviceType) return
    Alert.alert(
      'Delete Service Type',
      `Delete ${serviceType.code} — ${serviceType.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteFlightServiceType(serviceType._id)
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
  }, [serviceType, router])

  if (loading || !serviceType) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>
            {loading ? 'Loading...' : 'Service type not found'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  const typeColor = modeColor(get('color') || serviceType.color || '#9ca3af', isDark)

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-4 pb-4" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-2">
            <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
              <ChevronLeft size={24} color={accent} strokeWidth={2} />
            </Pressable>
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: typeColor, marginRight: 8, borderWidth: 1, borderColor: palette.cardBorder }} />
            <Text style={{ fontSize: 20, fontWeight: '700', fontFamily: 'monospace', color: palette.text, marginRight: 6 }}>
              {serviceType.code}
            </Text>
            <Text style={{ fontSize: 16, color: palette.textSecondary, marginRight: 6 }}>—</Text>
            <Text style={{ fontSize: 18, fontWeight: '600', color: palette.text, flex: 1 }} numberOfLines={1}>
              {serviceType.name}
            </Text>
            {serviceType.isActive ? (
              <View className="px-2 py-0.5 rounded-full ml-2" style={{ backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7' }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#4ade80' : '#166534' }}>Active</Text>
              </View>
            ) : (
              <View className="px-2 py-0.5 rounded-full ml-2" style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#f87171' : '#991b1b' }}>Inactive</Text>
              </View>
            )}
          </View>

          <View className="flex-row items-center" style={{ gap: 8 }}>
            {editing ? (
              <>
                <Pressable onPress={() => { setEditing(false); setDraft({}) }} className="active:opacity-60">
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
      </View>

      {/* Content */}
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className={isTablet ? 'flex-row flex-wrap' : ''}>
          <Field label="Code" value={serviceType.code} editing={editing} fieldKey="code"
            editValue={get('code')} onChange={handleFieldChange} palette={palette} mono maxLength={2} half={isTablet} />
          <Field label="Name" value={serviceType.name} editing={editing} fieldKey="name"
            editValue={get('name')} onChange={handleFieldChange} palette={palette} half={isTablet} />
        </View>
        <Field label="Description" value={serviceType.description} editing={editing} fieldKey="description"
          editValue={get('description')} onChange={handleFieldChange} palette={palette} multiline />

        <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 6 }}>Color</Text>
          <ColorSwatchPicker value={get('color') || '#9ca3af'} onChange={(v) => handleFieldChange('color', v)} palette={palette} isDark={isDark} editing={editing} />
        </View>

        <View className={isTablet ? 'flex-row flex-wrap' : ''}>
          <ToggleField label="Active" value={serviceType.isActive} editing={editing} fieldKey="isActive"
            editValue={get('isActive')} onChange={handleFieldChange} palette={palette} isDark={isDark} half={isTablet} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Field({ label, value, editing, fieldKey, editValue, onChange, palette, mono, maxLength, multiline, half }: {
  label: string; value: any; editing: boolean; fieldKey: string; editValue: any;
  onChange: (k: string, v: any) => void; palette: Palette; mono?: boolean; maxLength?: number; multiline?: boolean; half?: boolean
}) {
  const halfStyle = half ? { width: '50%' as const, paddingRight: 12 } : {}
  if (editing) {
    return (
      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...halfStyle }}>
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
        <TextInput
          value={editValue != null ? String(editValue) : ''}
          onChangeText={(v) => {
            if (mono && fieldKey === 'code') v = v.toUpperCase()
            onChange(fieldKey, v)
          }}
          autoCapitalize={mono ? 'characters' : 'sentences'}
          maxLength={maxLength}
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
