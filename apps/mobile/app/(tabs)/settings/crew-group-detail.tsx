import { useState, useCallback, useEffect } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type CrewGroupRef } from '@skyhub/api'
import { ChevronLeft, Pencil, X, Trash2 } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { useOperatorId } from '../../../hooks/useOperatorId'

export default function CrewGroupDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const operatorId = useOperatorId()

  const [group, setGroup] = useState<CrewGroupRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!id || !operatorId) return
    setError(null)
    api.getCrewGroups(operatorId, true)
      .then(list => setGroup(list.find(g => g._id === id) ?? null))
      .catch((err: any) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [id, operatorId])

  const get = (key: string) => (key in draft ? draft[key] : (group as any)?.[key])
  const handleFieldChange = useCallback((key: string, value: any) => {
    setDraft(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!group || Object.keys(draft).length === 0) { setEditing(false); return }
    setSaving(true)
    try {
      const updated = await api.updateCrewGroup(group._id, draft)
      setGroup(updated)
      setDraft({})
      setEditing(false)
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save changes')
    } finally { setSaving(false) }
  }, [group, draft])

  const handleDelete = useCallback(() => {
    if (!group) return
    Alert.alert(
      'Delete Crew Group',
      `Delete "${group.name}"?\n\nCrew members assigned to this group will be unlinked.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try { await api.deleteCrewGroup(group._id); router.back() }
          catch (err: any) { Alert.alert('Cannot Delete', err.message || 'Failed') }
        }},
      ]
    )
  }, [group, router])

  if (loading || (!group && !error)) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>{loading ? 'Loading...' : 'Not found'}</Text>
        </View>
      </SafeAreaView>
    )
  }
  if (error || !group) {
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
            <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text, flex: 1 }} numberOfLines={1}>
              {group.name}
            </Text>
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
        <View className="flex-row items-center mt-2" style={{ gap: 6, marginLeft: 36 }}>
          {group.isActive ? (
            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7' }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#4ade80' : '#166534' }}>Active</Text>
            </View>
          ) : (
            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#f87171' : '#991b1b' }}>Inactive</Text>
            </View>
          )}
          <Text style={{ fontSize: 13, color: palette.textTertiary, fontFamily: 'monospace' }}>Order #{group.sortOrder}</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
          <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accent }} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: accent }}>Group Information</Text>
        </View>

        <View className={isTablet ? 'flex-row flex-wrap' : ''}>
          <Field label="Name" value={group.name} editing={editing} fieldKey="name" editValue={get('name')}
            onChange={handleFieldChange} palette={palette} half={isTablet} maxLength={100} />
          <Field label="Sort Order" value={group.sortOrder} editing={editing} fieldKey="sortOrder" editValue={get('sortOrder')}
            onChange={handleFieldChange} palette={palette} numeric half={isTablet} />
        </View>
        <Field label="Description" value={group.description} editing={editing} fieldKey="description" editValue={get('description')}
          onChange={handleFieldChange} palette={palette} multiline />
        {editing && (
          <ToggleField label="Active" value={group.isActive} editing fieldKey="isActive" editValue={get('isActive')}
            onChange={handleFieldChange} palette={palette} isDark={isDark} />
        )}

        {/* Danger zone */}
        {!editing && (
          <View className="mt-8 p-4 rounded-xl" style={{
            borderWidth: 1,
            borderColor: isDark ? 'rgba(220,38,38,0.3)' : '#fecaca',
            backgroundColor: isDark ? 'rgba(220,38,38,0.08)' : '#fef2f2',
          }}>
            <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
              <Trash2 size={16} color={isDark ? '#f87171' : '#dc2626'} strokeWidth={1.8} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: isDark ? '#f87171' : '#dc2626' }}>Delete Group</Text>
            </View>
            <Text style={{ fontSize: 13, color: palette.textSecondary, marginBottom: 12 }}>
              Deleting a crew group removes it permanently. Crew members assigned to this group will be unlinked.
            </Text>
            <Pressable onPress={handleDelete}
              className="self-start px-4 py-2 rounded-lg active:opacity-70"
              style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.2)' : '#fee2e2' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#f87171' : '#dc2626' }}>Delete Group</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Field components ──

function Field({ label, value, editing, fieldKey, editValue, onChange, palette, half, maxLength, multiline, numeric }: {
  label: string; value: any; editing: boolean; fieldKey: string; editValue: any;
  onChange: (k: string, v: any) => void; palette: Palette; half?: boolean; maxLength?: number; multiline?: boolean; numeric?: boolean
}) {
  const halfStyle = half ? { width: '50%' as const, paddingRight: 12 } : {}
  if (editing) {
    return (
      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...halfStyle }}>
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
        <TextInput value={editValue != null ? String(editValue) : ''}
          onChangeText={(v) => onChange(fieldKey, numeric ? (v === '' ? null : Number(v)) : v)}
          keyboardType={numeric ? 'numeric' : 'default'} maxLength={maxLength} multiline={multiline}
          style={{ fontSize: 15, fontWeight: '500', color: palette.text,
            borderBottomWidth: 1, borderBottomColor: accentTint(palette.text, 0.15), paddingVertical: 4,
            minHeight: multiline ? 60 : undefined, textAlignVertical: multiline ? 'top' : undefined }}
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
