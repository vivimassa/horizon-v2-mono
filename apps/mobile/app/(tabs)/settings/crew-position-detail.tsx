import { useState, useCallback, useEffect } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type CrewPositionRef } from '@skyhub/api'
import { ChevronLeft, Pencil, X, Trash2 } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { ColorSwatchPicker } from '../../../components/lopa/ColorSwatchPicker'
import { useOperatorId } from '../../../hooks/useOperatorId'

const CATEGORIES: Array<{ key: 'cockpit' | 'cabin'; label: string }> = [
  { key: 'cockpit', label: 'Flight Deck' },
  { key: 'cabin', label: 'Cabin Crew' },
]

export default function CrewPositionDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const operatorId = useOperatorId()

  const [position, setPosition] = useState<CrewPositionRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!id || !operatorId) return
    setError(null)
    api
      .getCrewPositions(operatorId, true)
      .then((list) => setPosition(list.find((p) => p._id === id) ?? null))
      .catch((err: any) => setError(err.message || 'Failed to load position'))
      .finally(() => setLoading(false))
  }, [id, operatorId])

  const get = (key: string) => (key in draft ? draft[key] : (position as any)?.[key])
  const handleFieldChange = useCallback((key: string, value: any) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!position || Object.keys(draft).length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const updated = await api.updateCrewPosition(position._id, draft)
      setPosition(updated)
      setDraft({})
      setEditing(false)
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save changes')
    } finally {
      setSaving(false)
    }
  }, [position, draft])

  const handleDelete = useCallback(async () => {
    if (!position) return
    try {
      const refs = await api.getCrewPositionReferences(position._id)
      const total = refs.expiryCodes + refs.crewComplements

      if (total > 0) {
        const parts: string[] = []
        if (refs.expiryCodes > 0) parts.push(`${refs.expiryCodes} expiry code${refs.expiryCodes !== 1 ? 's' : ''}`)
        if (refs.crewComplements > 0)
          parts.push(`${refs.crewComplements} crew complement${refs.crewComplements !== 1 ? 's' : ''}`)

        Alert.alert(
          'Cannot Delete',
          `${position.code} is referenced by ${parts.join(' and ')}. You can deactivate it instead.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Deactivate',
              onPress: async () => {
                try {
                  const updated = await api.updateCrewPosition(position._id, { isActive: false })
                  setPosition(updated)
                } catch (err: any) {
                  Alert.alert('Error', err.message || 'Could not deactivate')
                }
              },
            },
          ],
        )
      } else {
        Alert.alert('Delete Position', `Delete ${position.code} — ${position.name}?`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.deleteCrewPosition(position._id)
                router.back()
              } catch (err: any) {
                let msg = err.message || 'Failed'
                try {
                  const m = msg.match(/API (\d+): (.+)/)
                  if (m) msg = JSON.parse(m[2]).error || msg
                } catch {}
                Alert.alert('Cannot Delete', msg)
              }
            },
          },
        ])
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not check references')
    }
  }, [position, router])

  if (loading || (!position && !error)) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>
            {loading ? 'Loading...' : 'Position not found'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="px-4 pt-4 pb-4" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <ChevronLeft size={24} color={accent} strokeWidth={2} />
          </Pressable>
        </View>
        <View className="flex-1 justify-center items-center px-8">
          <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center' }}>{error}</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!position) return null

  const catLabel = position.category === 'cockpit' ? 'Flight Deck' : 'Cabin Crew'

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-4 pb-4" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-2">
            <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
              <ChevronLeft size={24} color={accent} strokeWidth={2} />
            </Pressable>
            <Text
              style={{ fontSize: 24, fontWeight: '700', fontFamily: 'monospace', color: palette.text, marginRight: 8 }}
            >
              {position.code}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '600', color: palette.text, flex: 1 }} numberOfLines={1}>
              {position.name}
            </Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            {editing ? (
              <>
                <Pressable
                  onPress={() => {
                    setEditing(false)
                    setDraft({})
                  }}
                  className="active:opacity-60"
                >
                  <X size={20} color={palette.textSecondary} strokeWidth={1.8} />
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-lg active:opacity-60"
                  style={{ backgroundColor: accent }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
                    {saving ? 'Saving...' : 'Save'}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={handleDelete} className="active:opacity-60">
                  <Trash2 size={18} color={palette.textTertiary} strokeWidth={1.8} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    setDraft({})
                    setEditing(true)
                  }}
                  className="flex-row items-center px-3 py-1.5 rounded-lg active:opacity-60"
                  style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}
                >
                  <Pencil size={15} color={accent} strokeWidth={1.8} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: accent, marginLeft: 6 }}>Edit</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
        {/* Badges */}
        <View className="flex-row items-center mt-2 flex-wrap" style={{ gap: 6, marginLeft: 36 }}>
          <View
            className="px-2 py-0.5 rounded-full"
            style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: accent }}>{catLabel}</Text>
          </View>
          {position.isPic && (
            <View
              className="px-2 py-0.5 rounded-full"
              style={{ backgroundColor: isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7' }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#fbbf24' : '#92400e' }}>PIC</Text>
            </View>
          )}
          {position.isActive ? (
            <View
              className="px-2 py-0.5 rounded-full"
              style={{ backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7' }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#4ade80' : '#166534' }}>Active</Text>
            </View>
          ) : (
            <View
              className="px-2 py-0.5 rounded-full"
              style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#f87171' : '#991b1b' }}>Inactive</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Position Information */}
        <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
          <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accent }} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: accent }}>Position Information</Text>
        </View>

        <View className={isTablet ? 'flex-row flex-wrap' : ''}>
          <Field
            label="Code"
            value={position.code}
            editing={editing}
            fieldKey="code"
            editValue={get('code')}
            onChange={handleFieldChange}
            palette={palette}
            mono
            maxLength={3}
            half={isTablet}
          />
          <Field
            label="Rank Order"
            value={position.rankOrder}
            editing={editing}
            fieldKey="rankOrder"
            editValue={get('rankOrder')}
            onChange={handleFieldChange}
            palette={palette}
            numeric
            half={isTablet}
          />
          <Field
            label="Name"
            value={position.name}
            editing={editing}
            fieldKey="name"
            editValue={get('name')}
            onChange={handleFieldChange}
            palette={palette}
            half={isTablet}
          />
          <PickerField
            label="Category"
            value={catLabel}
            options={CATEGORIES}
            editing={editing}
            fieldKey="category"
            editValue={get('category')}
            onChange={handleFieldChange}
            palette={palette}
            isDark={isDark}
            accent={accent}
            half={isTablet}
          />
        </View>

        {/* Properties */}
        <View className="flex-row items-center mt-6 mb-2" style={{ gap: 6 }}>
          <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accent }} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: accent }}>Properties</Text>
        </View>
        <View className={isTablet ? 'flex-row flex-wrap' : ''}>
          {get('category') === 'cockpit' && (
            <ToggleField
              label="Pilot in Command (PIC)"
              value={position.isPic}
              editing={editing}
              fieldKey="isPic"
              editValue={get('isPic')}
              onChange={handleFieldChange}
              palette={palette}
              isDark={isDark}
              half={isTablet}
            />
          )}
          <ToggleField
            label="Can Downrank"
            value={position.canDownrank}
            editing={editing}
            fieldKey="canDownrank"
            editValue={get('canDownrank')}
            onChange={handleFieldChange}
            palette={palette}
            isDark={isDark}
            half={isTablet}
          />
          <ToggleField
            label="Active"
            value={position.isActive}
            editing={editing}
            fieldKey="isActive"
            editValue={get('isActive')}
            onChange={handleFieldChange}
            palette={palette}
            isDark={isDark}
            half={isTablet}
          />
        </View>

        {/* Appearance */}
        <View className="flex-row items-center mt-6 mb-2" style={{ gap: 6 }}>
          <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accent }} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: accent }}>Appearance</Text>
        </View>
        <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <Text
            style={{
              fontSize: 12,
              color: palette.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              fontWeight: '600',
              marginBottom: 6,
            }}
          >
            Color
          </Text>
          <ColorSwatchPicker
            value={get('color') || accent}
            onChange={(v) => handleFieldChange('color', v)}
            palette={palette}
            isDark={isDark}
            editing={editing}
          />
        </View>
        <Field
          label="Description"
          value={position.description}
          editing={editing}
          fieldKey="description"
          editValue={get('description')}
          onChange={handleFieldChange}
          palette={palette}
          multiline
        />
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Field components ──

function Field({
  label,
  value,
  editing,
  fieldKey,
  editValue,
  onChange,
  palette,
  mono,
  maxLength,
  multiline,
  numeric,
  half,
}: {
  label: string
  value: any
  editing: boolean
  fieldKey: string
  editValue: any
  onChange: (k: string, v: any) => void
  palette: Palette
  mono?: boolean
  maxLength?: number
  multiline?: boolean
  numeric?: boolean
  half?: boolean
}) {
  const halfStyle = half ? { width: '50%' as const, paddingRight: 12 } : {}
  if (editing) {
    return (
      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...halfStyle }}>
        <Text
          style={{
            fontSize: 12,
            color: palette.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            fontWeight: '600',
            marginBottom: 4,
          }}
        >
          {label}
        </Text>
        <TextInput
          value={editValue != null ? String(editValue) : ''}
          onChangeText={(v) => {
            if (mono) v = v.toUpperCase()
            onChange(fieldKey, numeric ? (v === '' ? null : Number(v)) : v)
          }}
          autoCapitalize={mono ? 'characters' : 'sentences'}
          keyboardType={numeric ? 'numeric' : 'default'}
          maxLength={maxLength}
          multiline={multiline}
          style={{
            fontSize: 15,
            fontWeight: '500',
            color: palette.text,
            fontFamily: mono ? 'monospace' : undefined,
            borderBottomWidth: 1,
            borderBottomColor: accentTint(palette.text, 0.15),
            paddingVertical: 4,
            minHeight: multiline ? 60 : undefined,
            textAlignVertical: multiline ? 'top' : undefined,
          }}
          placeholderTextColor={palette.textTertiary}
        />
      </View>
    )
  }
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...halfStyle }}>
      <Text
        style={{
          fontSize: 12,
          color: palette.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontWeight: '600',
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <Text
        style={{ fontSize: 15, fontWeight: '500', color: palette.text, fontFamily: mono ? 'monospace' : undefined }}
      >
        {value ?? '\u2014'}
      </Text>
    </View>
  )
}

function PickerField({
  label,
  value,
  options,
  editing,
  fieldKey,
  editValue,
  onChange,
  palette,
  isDark,
  accent,
  half,
}: {
  label: string
  value: string
  options: Array<{ key: string; label: string }>
  editing: boolean
  fieldKey: string
  editValue: any
  onChange: (k: string, v: any) => void
  palette: Palette
  isDark: boolean
  accent: string
  half?: boolean
}) {
  const halfStyle = half ? { width: '50%' as const, paddingRight: 12 } : {}
  if (editing) {
    return (
      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...halfStyle }}>
        <Text
          style={{
            fontSize: 12,
            color: palette.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            fontWeight: '600',
            marginBottom: 6,
          }}
        >
          {label}
        </Text>
        <View className="flex-row" style={{ gap: 8 }}>
          {options.map((opt) => {
            const active = (editValue || '') === opt.key
            return (
              <Pressable
                key={opt.key}
                onPress={() => onChange(fieldKey, opt.key)}
                className="flex-row items-center px-3 py-2 rounded-lg"
                style={{
                  backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? accent : palette.cardBorder,
                }}
              >
                <Text
                  style={{ fontSize: 13, fontWeight: active ? '600' : '400', color: active ? accent : palette.text }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    )
  }
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...halfStyle }}>
      <Text
        style={{
          fontSize: 12,
          color: palette.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontWeight: '600',
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }}>{value}</Text>
    </View>
  )
}

function ToggleField({
  label,
  value,
  editing,
  fieldKey,
  editValue,
  onChange,
  palette,
  isDark,
  half,
}: {
  label: string
  value: boolean
  editing: boolean
  fieldKey: string
  editValue: any
  onChange: (k: string, v: any) => void
  palette: Palette
  isDark: boolean
  half?: boolean
}) {
  const current = editing ? !!editValue : value
  return (
    <View
      style={{
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        ...(half ? { width: '50%', paddingRight: 12 } : {}),
      }}
    >
      <Text
        style={{
          fontSize: 12,
          color: palette.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontWeight: '600',
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      {editing ? (
        <Pressable
          onPress={() => onChange(fieldKey, !editValue)}
          className="self-start px-3 py-1 rounded-lg"
          style={{
            backgroundColor: current
              ? isDark
                ? 'rgba(22,163,74,0.15)'
                : '#dcfce7'
              : isDark
                ? 'rgba(220,38,38,0.15)'
                : '#fee2e2',
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: current ? (isDark ? '#4ade80' : '#16a34a') : isDark ? '#f87171' : '#dc2626',
            }}
          >
            {current ? 'Yes' : 'No'}
          </Text>
        </Pressable>
      ) : (
        <Text
          style={{
            fontSize: 15,
            fontWeight: '600',
            color: value ? (isDark ? '#4ade80' : '#16a34a') : palette.textSecondary,
          }}
        >
          {value ? 'Yes' : 'No'}
        </Text>
      )}
    </View>
  )
}
