import { useState, useCallback, useEffect, useMemo } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type MaintenanceCheckTypeRef, type AircraftTypeRef } from '@skyhub/api'
import { ChevronLeft, Pencil, X, Trash2, Save, ClipboardCheck } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { useOperatorId } from '../../../hooks/useOperatorId'

export default function MaintenanceCheckDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const operatorId = useOperatorId()

  const [check, setCheck] = useState<MaintenanceCheckTypeRef | null>(null)
  const [allChecks, setAllChecks] = useState<MaintenanceCheckTypeRef[]>([])
  const [acTypes, setAcTypes] = useState<AircraftTypeRef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Record<string, any>>({})

  const acTypeMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of acTypes) m.set(t._id, t.icaoType)
    return m
  }, [acTypes])

  useEffect(() => {
    if (!id || !operatorId) return
    setError(null)
    Promise.all([api.getMaintenanceCheckTypes(operatorId), api.getAircraftTypes(operatorId)])
      .then(([checks, types]) => {
        setAllChecks(checks)
        setAcTypes(types)
        setCheck(checks.find((c) => c._id === id) ?? null)
      })
      .catch((err: any) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [id, operatorId])

  const get = (key: string) => (key in draft ? draft[key] : (check as any)?.[key])
  const handleFieldChange = useCallback((key: string, value: any) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!check || Object.keys(draft).length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const updated = await api.updateMaintenanceCheckType(check._id, draft)
      setCheck(updated)
      setDraft({})
      setEditing(false)
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save changes')
    } finally {
      setSaving(false)
    }
  }, [check, draft])

  const handleDelete = useCallback(() => {
    if (!check) return
    Alert.alert('Delete Check Type', `Delete ${check.code} - ${check.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteMaintenanceCheckType(check._id)
            router.back()
          } catch (err: any) {
            Alert.alert('Cannot Delete', err.message || 'Failed')
          }
        },
      },
    ])
  }, [check, router])

  const otherCheckCodes = useMemo(
    () => allChecks.filter((c) => c._id !== check?._id && c.code).map((c) => c.code),
    [allChecks, check],
  )

  const resetsCheckCodes: string[] = get('resetsCheckCodes') ?? []

  if (loading || !check) {
    return (
      <View className="flex-1" style={{ backgroundColor: palette.background }}>
        <SafeAreaView
          className="flex-1 justify-center items-center"
          style={{ backgroundColor: palette.background }}
          edges={['top']}
        >
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>{loading ? 'Loading...' : 'Not found'}</Text>
        </SafeAreaView>
      </View>
    )
  }

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        {/* Header */}
        <View className="px-4 pt-2 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 mr-2">
              <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
                <ChevronLeft size={24} color={accent} strokeWidth={2} />
              </Pressable>
              <View
                className="items-center justify-center rounded-lg mr-3"
                style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}
              >
                <ClipboardCheck size={18} color={accent} strokeWidth={1.8} />
              </View>
              <View className="flex-1">
                <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }} numberOfLines={1}>
                  {check.code}
                </Text>
                <Text style={{ fontSize: 15, color: palette.textSecondary }} numberOfLines={1}>
                  {check.name}
                </Text>
              </View>
            </View>

            {editing ? (
              <View className="flex-row" style={{ gap: 8 }}>
                <Pressable
                  onPress={() => {
                    setDraft({})
                    setEditing(false)
                  }}
                  className="items-center justify-center active:opacity-60"
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor: palette.card,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: palette.border,
                  }}
                >
                  <X size={18} color={palette.text} strokeWidth={2} />
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  disabled={saving}
                  className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
                  style={{ backgroundColor: accent, opacity: saving ? 0.5 : 1, gap: 6 }}
                >
                  <Save size={16} color="#fff" strokeWidth={2} />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
                    {saving ? 'Saving...' : 'Save'}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View className="flex-row" style={{ gap: 8 }}>
                <Pressable
                  onPress={() => setEditing(true)}
                  className="items-center justify-center active:opacity-60"
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor: palette.card,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: palette.border,
                  }}
                >
                  <Pencil size={18} color={accent} strokeWidth={2} />
                </Pressable>
                <Pressable
                  onPress={handleDelete}
                  className="items-center justify-center active:opacity-60"
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor: palette.card,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: palette.border,
                  }}
                >
                  <Trash2 size={18} color="#dc2626" strokeWidth={2} />
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {/* General */}
          <SectionLabel label="General" palette={palette} accent={accent} />

          <View className={isTablet ? 'flex-row' : ''} style={{ gap: 12, marginBottom: 12 }}>
            <DetailField
              label="Code"
              value={get('code')}
              editing={editing}
              onChangeText={(v) => handleFieldChange('code', v.toUpperCase())}
              palette={palette}
              flex={isTablet ? 0.4 : 1}
              mono
            />
            <DetailField
              label="Name"
              value={get('name')}
              editing={editing}
              onChangeText={(v) => handleFieldChange('name', v)}
              palette={palette}
              flex={1}
            />
          </View>

          <DetailField
            label="MRO Code"
            value={get('amosCode')}
            editing={editing}
            onChangeText={(v) => handleFieldChange('amosCode', v)}
            palette={palette}
            mono
          />
          <DetailField
            label="Description"
            value={get('description')}
            editing={editing}
            onChangeText={(v) => handleFieldChange('description', v)}
            palette={palette}
            multiline
          />

          {/* Applicable Aircraft Types */}
          <Text
            style={{
              fontSize: 13,
              color: palette.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              fontWeight: '600',
              marginBottom: 4,
              marginTop: 4,
            }}
          >
            Applicable Aircraft Types
          </Text>
          {editing ? (
            <View className="flex-row flex-wrap" style={{ gap: 6, marginBottom: 12 }}>
              {acTypes.map((t) => {
                const ids: string[] = get('applicableAircraftTypeIds') ?? []
                const sel = ids.includes(t._id)
                return (
                  <Pressable
                    key={t._id}
                    onPress={() => {
                      const next = sel ? ids.filter((x: string) => x !== t._id) : [...ids, t._id]
                      handleFieldChange('applicableAircraftTypeIds', next)
                    }}
                    className="px-2.5 py-1.5 rounded-lg"
                    style={{
                      backgroundColor: sel ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent',
                      borderWidth: 1,
                      borderColor: sel ? accent : palette.cardBorder,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: sel ? '600' : '400', color: sel ? accent : palette.text }}>
                      {t.icaoType}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          ) : (
            <Text style={{ fontSize: 15, color: palette.text, marginBottom: 12 }}>
              {check.applicableAircraftTypeIds.length > 0
                ? check.applicableAircraftTypeIds.map((id) => acTypeMap.get(id) ?? '?').join(', ')
                : 'All aircraft types'}
            </Text>
          )}

          {/* Frequency Thresholds */}
          <SectionLabel label="Frequency Thresholds" palette={palette} accent={accent} />
          <Text style={{ fontSize: 13, color: palette.textTertiary, marginBottom: 10 }}>
            Triggered when any threshold is reached - whichever comes first.
          </Text>

          <View className={isTablet ? 'flex-row' : ''} style={{ gap: 12, marginBottom: 12 }}>
            <DetailField
              label="Flight Hours"
              value={get('defaultHoursInterval')?.toString() ?? ''}
              editing={editing}
              onChangeText={(v) => handleFieldChange('defaultHoursInterval', v ? parseFloat(v) : null)}
              palette={palette}
              flex={1}
              keyboardType="numeric"
            />
            <DetailField
              label="Cycles"
              value={get('defaultCyclesInterval')?.toString() ?? ''}
              editing={editing}
              onChangeText={(v) => handleFieldChange('defaultCyclesInterval', v ? parseInt(v) : null)}
              palette={palette}
              flex={1}
              keyboardType="numeric"
            />
            <DetailField
              label="Calendar Days"
              value={get('defaultDaysInterval')?.toString() ?? ''}
              editing={editing}
              onChangeText={(v) => handleFieldChange('defaultDaysInterval', v ? parseInt(v) : null)}
              palette={palette}
              flex={1}
              keyboardType="numeric"
            />
          </View>

          {/* Operational Settings */}
          <SectionLabel label="Operational Settings" palette={palette} accent={accent} />

          <View className={isTablet ? 'flex-row' : ''} style={{ gap: 12, marginBottom: 12 }}>
            <DetailField
              label="Duration (hours)"
              value={get('defaultDurationHours')?.toString() ?? ''}
              editing={editing}
              onChangeText={(v) => handleFieldChange('defaultDurationHours', v ? parseFloat(v) : null)}
              palette={palette}
              flex={1}
              keyboardType="numeric"
            />
            <DetailField
              label="Default Station"
              value={get('defaultStation') ?? ''}
              editing={editing}
              onChangeText={(v) => handleFieldChange('defaultStation', v.toUpperCase())}
              palette={palette}
              flex={1}
              mono
            />
          </View>

          <View className="flex-row items-center mb-4" style={{ gap: 10 }}>
            {editing ? (
              <Switch
                value={get('requiresGrounding') ?? true}
                onValueChange={(v) => handleFieldChange('requiresGrounding', v)}
                trackColor={{ false: palette.border, true: accent }}
              />
            ) : (
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: get('requiresGrounding') ? accent : palette.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {get('requiresGrounding') && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>G</Text>}
              </View>
            )}
            <Text style={{ fontSize: 15, color: palette.text }}>Requires Grounding</Text>
            <Text style={{ fontSize: 13, color: palette.textTertiary }}>
              {get('requiresGrounding') ? '- aircraft grounded' : '- can stay in service'}
            </Text>
          </View>

          <View className="flex-row items-center mb-4" style={{ gap: 10 }}>
            {editing ? (
              <Switch
                value={get('isActive') ?? true}
                onValueChange={(v) => handleFieldChange('isActive', v)}
                trackColor={{ false: palette.border, true: accent }}
              />
            ) : (
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: get('isActive') ? '#06C270' : palette.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {get('isActive') && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>A</Text>}
              </View>
            )}
            <Text style={{ fontSize: 15, color: palette.text }}>Active</Text>
            <Text style={{ fontSize: 13, color: palette.textTertiary }}>- include in fleet health calculations</Text>
          </View>

          {/* Cascade Resets */}
          <SectionLabel label="Cascade Resets" palette={palette} accent={accent} />
          <Text style={{ fontSize: 13, color: palette.textTertiary, marginBottom: 10 }}>
            When this check completes, it also resets these check types.
          </Text>

          {otherCheckCodes.length > 0 ? (
            <View className="flex-row flex-wrap" style={{ gap: 6, marginBottom: 16 }}>
              {otherCheckCodes.map((c) => {
                const sel = resetsCheckCodes.includes(c)
                return (
                  <Pressable
                    key={c}
                    disabled={!editing}
                    onPress={() => {
                      const next = sel ? resetsCheckCodes.filter((x: string) => x !== c) : [...resetsCheckCodes, c]
                      handleFieldChange('resetsCheckCodes', next.length > 0 ? next : null)
                    }}
                    className="px-2.5 py-1.5 rounded-lg"
                    style={{
                      backgroundColor: sel ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent',
                      borderWidth: 1,
                      borderColor: sel ? accent : palette.cardBorder,
                      opacity: editing ? 1 : sel ? 1 : 0.4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: sel ? '600' : '400',
                        color: sel ? accent : palette.text,
                        fontFamily: 'monospace',
                      }}
                    >
                      {c}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          ) : (
            <Text style={{ fontSize: 13, color: palette.textTertiary, marginBottom: 16 }}>
              No other check types to cascade to.
            </Text>
          )}

          {/* Display Color */}
          <SectionLabel label="Display Color" palette={palette} accent={accent} />
          <View className="flex-row items-center mb-4" style={{ gap: 10 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: get('color') ?? '#3b82f6',
                borderWidth: 2,
                borderColor: palette.border,
              }}
            />
            {editing ? (
              <TextInput
                value={get('color') ?? '#3b82f6'}
                onChangeText={(v) => {
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) handleFieldChange('color', v)
                }}
                maxLength={7}
                style={{
                  fontSize: 15,
                  fontFamily: 'monospace',
                  color: palette.textSecondary,
                  borderWidth: 1,
                  borderColor: palette.cardBorder,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  backgroundColor: palette.card,
                  width: 90,
                  textAlign: 'center',
                }}
              />
            ) : (
              <Text style={{ fontSize: 15, fontFamily: 'monospace', color: palette.textSecondary }}>
                {check.color ?? '#3b82f6'}
              </Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function SectionLabel({ label, palette, accent }: { label: string; palette: Palette; accent: string }) {
  return (
    <View className="flex-row items-center mb-3 mt-4" style={{ gap: 8 }}>
      <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accent }} />
      <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text }}>{label}</Text>
    </View>
  )
}

function DetailField({
  label,
  value,
  editing,
  onChangeText,
  palette,
  flex = 1,
  mono,
  multiline,
  keyboardType,
}: {
  label: string
  value: string | null | undefined
  editing: boolean
  onChangeText: (v: string) => void
  palette: Palette
  flex?: number
  mono?: boolean
  multiline?: boolean
  keyboardType?: 'numeric' | 'default'
}) {
  return (
    <View style={{ flex, marginBottom: 12 }}>
      <Text
        style={{
          fontSize: 13,
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
        <TextInput
          value={value ?? ''}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          multiline={multiline}
          autoCapitalize={mono ? 'characters' : 'sentences'}
          style={{
            fontSize: 15,
            fontWeight: '500',
            color: palette.text,
            fontFamily: mono ? 'monospace' : undefined,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: palette.card,
            minHeight: multiline ? 60 : undefined,
            textAlignVertical: multiline ? 'top' : undefined,
          }}
        />
      ) : (
        <Text
          style={{
            fontSize: 15,
            color: value ? palette.text : palette.textTertiary,
            fontFamily: mono ? 'monospace' : undefined,
          }}
        >
          {value || '--'}
        </Text>
      )}
    </View>
  )
}
