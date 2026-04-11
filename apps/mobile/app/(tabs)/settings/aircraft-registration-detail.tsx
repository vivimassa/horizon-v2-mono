import { useState, useCallback, useEffect, useMemo } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import {
  api,
  type AircraftRegistrationRef,
  type AircraftTypeRef,
  type LopaConfigRef,
  type CabinClassRef,
} from '@skyhub/api'
import {
  ChevronLeft,
  Pencil,
  Save,
  X,
  Trash2,
  Info,
  Gauge,
  Armchair,
  Package,
  Users,
  CloudRain,
  MapPin,
  Wrench,
  Star,
} from 'lucide-react-native'
import { accentTint, modeColor, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { useOperatorId } from '../../../hooks/useOperatorId'

type TabKey = 'basic' | 'perf' | 'seating' | 'cargo' | 'crew' | 'weather' | 'location' | 'maint'
const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'basic', label: 'Basic', icon: Info },
  { key: 'perf', label: 'Performance', icon: Gauge },
  { key: 'seating', label: 'Seating', icon: Armchair },
  { key: 'cargo', label: 'Cargo', icon: Package },
  { key: 'crew', label: 'Crew', icon: Users },
  { key: 'weather', label: 'Weather', icon: CloudRain },
  { key: 'location', label: 'Location', icon: MapPin },
  { key: 'maint', label: 'Maintenance', icon: Wrench },
]

const STATUS_OPTIONS = ['active', 'maintenance', 'stored', 'retired']
const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',
  maintenance: '#f59e0b',
  stored: '#6b7280',
  retired: '#ef4444',
}
const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  maintenance: 'Maintenance',
  stored: 'Stored',
  retired: 'Retired',
}

const AIRCRAFT_IMAGES: Record<string, any> = {
  A320: require('../../../assets/A320.png'),
  A321: require('../../../assets/A321.png'),
  A350: require('../../../assets/A350.png'),
  A380: require('../../../assets/A380.png'),
}

function isLeaseExpiringSoon(date: string | null): 'expired' | 'warning' | null {
  if (!date) return null
  const d = new Date(date),
    now = new Date()
  if (d < now) return 'expired'
  const sixMonths = new Date(now)
  sixMonths.setMonth(sixMonths.getMonth() + 6)
  if (d < sixMonths) return 'warning'
  return null
}

