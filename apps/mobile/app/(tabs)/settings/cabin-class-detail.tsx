import { useState, useCallback, useEffect, useMemo } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type CabinClassRef, type LopaConfigRef } from '@skyhub/api'
import {
  ChevronLeft,
  Pencil,
  Save,
  X,
  Trash2,
  Info,
  LayoutGrid,
  Ruler,
  MoveHorizontal,
  Armchair,
  Zap,
  Monitor,
  Star,
} from 'lucide-react-native'
import { accentTint, modeColor, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { SeatRowPreview } from '../../../components/lopa/SeatRowPreview'
import { ColorSwatchPicker } from '../../../components/lopa/ColorSwatchPicker'

type TabKey = 'specs' | 'usage'
const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'specs', label: 'Specs', icon: Info },
  { key: 'usage', label: 'Usage', icon: LayoutGrid },
]

const SEAT_TYPE_LABELS: Record<string, string> = {
  standard: 'Standard',
  premium: 'Premium',
  'lie-flat': 'Lie-Flat',
  suite: 'Suite',
}
const SEAT_TYPES = ['standard', 'premium', 'lie-flat', 'suite'] as const

export default function CabinClassDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()

  const [cabinClass, setCabinClass] = useState<CabinClassRef | null>(null)
  const [lopaConfigs, setLopaConfigs] = useState<LopaConfigRef[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('specs')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Partial<CabinClassRef>>({})

  useEffect(() => {
    if (!id) return
    Promise.all([api.getCabinClass(id), api.getLopaConfigs()])
      .then(([cc, configs]) => {
        setCabinClass(cc)
        setLopaConfigs(configs)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const get = (key: keyof CabinClassRef) => (key in draft ? (draft as any)[key] : cabinClass?.[key])

  const handleFieldChange = useCallback((key: string, value: any) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!cabinClass || Object.keys(draft).length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const updated = await api.updateCabinClass(cabinClass._id, draft)
      setCabinClass(updated)
      setDraft({})
      setEditing(false)
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save changes')
    } finally {
      setSaving(false)
    }
  }, [cabinClass, draft])

  const handleDelete = useCallback(() => {
    if (!cabinClass) return
    Alert.alert('Delete Cabin Class', `Delete ${cabinClass.code} — ${cabinClass.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteCabinClass(cabinClass._id)
            router.back()
          } catch (err: any) {
            let msg = err.message || 'Delete failed'
            try {
              const match = msg.match(/API (\d+): (.+)/)
              if (match) {
                const parsed = JSON.parse(match[2])
                msg = parsed.error || msg
              }
            } catch {
              /* raw */
            }
            Alert.alert('Cannot Delete', msg)
          }
        },
      },
    ])
  }, [cabinClass, router])

  // Usage computation
  const usage = useMemo(() => {
    if (!cabinClass) return []
    return lopaConfigs.filter((lc) => lc.cabins.some((c) => c.classCode === cabinClass.code))
  }, [cabinClass, lopaConfigs])

  const totalFleetSeats = useMemo(() => {
    return usage.reduce((sum, lc) => {
      const cabin = lc.cabins.find((c) => c.classCode === cabinClass?.code)
      return sum + (cabin?.seats ?? 0)
    }, 0)
  }, [usage, cabinClass])

  if (loading || !cabinClass) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>
            {loading ? 'Loading...' : 'Cabin class not found'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  const classColor = modeColor(get('color') || cabinClass.color || '#9ca3af', isDark)

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
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: classColor,
                marginRight: 8,
                borderWidth: 1,
                borderColor: palette.cardBorder,
              }}
            />
            <Text
              style={{ fontSize: 20, fontWeight: '700', fontFamily: 'monospace', color: palette.text, marginRight: 6 }}
            >
              {cabinClass.code}
            </Text>
            <Text style={{ fontSize: 16, color: palette.textSecondary, marginRight: 6 }}>—</Text>
            <Text style={{ fontSize: 18, fontWeight: '600', color: palette.text, flex: 1 }} numberOfLines={1}>
              {cabinClass.name}
            </Text>
            {cabinClass.isActive ? (
              <View
                className="px-2 py-0.5 rounded-full ml-2"
                style={{ backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7' }}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#4ade80' : '#166534' }}>Active</Text>
              </View>
            ) : (
              <View
                className="px-2 py-0.5 rounded-full ml-2"
                style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#f87171' : '#991b1b' }}>Inactive</Text>
              </View>
            )}
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
      </View>

      {/* Hero: Seat Row Preview */}
      {cabinClass.seatLayout && (
        <View
          style={{
            paddingVertical: 16,
            paddingHorizontal: 24,
            borderBottomWidth: 1,
            borderBottomColor: palette.border,
            alignItems: 'center',
          }}
        >
          <SeatRowPreview
            seatLayout={editing && draft.seatLayout ? draft.seatLayout : cabinClass.seatLayout}
            color={classColor}
            seatType={(editing && 'seatType' in draft ? draft.seatType : cabinClass.seatType) as any}
            pitchIn={editing && 'seatPitchIn' in draft ? draft.seatPitchIn : cabinClass.seatPitchIn}
            palette={palette}
          />
        </View>
      )}

      {/* Metric cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 10,
          flexGrow: 1,
          justifyContent: 'center',
        }}
        style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: palette.border }}
      >
        {cabinClass.seatPitchIn != null && (
          <MetricCard
            icon={Ruler}
            label="Pitch"
            value={`${cabinClass.seatPitchIn}"`}
            color={classColor}
            palette={palette}
          />
        )}
        {cabinClass.seatWidthIn != null && (
          <MetricCard
            icon={MoveHorizontal}
            label="Width"
            value={`${cabinClass.seatWidthIn}"`}
            color={classColor}
            palette={palette}
          />
        )}
        {cabinClass.seatType && (
          <MetricCard
            icon={Armchair}
            label="Type"
            value={SEAT_TYPE_LABELS[cabinClass.seatType] || cabinClass.seatType}
            color={classColor}
            palette={palette}
          />
        )}
        <MetricCard
          icon={Zap}
          label="Power"
          value={cabinClass.hasPower ? 'Yes' : 'No'}
          color={cabinClass.hasPower ? classColor : '#9ca3af'}
          palette={palette}
        />
        <MetricCard
          icon={Monitor}
          label="IFE"
          value={cabinClass.hasIfe ? 'Yes' : 'No'}
          color={cabinClass.hasIfe ? classColor : '#9ca3af'}
          palette={palette}
        />
      </ScrollView>

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
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className="flex-row items-center px-3 py-2 rounded-lg"
              style={{ backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent', gap: 6 }}
            >
              <Icon size={15} color={active ? accent : palette.textSecondary} strokeWidth={1.8} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: active ? '600' : '500',
                  color: active ? accent : palette.textSecondary,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* Tab content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === 'specs' && (
          <>
            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              <Field
                label="Code"
                value={cabinClass.code}
                editing={editing}
                fieldKey="code"
                editValue={get('code')}
                onChange={handleFieldChange}
                palette={palette}
                mono
                maxLength={2}
                half={isTablet}
              />
              <Field
                label="Name"
                value={cabinClass.name}
                editing={editing}
                fieldKey="name"
                editValue={get('name')}
                onChange={handleFieldChange}
                palette={palette}
                half={isTablet}
              />
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
                value={get('color') || '#9ca3af'}
                onChange={(v) => handleFieldChange('color', v)}
                palette={palette}
                isDark={isDark}
                editing={editing}
              />
            </View>

            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              <Field
                label="Sort Order"
                value={String(cabinClass.sortOrder)}
                editing={editing}
                fieldKey="sortOrder"
                editValue={get('sortOrder')}
                onChange={handleFieldChange}
                palette={palette}
                numeric
                half={isTablet}
              />
              <Field
                label="Seat Layout"
                value={cabinClass.seatLayout}
                editing={editing}
                fieldKey="seatLayout"
                editValue={get('seatLayout')}
                onChange={handleFieldChange}
                palette={palette}
                mono
                half={isTablet}
              />
              <Field
                label="Seat Pitch (in)"
                value={cabinClass.seatPitchIn != null ? `${cabinClass.seatPitchIn}"` : null}
                editing={editing}
                fieldKey="seatPitchIn"
                editValue={get('seatPitchIn')}
                onChange={handleFieldChange}
                palette={palette}
                numeric
                half={isTablet}
              />
              <Field
                label="Seat Width (in)"
                value={cabinClass.seatWidthIn != null ? `${cabinClass.seatWidthIn}"` : null}
                editing={editing}
                fieldKey="seatWidthIn"
                editValue={get('seatWidthIn')}
                onChange={handleFieldChange}
                palette={palette}
                numeric
                half={isTablet}
              />
            </View>

            {/* Seat Type */}
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
                Seat Type
              </Text>
              {editing ? (
                <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                  {SEAT_TYPES.map((st) => {
                    const active = get('seatType') === st
                    return (
                      <Pressable
                        key={st}
                        onPress={() => handleFieldChange('seatType', st)}
                        className="px-3 py-1.5 rounded-lg"
                        style={{
                          backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent',
                          borderWidth: 1,
                          borderColor: active ? accent : palette.cardBorder,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: active ? '600' : '400',
                            color: active ? accent : palette.text,
                          }}
                        >
                          {SEAT_TYPE_LABELS[st]}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              ) : (
                <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }}>
                  {cabinClass.seatType ? SEAT_TYPE_LABELS[cabinClass.seatType] : '---'}
                </Text>
              )}
            </View>

            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              <ToggleField
                label="IFE Screen"
                value={cabinClass.hasIfe}
                editing={editing}
                fieldKey="hasIfe"
                editValue={get('hasIfe')}
                onChange={handleFieldChange}
                palette={palette}
                isDark={isDark}
                half={isTablet}
              />
              <ToggleField
                label="Power Outlet"
                value={cabinClass.hasPower}
                editing={editing}
                fieldKey="hasPower"
                editValue={get('hasPower')}
                onChange={handleFieldChange}
                palette={palette}
                isDark={isDark}
                half={isTablet}
              />
              <ToggleField
                label="Active"
                value={cabinClass.isActive}
                editing={editing}
                fieldKey="isActive"
                editValue={get('isActive')}
                onChange={handleFieldChange}
                palette={palette}
                isDark={isDark}
                half={isTablet}
              />
            </View>
          </>
        )}

        {activeTab === 'usage' && (
          <>
            {usage.length === 0 ? (
              <Text style={{ fontSize: 13, color: palette.textSecondary, paddingVertical: 16 }}>
                This cabin class is not used in any LOPA configuration yet.
              </Text>
            ) : (
              <>
                {usage.map((lc) => {
                  const cabin = lc.cabins.find((c) => c.classCode === cabinClass.code)
                  return (
                    <View
                      key={lc._id}
                      className="flex-row items-center rounded-xl"
                      style={{
                        borderWidth: 1,
                        borderColor: palette.cardBorder,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        marginBottom: 8,
                        gap: 10,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '700',
                          fontFamily: 'monospace',
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 6,
                          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                          color: palette.text,
                          overflow: 'hidden',
                        }}
                      >
                        {lc.aircraftType}
                      </Text>
                      <View className="flex-1">
                        <View className="flex-row items-center" style={{ gap: 4 }}>
                          <Text style={{ fontSize: 13, fontWeight: '500', color: palette.text }} numberOfLines={1}>
                            {lc.configName}
                          </Text>
                          {lc.isDefault && <Star size={11} color="#f59e0b" fill="#f59e0b" strokeWidth={1.5} />}
                        </View>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: classColor, fontFamily: 'monospace' }}>
                        {cabin?.seats ?? 0}
                      </Text>
                      <Text style={{ fontSize: 12, color: palette.textTertiary }}>seats</Text>
                    </View>
                  )
                })}
                <View
                  className="flex-row items-center justify-between"
                  style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.border }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '500', color: palette.textSecondary }}>
                    {usage.length} configuration{usage.length !== 1 ? 's' : ''}
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: classColor }}>
                    {totalFleetSeats.toLocaleString()} total seats
                  </Text>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Metric card ──
function MetricCard({
  icon: Icon,
  label,
  value,
  color,
  palette,
}: {
  icon: any
  label: string
  value: string
  color: string
  palette: Palette
}) {
  return (
    <View
      className="flex-row items-center rounded-xl"
      style={{ borderWidth: 1, borderColor: palette.cardBorder, paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}
    >
      <Icon size={16} color={color} strokeWidth={1.8} />
      <View>
        <Text
          style={{
            fontSize: 11,
            color: palette.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            fontWeight: '600',
          }}
        >
          {label}
        </Text>
        <Text style={{ fontSize: 14, fontWeight: '700', color, marginTop: 1 }}>{value}</Text>
      </View>
    </View>
  )
}

// ── Field ──
function Field({
  label,
  value,
  editing,
  fieldKey,
  editValue,
  onChange,
  palette,
  numeric,
  mono,
  maxLength,
  half,
}: {
  label: string
  value: any
  editing: boolean
  fieldKey: string
  editValue: any
  onChange: (k: string, v: any) => void
  palette: Palette
  numeric?: boolean
  mono?: boolean
  maxLength?: number
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
            if (mono && fieldKey === 'code') v = v.toUpperCase()
            onChange(fieldKey, numeric ? (v === '' ? null : Number(v)) : v)
          }}
          keyboardType={numeric ? 'numeric' : 'default'}
          autoCapitalize={mono ? 'characters' : 'sentences'}
          maxLength={maxLength}
          style={{
            fontSize: 15,
            fontWeight: '500',
            color: palette.text,
            fontFamily: mono ? 'monospace' : undefined,
            borderBottomWidth: 1,
            borderBottomColor: accentTint('#1e40af', 0.3),
            paddingVertical: 4,
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
        {value ?? '---'}
      </Text>
    </View>
  )
}

// ── Toggle field ──
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
