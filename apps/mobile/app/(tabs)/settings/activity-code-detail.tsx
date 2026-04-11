import { useState, useCallback, useEffect, useMemo } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type ActivityCodeRef, type ActivityCodeGroupRef } from '@skyhub/api'
import { ChevronLeft, Pencil, X, Trash2, Lock } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { useOperatorId } from '../../../hooks/useOperatorId'
import { FLAG_CATEGORIES, FLAG_LABELS, type ActivityFlag } from '@skyhub/constants'
import { ColorSwatchPicker } from '../../../components/lopa/ColorSwatchPicker'

function minutesToHHMM(m: number | null): string {
  if (m == null) return '\u2014'
  const h = Math.floor(m / 60),
    mm = m % 60
  return `${h}:${String(mm).padStart(2, '0')}`
}
function hhmmToMinutes(s: string): number | null {
  const m = s.match(/^(\d{1,3}):(\d{2})$/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

export default function ActivityCodeDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const operatorId = useOperatorId()

  const [code, setCode] = useState<ActivityCodeRef | null>(null)
  const [groups, setGroups] = useState<ActivityCodeGroupRef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Record<string, any>>({})
  const [tab, setTab] = useState<'general' | 'credits'>('general')

  useEffect(() => {
    if (!id || !operatorId) return
    setError(null)
    Promise.all([api.getActivityCodes(operatorId), api.getActivityCodeGroups(operatorId)])
      .then(([codes, g]) => {
        setCode(codes.find((c) => c._id === id) ?? null)
        setGroups(g)
      })
      .catch((err: any) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [id, operatorId])

  const get = (key: string) => (key in draft ? draft[key] : (code as any)?.[key])
  const handleFieldChange = useCallback((key: string, value: any) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!code || Object.keys(draft).length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const updated = await api.updateActivityCode(code._id, draft)
      setCode(updated)
      setDraft({})
      setEditing(false)
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save changes')
    } finally {
      setSaving(false)
    }
  }, [code, draft])

  const handleDelete = useCallback(() => {
    if (!code) return
    if (code.isSystem) {
      Alert.alert('Cannot Delete', 'System codes cannot be deleted.')
      return
    }
    Alert.alert('Delete Activity Code', `Delete ${code.code} — ${code.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteActivityCode(code._id)
            router.back()
          } catch (err: any) {
            Alert.alert('Cannot Delete', err.message || 'Failed')
          }
        },
      },
    ])
  }, [code, router])

  const group = useMemo(() => groups.find((g) => g._id === code?.groupId), [groups, code])

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
          <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center' }}>
            {error ?? 'Not found'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  const isSystem = code.isSystem
  const groupColor = group?.color ?? accent

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-4 pb-4" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-2">
            <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
              <ChevronLeft size={24} color={accent} strokeWidth={2} />
            </Pressable>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: code.color ?? groupColor,
                marginRight: 8,
              }}
            />
            <Text
              style={{ fontSize: 24, fontWeight: '700', fontFamily: 'monospace', color: palette.text, marginRight: 8 }}
            >
              {code.code}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '600', color: palette.text, flex: 1 }} numberOfLines={1}>
              {code.name}
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
                {!isSystem && (
                  <Pressable onPress={handleDelete} className="active:opacity-60">
                    <Trash2 size={18} color={palette.textTertiary} strokeWidth={1.8} />
                  </Pressable>
                )}
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
        <View className="flex-row items-center mt-2 flex-wrap" style={{ gap: 6, marginLeft: 36 }}>
          <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: `${groupColor}20` }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: groupColor }}>{group?.name ?? 'Unknown'}</Text>
          </View>
          {isSystem && (
            <View
              className="flex-row items-center px-2 py-0.5 rounded-full"
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', gap: 3 }}
            >
              <Lock size={9} color={palette.textSecondary} strokeWidth={2} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: palette.textSecondary }}>System</Text>
            </View>
          )}
          {code.isArchived && (
            <View
              className="px-2 py-0.5 rounded-full"
              style={{ backgroundColor: isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7' }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#fbbf24' : '#92400e' }}>Archived</Text>
            </View>
          )}
          {code.isActive ? (
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

      {/* Tabs */}
      <View
        className="flex-row"
        style={{
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
          paddingHorizontal: 12,
          paddingVertical: 8,
          gap: 4,
        }}
      >
        {(['general', 'credits'] as const).map((t) => {
          const active = tab === t
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              className="px-3 py-2 rounded-lg"
              style={{ backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent' }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: active ? '600' : '500',
                  color: active ? accent : palette.textSecondary,
                }}
              >
                {t === 'general' ? 'General' : 'Credit Hours'}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {tab === 'general' && (
          <>
            <SectionBar label="Code Information" color={accent} />
            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              <Field
                label="Code"
                value={code.code}
                editing={editing && !isSystem}
                fieldKey="code"
                editValue={get('code')}
                onChange={handleFieldChange}
                palette={palette}
                mono
                maxLength={8}
                half={isTablet}
              />
              <Field
                label="Name"
                value={code.name}
                editing={editing && !isSystem}
                fieldKey="name"
                editValue={get('name')}
                onChange={handleFieldChange}
                palette={palette}
                half={isTablet}
              />
              <Field
                label="Short Label"
                value={code.shortLabel}
                editing={editing && !isSystem}
                fieldKey="shortLabel"
                editValue={get('shortLabel')}
                onChange={handleFieldChange}
                palette={palette}
                half={isTablet}
              />
              {!editing && (
                <Field
                  label="Group"
                  value={group?.name}
                  editing={false}
                  fieldKey=""
                  editValue=""
                  onChange={() => {}}
                  palette={palette}
                  half={isTablet}
                />
              )}
            </View>
            {editing && !isSystem && (
              <PickerField
                label="Group"
                options={groups.map((g) => ({ key: g._id, label: g.name, color: g.color }))}
                editValue={get('groupId')}
                fieldKey="groupId"
                onChange={handleFieldChange}
                palette={palette}
                isDark={isDark}
                accent={accent}
              />
            )}

            {/* Color */}
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
                value={get('color') || groupColor}
                onChange={(v) => handleFieldChange('color', v)}
                palette={palette}
                isDark={isDark}
                editing={editing}
              />
            </View>

            <Field
              label="Description"
              value={code.description}
              editing={editing && !isSystem}
              fieldKey="description"
              editValue={get('description')}
              onChange={handleFieldChange}
              palette={palette}
              multiline
            />

            {editing && !isSystem && (
              <View className={isTablet ? 'flex-row flex-wrap' : ''}>
                <ToggleField
                  label="Active"
                  value={code.isActive}
                  editing
                  fieldKey="isActive"
                  editValue={get('isActive')}
                  onChange={handleFieldChange}
                  palette={palette}
                  isDark={isDark}
                  half={isTablet}
                />
                <ToggleField
                  label="Archived"
                  value={code.isArchived}
                  editing
                  fieldKey="isArchived"
                  editValue={get('isArchived')}
                  onChange={handleFieldChange}
                  palette={palette}
                  isDark={isDark}
                  half={isTablet}
                />
              </View>
            )}

            {/* Duration */}
            <SectionBar label="Duration & Timing" color={accent} />
            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              <Field
                label="Default Duration"
                value={minutesToHHMM(code.defaultDurationMin)}
                editing={editing && !isSystem}
                fieldKey="defaultDurationMin"
                editValue={get('defaultDurationMin') != null ? minutesToHHMM(get('defaultDurationMin')) : ''}
                onChange={(k, v) => handleFieldChange(k, hhmmToMinutes(v))}
                palette={palette}
                half={isTablet}
                placeholder="HH:MM"
              />
              <ToggleField
                label="Requires Time"
                value={code.requiresTime}
                editing={editing && !isSystem}
                fieldKey="requiresTime"
                editValue={get('requiresTime')}
                onChange={handleFieldChange}
                palette={palette}
                isDark={isDark}
                half={isTablet}
              />
            </View>
            {(get('requiresTime') ?? code.requiresTime) && (
              <View className={isTablet ? 'flex-row flex-wrap' : ''}>
                <Field
                  label="Default Start"
                  value={code.defaultStartTime}
                  editing={editing && !isSystem}
                  fieldKey="defaultStartTime"
                  editValue={get('defaultStartTime')}
                  onChange={handleFieldChange}
                  palette={palette}
                  half={isTablet}
                  placeholder="HH:MM"
                />
                <Field
                  label="Default End"
                  value={code.defaultEndTime}
                  editing={editing && !isSystem}
                  fieldKey="defaultEndTime"
                  editValue={get('defaultEndTime')}
                  onChange={handleFieldChange}
                  palette={palette}
                  half={isTablet}
                  placeholder="HH:MM"
                />
              </View>
            )}

            {/* Behavioral Flags */}
            <SectionBar label="Behavioral Flags" color={accent} />
            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              {FLAG_CATEGORIES.map((cat) => {
                const flags: string[] = get('flags') ?? code.flags ?? []
                return (
                  <View
                    key={cat.label}
                    className="mb-5"
                    style={isTablet ? { width: '50%', paddingRight: 12 } : undefined}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: palette.textSecondary,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        marginBottom: 8,
                      }}
                    >
                      {cat.label}
                    </Text>
                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                      {cat.flags.map((flag) => {
                        const active = flags.includes(flag)
                        return (
                          <Pressable
                            key={flag}
                            disabled={!editing || isSystem}
                            onPress={() => {
                              const cur = [...flags]
                              const i = cur.indexOf(flag)
                              if (i >= 0) cur.splice(i, 1)
                              else cur.push(flag)
                              handleFieldChange('flags', cur)
                            }}
                            className="px-3.5 py-2.5 rounded-lg"
                            style={{
                              minHeight: 44,
                              justifyContent: 'center',
                              backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent',
                              borderWidth: 1,
                              borderColor: active ? accent : palette.cardBorder,
                              opacity: !editing || isSystem ? (active ? 1 : 0.3) : 1,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: active ? '600' : '400',
                                color: active ? accent : palette.text,
                              }}
                            >
                              {FLAG_LABELS[flag as ActivityFlag]}
                            </Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  </View>
                )
              })}
            </View>
          </>
        )}

        {tab === 'credits' && (
          <>
            <SectionBar label="Credit & Pay" color={accent} />
            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              <Field
                label="Credit Ratio"
                value={code.creditRatio != null ? `${code.creditRatio}x` : null}
                editing={editing && !isSystem}
                fieldKey="creditRatio"
                editValue={get('creditRatio')}
                onChange={handleFieldChange}
                palette={palette}
                numeric
                half={isTablet}
                placeholder="e.g. 1.0"
              />
              <Field
                label="Credit Override"
                value={minutesToHHMM(code.creditFixedMin)}
                editing={editing && !isSystem}
                fieldKey="creditFixedMin"
                editValue={get('creditFixedMin') != null ? minutesToHHMM(get('creditFixedMin')) : ''}
                onChange={(k, v) => handleFieldChange(k, hhmmToMinutes(v))}
                palette={palette}
                half={isTablet}
                placeholder="HH:MM"
              />
              <Field
                label="Pay Ratio"
                value={code.payRatio != null ? `${code.payRatio}x` : null}
                editing={editing && !isSystem}
                fieldKey="payRatio"
                editValue={get('payRatio')}
                onChange={handleFieldChange}
                palette={palette}
                numeric
                half={isTablet}
                placeholder="e.g. 1.0"
              />
            </View>

            <SectionBar label="Rest Periods" color={accent} />
            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              <Field
                label="Min Rest Before"
                value={minutesToHHMM(code.minRestBeforeMin)}
                editing={editing && !isSystem}
                fieldKey="minRestBeforeMin"
                editValue={get('minRestBeforeMin') != null ? minutesToHHMM(get('minRestBeforeMin')) : ''}
                onChange={(k, v) => handleFieldChange(k, hhmmToMinutes(v))}
                palette={palette}
                half={isTablet}
                placeholder="HH:MM"
              />
              <Field
                label="Min Rest After"
                value={minutesToHHMM(code.minRestAfterMin)}
                editing={editing && !isSystem}
                fieldKey="minRestAfterMin"
                editValue={get('minRestAfterMin') != null ? minutesToHHMM(get('minRestAfterMin')) : ''}
                onChange={(k, v) => handleFieldChange(k, hhmmToMinutes(v))}
                palette={palette}
                half={isTablet}
                placeholder="HH:MM"
              />
            </View>

            {/* Simulator */}
            {(get('flags') ?? code.flags ?? []).includes('is_simulator') && (
              <>
                <SectionBar label="Simulator Settings" color={accent} />
                <View className={isTablet ? 'flex-row flex-wrap' : ''}>
                  <Field
                    label="Platform"
                    value={code.simPlatform}
                    editing={editing && !isSystem}
                    fieldKey="simPlatform"
                    editValue={get('simPlatform')}
                    onChange={handleFieldChange}
                    palette={palette}
                    half={isTablet}
                  />
                  <Field
                    label="Sim Duration"
                    value={minutesToHHMM(code.simDurationMin)}
                    editing={editing && !isSystem}
                    fieldKey="simDurationMin"
                    editValue={get('simDurationMin') != null ? minutesToHHMM(get('simDurationMin')) : ''}
                    onChange={(k, v) => handleFieldChange(k, hhmmToMinutes(v))}
                    palette={palette}
                    half={isTablet}
                    placeholder="HH:MM"
                  />
                </View>
              </>
            )}

            <View
              className="mt-4 p-3 rounded-lg"
              style={{
                backgroundColor: accentTint(accent, isDark ? 0.06 : 0.03),
                borderWidth: 1,
                borderColor: accentTint(accent, 0.1),
              }}
            >
              <Text style={{ fontSize: 12, color: palette.textSecondary, lineHeight: 18 }}>
                Credit ratio multiplies block hours to derive credit hours. Override sets fixed credit time regardless
                of block. Rest periods enforced by FDTL rule engine.
              </Text>
            </View>
          </>
        )}
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
  placeholder,
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
  placeholder?: string
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
          placeholder={placeholder}
          placeholderTextColor={palette.textTertiary}
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
  options,
  editValue,
  fieldKey,
  onChange,
  palette,
  isDark,
  accent,
}: {
  label: string
  options: Array<{ key: string; label: string; color?: string }>
  editValue: any
  fieldKey: string
  onChange: (k: string, v: any) => void
  palette: Palette
  isDark: boolean
  accent: string
}) {
  return (
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
        {label}
      </Text>
      <View className="flex-row flex-wrap" style={{ gap: 6 }}>
        {options.map((opt) => {
          const active = editValue === opt.key
          const c = opt.color ?? accent
          return (
            <Pressable
              key={opt.key}
              onPress={() => onChange(fieldKey, opt.key)}
              className="flex-row items-center px-2.5 py-1.5 rounded-lg"
              style={{
                backgroundColor: active ? accentTint(c, isDark ? 0.15 : 0.08) : 'transparent',
                borderWidth: 1,
                borderColor: active ? c : palette.cardBorder,
                gap: 4,
              }}
            >
              {opt.color && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: opt.color }} />}
              <Text style={{ fontSize: 12, fontWeight: active ? '600' : '400', color: active ? c : palette.text }}>
                {opt.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
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