export default function AircraftRegistrationDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const operatorId = useOperatorId()

  const [reg, setReg] = useState<AircraftRegistrationRef | null>(null)
  const [acTypes, setAcTypes] = useState<AircraftTypeRef[]>([])
  const [lopaConfigs, setLopaConfigs] = useState<LopaConfigRef[]>([])
  const [cabinClasses, setCabinClasses] = useState<CabinClassRef[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('basic')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!id) return
    Promise.all([api.getAircraftRegistration(id), api.getAircraftTypes(), api.getCabinClasses()])
      .then(([r, types, classes]) => {
        setReg(r)
        setAcTypes(types)
        setCabinClasses(classes)
        const acType = types.find((t) => t._id === r.aircraftTypeId)
        if (acType) api.getLopaConfigs(operatorId, acType.icaoType).then(setLopaConfigs).catch(console.error)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const acType = useMemo(() => acTypes.find((t) => t._id === reg?.aircraftTypeId), [acTypes, reg])
  const get = (key: string) => (key in draft ? draft[key] : (reg as any)?.[key])

  const handleFieldChange = useCallback((key: string, value: any) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!reg || Object.keys(draft).length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const updated = await api.updateAircraftRegistration(reg._id, draft)
      setReg(updated)
      setDraft({})
      setEditing(false)
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }, [reg, draft])

  const handleDelete = useCallback(() => {
    if (!reg) return
    Alert.alert('Delete Aircraft', `Delete ${reg.registration}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteAircraftRegistration(reg._id)
            router.back()
          } catch (err: any) {
            let msg = err.message || 'Delete failed'
            try {
              const m = msg.match(/API (\d+): (.+)/)
              if (m) msg = JSON.parse(m[2]).error || msg
            } catch {}
            Alert.alert('Cannot Delete', msg)
          }
        },
      },
    ])
  }, [reg, router])

  if (loading || !reg) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>
            {loading ? 'Loading...' : 'Registration not found'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  const statusColor = STATUS_COLORS[reg.status] || '#6b7280'
  const leaseStatus = isLeaseExpiringSoon(reg.leaseExpiryDate)
  const heroImg = acType ? AIRCRAFT_IMAGES[acType.icaoType] : null

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-4 pb-4" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-2">
            <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
              <ChevronLeft size={24} color={accent} strokeWidth={2} />
            </Pressable>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor, marginRight: 8 }} />
            <Text
              style={{ fontSize: 20, fontWeight: '700', fontFamily: 'monospace', color: palette.text, marginRight: 8 }}
            >
              {reg.registration}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '500', color: palette.textSecondary, flex: 1 }} numberOfLines={1}>
              {acType?.name || '---'}
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
          <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: `${statusColor}20` }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: statusColor }}>{STATUS_LABELS[reg.status]}</Text>
          </View>
          {acType && (
            <View
              className="px-2 py-0.5 rounded-full"
              style={{ backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff' }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  fontFamily: 'monospace',
                  color: isDark ? '#818cf8' : '#4338ca',
                }}
              >
                {acType.icaoType}
              </Text>
            </View>
          )}
          {leaseStatus === 'expired' && (
            <View
              className="px-2 py-0.5 rounded-full"
              style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#f87171' : '#dc2626' }}>
                Lease Expired
              </Text>
            </View>
          )}
          {leaseStatus === 'warning' && (
            <View
              className="px-2 py-0.5 rounded-full"
              style={{ backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#fef3c7' }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#fbbf24' : '#b45309' }}>
                Lease Expiring
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Hero image */}
      {heroImg && (
        <View style={{ height: 220, borderBottomWidth: 1, borderBottomColor: palette.border, overflow: 'hidden' }}>
          <Image
            source={heroImg}
            style={{ width: '100%', height: 220, opacity: isDark ? 0.6 : 0.75 }}
            resizeMode="contain"
          />
        </View>
      )}

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: palette.border }}
        contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 8, gap: 4 }}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className="flex-row items-center px-3 py-2 rounded-lg"
              style={{ backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent', gap: 4 }}
            >
              <Icon size={14} color={active ? accent : palette.textSecondary} strokeWidth={1.8} />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: active ? '600' : '500',
                  color: active ? accent : palette.textSecondary,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Tab content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === 'basic' && (
          <>
            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              <Field
                label="Registration"
                value={reg.registration}
                editing={editing}
                fieldKey="registration"
                editValue={get('registration')}
                onChange={handleFieldChange}
                palette={palette}
                mono
                half={isTablet}
              />
              <Field
                label="Serial Number"
                value={reg.serialNumber}
                editing={editing}
                fieldKey="serialNumber"
                editValue={get('serialNumber')}
                onChange={handleFieldChange}
                palette={palette}
                mono
                half={isTablet}
              />
              <Field
                label="Variant"
                value={reg.variant}
                editing={editing}
                fieldKey="variant"
                editValue={get('variant')}
                onChange={handleFieldChange}
                palette={palette}
                half={isTablet}
              />
              <Field
                label="Home Base"
                value={reg.homeBaseIcao}
                editing={editing}
                fieldKey="homeBaseIcao"
                editValue={get('homeBaseIcao')}
                onChange={handleFieldChange}
                palette={palette}
                mono
                half={isTablet}
              />
              <Field
                label="SELCAL"
                value={reg.selcal}
                editing={editing}
                fieldKey="selcal"
                editValue={get('selcal')}
                onChange={handleFieldChange}
                palette={palette}
                mono
                half={isTablet}
              />
              <Field
                label="Date of Manufacture"
                value={reg.dateOfManufacture?.split('T')[0]}
                editing={editing}
                fieldKey="dateOfManufacture"
                editValue={get('dateOfManufacture')?.split?.('T')?.[0] ?? get('dateOfManufacture')}
                onChange={handleFieldChange}
                palette={palette}
                half={isTablet}
              />
              <Field
                label="Date of Delivery"
                value={reg.dateOfDelivery?.split('T')[0]}
                editing={editing}
                fieldKey="dateOfDelivery"
                editValue={get('dateOfDelivery')?.split?.('T')?.[0] ?? get('dateOfDelivery')}
                onChange={handleFieldChange}
                palette={palette}
                half={isTablet}
              />
              <Field
                label="Lease Expiry"
                value={reg.leaseExpiryDate?.split('T')[0]}
                editing={editing}
                fieldKey="leaseExpiryDate"
                editValue={get('leaseExpiryDate')?.split?.('T')?.[0] ?? get('leaseExpiryDate')}
                onChange={handleFieldChange}
                palette={palette}
                half={isTablet}
              />
              <PickerField
                label="Status"
                value={STATUS_LABELS[reg.status]}
                options={STATUS_OPTIONS.map((s) => STATUS_LABELS[s])}
                editing={editing}
                fieldKey="status"
                editValue={STATUS_LABELS[get('status')] || get('status')}
                onChange={(k, v) => {
                  const s = STATUS_OPTIONS.find((o) => STATUS_LABELS[o] === v)
                  handleFieldChange(k, s || v)
                }}
                palette={palette}
                isDark={isDark}
                accent={accent}
                half={isTablet}
              />
              <ToggleField
                label="Active"
                value={reg.isActive}
                editing={editing}
                fieldKey="isActive"
                editValue={get('isActive')}
                onChange={handleFieldChange}
                palette={palette}
                isDark={isDark}
                half={isTablet}
              />
            </View>
            <Field
              label="Notes"
              value={reg.notes}
              editing={editing}
              fieldKey="notes"
              editValue={get('notes')}
              onChange={handleFieldChange}
              palette={palette}
              multiline
            />
          </>
        )}

        {activeTab === 'perf' && acType && (
          <>
            <InfoBox
              text="Data inherited from aircraft type. Edit in Aircraft Types."
              palette={palette}
              isDark={isDark}
              accent={accent}
            />
            <Section title="Weights" accent={accent} />
            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              <ReadOnly label="MTOW (kg)" value={acType.performance?.mtowKg} palette={palette} half={isTablet} />
              <ReadOnly label="MLW (kg)" value={acType.performance?.mlwKg} palette={palette} half={isTablet} />
              <ReadOnly label="MZFW (kg)" value={acType.performance?.mzfwKg} palette={palette} half={isTablet} />
              <ReadOnly label="OEW (kg)" value={acType.performance?.oewKg} palette={palette} half={isTablet} />
            </View>
            <Section title="Fuel" accent={accent} />
            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              <ReadOnly
                label="Max Fuel (kg)"
                value={acType.performance?.maxFuelCapacityKg}
                palette={palette}
                half={isTablet}
              />
              <ReadOnly
                label="Fuel Burn (kg/hr)"
                value={acType.fuelBurnRateKgPerHour}
                palette={palette}
                half={isTablet}
              />
            </View>
            <Section title="Speed & Range" accent={accent} />
            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              <ReadOnly
                label="Cruising Speed (kts)"
                value={acType.performance?.cruisingSpeedKts}
                palette={palette}
                half={isTablet}
              />
              <ReadOnly
                label="Max Range (NM)"
                value={acType.performance?.maxRangeNm}
                palette={palette}
                half={isTablet}
              />
              <ReadOnly label="Ceiling (FL)" value={acType.performance?.ceilingFl} palette={palette} half={isTablet} />
            </View>
          </>
        )}

        {activeTab === 'seating' && (
          <>
            <InfoBox
              text="Click to assign. Manage configs in LOPA Database."
              palette={palette}
              isDark={isDark}
              accent={accent}
            />
            {lopaConfigs.length === 0 ? (
              <Text style={{ fontSize: 13, color: palette.textSecondary, paddingVertical: 16 }}>
                No LOPA configurations found.
              </Text>
            ) : (
              lopaConfigs.map((lc) => {
                const isSelected = reg.lopaConfigId === lc._id
                return (
                  <Pressable
                    key={lc._id}
                    onPress={() => {
                      if (!editing) return
                      handleFieldChange('lopaConfigId', isSelected ? null : lc._id)
                    }}
                    className="rounded-xl mb-3"
                    style={{
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? accent : palette.cardBorder,
                      padding: 12,
                      backgroundColor: isSelected ? accentTint(accent, isDark ? 0.08 : 0.04) : undefined,
                    }}
                  >
                    <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>{lc.configName}</Text>
                      {lc.isDefault && <Star size={12} color="#f59e0b" fill="#f59e0b" strokeWidth={1.5} />}
                      {isSelected && (
                        <Text style={{ fontSize: 11, fontWeight: '600', color: accent, marginLeft: 4 }}>Assigned</Text>
                      )}
                      <View className="flex-1" />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: accent }}>{lc.totalSeats} seats</Text>
                    </View>
                    {lc.cabins.map((cabin, i) => {
                      const cc = cabinClasses.find((c) => c.code === cabin.classCode)
                      const color = modeColor(cc?.color || '#9ca3af', isDark)
                      return (
                        <View key={i} className="flex-row items-center" style={{ gap: 8, paddingVertical: 3 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: '600',
                              fontFamily: 'monospace',
                              color: palette.text,
                              width: 24,
                            }}
                          >
                            {cabin.classCode}
                          </Text>
                          <Text style={{ fontSize: 13, color: palette.textSecondary, flex: 1 }}>
                            {cc?.name || cabin.classCode}
                          </Text>
                          <Text
                            style={{ fontSize: 13, fontWeight: '600', fontFamily: 'monospace', color: palette.text }}
                          >
                            {cabin.seats}
                          </Text>
                        </View>
                      )
                    })}
                  </Pressable>
                )
              })
            )}
          </>
        )}

        {activeTab === 'cargo' && acType && (
          <>
            <InfoBox text="Data inherited from aircraft type." palette={palette} isDark={isDark} accent={accent} />
            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              <ReadOnly
                label="Max Cargo (kg)"
                value={acType.cargo?.maxCargoWeightKg}
                palette={palette}
                half={isTablet}
              />
              <ReadOnly
                label="Cargo Positions"
                value={acType.cargo?.cargoPositions}
                palette={palette}
                half={isTablet}
              />
              <ReadOnly
                label="Bulk Hold (kg)"
                value={acType.cargo?.bulkHoldCapacityKg}
                palette={palette}
                half={isTablet}
              />
            </View>
            <ReadOnly label="ULD Types" value={acType.cargo?.uldTypesAccepted?.join(', ')} palette={palette} />
          </>
        )}

        {activeTab === 'crew' && acType && (
          <>
            <InfoBox text="Data inherited from aircraft type." palette={palette} isDark={isDark} accent={accent} />
            <Section title="Cockpit Rest" accent={accent} />
            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              <ReadOnly label="Class" value={acType.crewRest?.cockpitClass} palette={palette} half={isTablet} />
              <ReadOnly label="Positions" value={acType.crewRest?.cockpitPositions} palette={palette} half={isTablet} />
            </View>
            <Section title="Cabin Rest" accent={accent} />
            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              <ReadOnly label="Class" value={acType.crewRest?.cabinClass} palette={palette} half={isTablet} />
              <ReadOnly label="Positions" value={acType.crewRest?.cabinPositions} palette={palette} half={isTablet} />
            </View>
          </>
        )}

        {activeTab === 'weather' && acType && (
          <>
            <InfoBox text="Data inherited from aircraft type." palette={palette} isDark={isDark} accent={accent} />
            <Section title="Weather Limitations" accent={accent} />
            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              <ReadOnly
                label="Min Ceiling (ft)"
                value={acType.weather?.minCeilingFt}
                palette={palette}
                half={isTablet}
              />
              <ReadOnly label="Min RVR (m)" value={acType.weather?.minRvrM} palette={palette} half={isTablet} />
              <ReadOnly
                label="Min Visibility (m)"
                value={acType.weather?.minVisibilityM}
                palette={palette}
                half={isTablet}
              />
              <ReadOnly
                label="Max Crosswind (kt)"
                value={acType.weather?.maxCrosswindKt}
                palette={palette}
                half={isTablet}
              />
              <ReadOnly label="Max Wind (kt)" value={acType.weather?.maxWindKt} palette={palette} half={isTablet} />
            </View>
            <Section title="Approach" accent={accent} />
            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              <ReadOnly
                label="ILS Category"
                value={acType.approach?.ilsCategoryRequired}
                palette={palette}
                half={isTablet}
              />
              <ReadOnly
                label="Autoland"
                value={acType.approach?.autolandCapable ? 'Yes' : 'No'}
                palette={palette}
                half={isTablet}
              />
            </View>
          </>
        )}

        {activeTab === 'location' && (
          <View className={isTablet ? 'flex-row flex-wrap' : ''}>
            <Field
              label="Current Location"
              value={reg.currentLocationIcao}
              editing={editing}
              fieldKey="currentLocationIcao"
              editValue={get('currentLocationIcao')}
              onChange={handleFieldChange}
              palette={palette}
              mono
              half={isTablet}
            />
            <ReadOnly
              label="Last Updated"
              value={reg.currentLocationUpdatedAt?.split('T')[0]}
              palette={palette}
              half={isTablet}
            />
          </View>
        )}

        {activeTab === 'maint' && (
          <View className="flex-1 items-center justify-center py-16">
            <Wrench size={40} color={palette.textTertiary} strokeWidth={1.2} />
            <Text style={{ fontSize: 15, color: palette.textSecondary, marginTop: 12 }}>
              Coming in Maintenance module
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Helpers ──

function InfoBox({
  text,
  palette,
  isDark,
  accent,
}: {
  text: string
  palette: Palette
  isDark: boolean
  accent: string
}) {
  return (
    <View
      className="rounded-lg px-3 py-2.5 mb-3"
      style={{
        backgroundColor: accentTint(accent, isDark ? 0.08 : 0.05),
        borderWidth: 1,
        borderColor: accentTint(accent, 0.15),
      }}
    >
      <Text style={{ fontSize: 12, color: accent }}>{text}</Text>
    </View>
  )
}

function Section({ title, accent }: { title: string; accent: string }) {
  return (
    <View className="flex-row items-center mt-4 mb-2" style={{ gap: 6 }}>
      <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accent }} />
      <Text style={{ fontSize: 14, fontWeight: '700', color: accent }}>{title}</Text>
    </View>
  )
}

function ReadOnly({ label, value, palette, half }: { label: string; value: any; palette: Palette; half?: boolean }) {
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
      <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }}>{value ?? '---'}</Text>
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
  multiline,
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
  multiline?: boolean
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
            onChange(fieldKey, v)
          }}
          autoCapitalize={mono ? 'characters' : 'sentences'}
          multiline={multiline}
          style={{
            fontSize: 15,
            fontWeight: '500',
            color: palette.text,
            fontFamily: mono ? 'monospace' : undefined,
            borderBottomWidth: 1,
            borderBottomColor: accentTint('#1e40af', 0.3),
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
        {value ?? '---'}
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
  value: any
  options: string[]
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
        <View className="flex-row flex-wrap" style={{ gap: 6 }}>
          {options.map((opt) => {
            const active = (editValue || value) === opt
            return (
              <Pressable
                key={opt}
                onPress={() => onChange(fieldKey, opt)}
                className="px-3 py-1.5 rounded-lg"
                style={{
                  backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? accent : palette.cardBorder,
                }}
              >
                <Text
                  style={{ fontSize: 12, fontWeight: active ? '600' : '400', color: active ? accent : palette.text }}
                >
                  {opt}
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
      <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }}>{value ?? '---'}</Text>
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
