import { useState, useCallback, useEffect, useRef } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert, FlatList, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, getApiBaseUrl, type OperatorRef, type AirportRef } from '@skyhub/api'
import { DATE_FORMAT_OPTIONS } from '@skyhub/logic'
import {
  ChevronLeft,
  Building2,
  Clock,
  Palette,
  Layers,
  Save,
  Check,
  X,
  ChevronDown,
  Search,
} from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'react-native'
import { accentTint, type Palette as PaletteType } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useOperatorStore } from '../../../src/stores/use-operator-store'
import { tokenStorage } from '../../../src/lib/token-storage'
import { useHubBack } from '../../../lib/use-hub-back'

type SectionKey = 'company' | 'operations' | 'branding' | 'modules'

const SECTIONS: { key: SectionKey; label: string; icon: any; desc: string }[] = [
  { key: 'company', label: 'Company Information', icon: Building2, desc: 'Identity & registration' },
  { key: 'operations', label: 'Operational Settings', icon: Clock, desc: 'Timezone, base, regulations' },
  { key: 'branding', label: 'Branding', icon: Palette, desc: 'Logo & visual identity' },
  { key: 'modules', label: 'Enabled Modules', icon: Layers, desc: 'Feature access control' },
]

const ALL_MODULES = ['home', 'network', 'flight-ops', 'ground-ops', 'crew-ops', 'settings']

export default function OperatorConfigScreen() {
  const router = useRouter()
  const { palette, isDark, accent } = useAppTheme()
  // Swipe-back lands on hub home with the System Administration panel open.
  useHubBack('sysadmin')

  const [operator, setOperator] = useState<OperatorRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [draft, setDraft] = useState<Partial<OperatorRef>>({})
  const [activeSection, setActiveSection] = useState<SectionKey>('company')

  const fetchOperator = useCallback(async () => {
    setLoading(true)
    try {
      const ops = await api.getOperators()
      if (ops.length > 0) setOperator(ops[0])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOperator()
  }, [fetchOperator])

  const handleChange = useCallback((key: string, value: any) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }, [])

  const getVal = (key: keyof OperatorRef) => (key in draft ? (draft as any)[key] : operator?.[key])

  const handleSave = useCallback(async () => {
    if (!operator || Object.keys(draft).length === 0) return
    setSaving(true)
    setSaved(false)
    try {
      const updated = await api.updateOperator(operator._id, draft)
      setOperator(updated)
      // Propagate to the app-wide operator store so date-format consumers
      // (non-crew screens, future date pickers) refresh without reload.
      useOperatorStore.getState().setOperator(updated)
      setDraft({})
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }, [operator, draft])

  const hasDraft = Object.keys(draft).length > 0

  if (loading || !operator) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 14, color: palette.textTertiary }}>
            {loading ? 'Loading…' : 'No operator configured'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
      <View
        className="px-4 pt-2 pb-3 flex-row items-center justify-between"
        style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}
      >
        <View className="flex-row items-center flex-1">
          <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
            <ChevronLeft size={24} color={accent} strokeWidth={2} />
          </Pressable>
          <View
            className="items-center justify-center rounded-lg mr-3"
            style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}
          >
            <Building2 size={18} color={accent} strokeWidth={1.8} />
          </View>
          <View className="flex-1">
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Operator Config</Text>
            <Text style={{ fontSize: 13, color: palette.textSecondary }}>{operator.name}</Text>
          </View>
        </View>

        <Pressable
          onPress={handleSave}
          disabled={saving || !hasDraft}
          className="flex-row items-center px-3 py-2 rounded-lg active:opacity-60"
          style={{ backgroundColor: saved ? '#16a34a' : accent, opacity: !hasDraft && !saving ? 0.4 : 1, gap: 4 }}
        >
          {saved ? (
            <Check size={14} color="#fff" strokeWidth={2.5} />
          ) : (
            <Save size={14} color="#fff" strokeWidth={1.8} />
          )}
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </Text>
        </Pressable>
      </View>

      {/* Section tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 4 }}
        style={{ borderBottomWidth: 1, borderBottomColor: palette.border, flexGrow: 0 }}
      >
        {SECTIONS.map((section) => {
          const Icon = section.icon
          const active = activeSection === section.key
          return (
            <Pressable
              key={section.key}
              onPress={() => setActiveSection(section.key)}
              className="flex-row items-center px-3 py-2 rounded-lg"
              style={{ backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent', gap: 6 }}
            >
              <Icon size={14} color={active ? accent : palette.textSecondary} strokeWidth={1.8} />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: active ? '600' : '500',
                  color: active ? accent : palette.textSecondary,
                }}
              >
                {section.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Content */}
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {activeSection === 'company' && (
          <View style={{ gap: 0 }}>
            <Field
              label="Company Name"
              required
              value={getVal('name')}
              fieldKey="name"
              onChange={handleChange}
              palette={palette}
            />
            <Field
              label="Country"
              required
              value={getVal('country')}
              fieldKey="country"
              onChange={handleChange}
              palette={palette}
            />
            <View className="flex-row" style={{ gap: 16 }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="ICAO Code"
                  value={getVal('icaoCode') || getVal('code')}
                  fieldKey="icaoCode"
                  onChange={handleChange}
                  palette={palette}
                  hint="3 uppercase letters"
                  maxLength={3}
                  uppercase
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="IATA Code"
                  value={getVal('iataCode')}
                  fieldKey="iataCode"
                  onChange={handleChange}
                  palette={palette}
                  hint="2 uppercase alphanumeric"
                  maxLength={2}
                  uppercase
                />
              </View>
            </View>
            <Field
              label="Callsign"
              value={getVal('callsign')}
              fieldKey="callsign"
              onChange={handleChange}
              palette={palette}
              hint="Radio telephony callsign"
            />
            <Field
              label="Regulatory Authority"
              value={getVal('regulatoryAuthority')}
              fieldKey="regulatoryAuthority"
              onChange={handleChange}
              palette={palette}
              hint="e.g. CAAV, FAA, EASA, CAA"
            />
          </View>
        )}

        {activeSection === 'operations' && (
          <View style={{ gap: 0 }}>
            <Field
              label="Timezone (IANA)"
              required
              value={getVal('timezone')}
              fieldKey="timezone"
              onChange={handleChange}
              palette={palette}
              hint="e.g. Asia/Ho_Chi_Minh"
            />
            <AirportPicker
              label="Main Base"
              required
              value={getVal('mainBaseIcao')}
              onChange={(v) => handleChange('mainBaseIcao', v)}
              palette={palette}
              isDark={isDark}
              accent={accent}
              hint="Primary hub — basis for FDTL and crew rules"
            />
            <Field
              label="FDTL Ruleset"
              value={getVal('fdtlRuleset')}
              fieldKey="fdtlRuleset"
              onChange={handleChange}
              palette={palette}
              hint="Fatigue & duty time regulation set"
            />
            <Field
              label="Currency Code"
              value={getVal('currencyCode')}
              fieldKey="currencyCode"
              onChange={handleChange}
              palette={palette}
              hint="e.g. USD, EUR, VND"
              maxLength={3}
              uppercase
            />
            <SelectField
              label="Date Format"
              value={(getVal('dateFormat') as string) ?? 'DD-MMM-YY'}
              options={DATE_FORMAT_OPTIONS.map((o) => ({
                value: o.value,
                label: `${o.label}  ·  ${o.example}`,
              }))}
              onChange={(v) => handleChange('dateFormat', v)}
              palette={palette}
              isDark={isDark}
              accent={accent}
              hint="Applies to every date displayed across the app."
            />
            <SelectField
              label="Delay Code Adherence"
              value={(getVal('delayCodeAdherence') as string) ?? 'ahm730'}
              options={[
                { value: 'ahm730', label: 'AHM 730 (IATA standard)' },
                { value: 'ahm732', label: 'AHM 732 (extended set)' },
              ]}
              onChange={(v) => handleChange('delayCodeAdherence', v)}
              palette={palette}
              isDark={isDark}
              accent={accent}
              hint="Reference standard used by Delay Codes master data."
            />
          </View>
        )}

        {activeSection === 'branding' && operator && (
          <LogoUploadMobile
            operator={operator}
            onRefresh={fetchOperator}
            palette={palette}
            isDark={isDark}
            accent={accent}
          />
        )}

        {activeSection === 'modules' && (
          <View style={{ gap: 8 }}>
            {ALL_MODULES.map((mod) => {
              const modules: string[] = getVal('enabledModules') ?? []
              const enabled = modules.includes(mod)
              return (
                <Pressable
                  key={mod}
                  className="flex-row items-center justify-between px-4 py-3.5 rounded-xl"
                  style={{
                    backgroundColor: enabled
                      ? accentTint(accent, isDark ? 0.08 : 0.04)
                      : isDark
                        ? 'rgba(255,255,255,0.03)'
                        : 'rgba(0,0,0,0.02)',
                    borderWidth: 1,
                    borderColor: enabled
                      ? accentTint(accent, isDark ? 0.2 : 0.12)
                      : isDark
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(0,0,0,0.05)',
                  }}
                  onPress={() => {
                    const next = enabled ? modules.filter((m) => m !== mod) : [...modules, mod]
                    handleChange('enabledModules', next)
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '500',
                      color: enabled ? accent : palette.text,
                      textTransform: 'capitalize',
                    }}
                  >
                    {mod.replace('-', ' ')}
                  </Text>
                  <View
                    className="px-3 py-1 rounded-lg"
                    style={{
                      backgroundColor: enabled
                        ? isDark
                          ? 'rgba(22,163,74,0.15)'
                          : '#dcfce7'
                        : isDark
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.05)',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: enabled ? (isDark ? '#4ade80' : '#16a34a') : palette.textSecondary,
                      }}
                    >
                      {enabled ? 'Enabled' : 'Disabled'}
                    </Text>
                  </View>
                </Pressable>
              )
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Logo Upload ──

function LogoUploadMobile({
  operator,
  onRefresh,
  palette,
  isDark,
  accent,
}: {
  operator: OperatorRef
  onRefresh: () => void
  palette: PaletteType
  isDark: boolean
  accent: string
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const API_BASE = getApiBaseUrl()

  const logoSrc = operator.logoUrl
    ? operator.logoUrl.startsWith('/uploads/')
      ? `${API_BASE}${operator.logoUrl}`
      : operator.logoUrl
    : null

  const pickAndUpload = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 1],
      quality: 0.8,
    })

    if (result.canceled || !result.assets?.[0]) return

    const asset = result.assets[0]
    setUploading(true)
    setError('')
    try {
      const uri = asset.uri
      const filename = uri.split('/').pop() || 'logo.jpg'
      const match = /\.(\w+)$/.exec(filename)
      const type = match ? `image/${match[1]}` : 'image/jpeg'

      const formData = new FormData()
      formData.append('logo', { uri, name: filename, type } as any)

      const token = tokenStorage.getAccessToken()
      const res = await fetch(`${API_BASE}/operators/${operator._id}/logo`, {
        method: 'POST',
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upload failed')
      }
      onRefresh()
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [operator._id, onRefresh])

  const handleRemove = useCallback(async () => {
    Alert.alert('Remove Logo', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setUploading(true)
          try {
            const token = tokenStorage.getAccessToken()
            await fetch(`${API_BASE}/operators/${operator._id}/logo`, {
              method: 'DELETE',
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            })
            onRefresh()
          } catch (err: any) {
            setError(err.message || 'Remove failed')
          } finally {
            setUploading(false)
          }
        },
      },
    ])
  }, [operator._id, onRefresh])

  return (
    <View>
      <Text
        style={{
          fontSize: 13,
          color: palette.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontWeight: '600',
          marginBottom: 10,
        }}
      >
        Airline Logo
      </Text>

      {/* Logo preview */}
      <View
        className="items-center justify-center rounded-xl mb-4"
        style={{
          height: 100,
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
        }}
      >
        {logoSrc ? (
          <Image source={{ uri: logoSrc }} style={{ width: '80%', height: '80%', resizeMode: 'contain' }} />
        ) : (
          <Building2 size={32} color={palette.textTertiary} strokeWidth={1.5} />
        )}
      </View>

      {/* Buttons */}
      <View className="flex-row" style={{ gap: 10 }}>
        <Pressable
          onPress={pickAndUpload}
          disabled={uploading}
          className="flex-1 items-center py-3 rounded-xl active:opacity-70"
          style={{ backgroundColor: accent, opacity: uploading ? 0.5 : 1 }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
            {uploading ? 'Uploading…' : logoSrc ? 'Change Logo' : 'Upload Logo'}
          </Text>
        </Pressable>

        {logoSrc && (
          <Pressable
            onPress={handleRemove}
            disabled={uploading}
            className="items-center py-3 px-5 rounded-xl active:opacity-70"
            style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? '#f87171' : '#dc2626' }}>Remove</Text>
          </Pressable>
        )}
      </View>

      {error !== '' && <Text style={{ fontSize: 13, color: '#dc2626', marginTop: 8 }}>{error}</Text>}
    </View>
  )
}

// ── Field ──

function Field({
  label,
  value,
  fieldKey,
  onChange,
  palette,
  required,
  hint,
  maxLength,
  uppercase,
}: {
  label: string
  value: any
  fieldKey: string
  onChange: (key: string, value: any) => void
  palette: PaletteType
  required?: boolean
  hint?: string
  maxLength?: number
  uppercase?: boolean
}) {
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
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
        {required && <Text style={{ color: '#ef4444' }}> *</Text>}
      </Text>
      <TextInput
        value={value != null ? String(value) : ''}
        maxLength={maxLength}
        onChangeText={(v) => {
          const val = uppercase ? v.toUpperCase() : v
          onChange(fieldKey, val || null)
        }}
        style={{
          fontSize: 15,
          fontWeight: '500',
          color: palette.text,
          borderBottomWidth: 1,
          borderBottomColor: accentTint('#1e40af', 0.3),
          paddingVertical: 4,
        }}
        placeholderTextColor={palette.textTertiary}
      />
      {hint && <Text style={{ fontSize: 13, color: palette.textTertiary, marginTop: 4 }}>{hint}</Text>}
    </View>
  )
}

// ── Select Field (pill-style segmented picker for short option lists) ──

function SelectField({
  label,
  value,
  options,
  onChange,
  palette,
  isDark,
  accent,
  hint,
  required,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (v: string) => void
  palette: PaletteType
  isDark: boolean
  accent: string
  hint?: string
  required?: boolean
}) {
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
      <Text
        style={{
          fontSize: 13,
          color: palette.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontWeight: '600',
          marginBottom: 8,
        }}
      >
        {label}
        {required && <Text style={{ color: '#ef4444' }}> *</Text>}
      </Text>
      <View className="flex-row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {options.map((opt) => {
          const active = value === opt.value
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              className="flex-row items-center rounded-lg px-3 py-2 active:opacity-70"
              style={{
                backgroundColor: active ? accentTint(accent, isDark ? 0.18 : 0.1) : 'transparent',
                borderWidth: 1,
                borderColor: active ? accent : palette.cardBorder,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: active ? '600' : '500',
                  color: active ? accent : palette.text,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      {hint && <Text style={{ fontSize: 13, color: palette.textTertiary, marginTop: 8 }}>{hint}</Text>}
    </View>
  )
}

// ── Airport Picker ──

function AirportPicker({
  label,
  value,
  onChange,
  palette,
  isDark,
  accent,
  required,
  hint,
}: {
  label: string
  value: string | null
  onChange: (v: string | null) => void
  palette: PaletteType
  isDark: boolean
  accent: string
  required?: boolean
  hint?: string
}) {
  const [airports, setAirports] = useState<AirportRef[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.getAirports().then(setAirports).catch(console.error)
  }, [])

  const selected = value ? airports.find((a) => a.icaoCode === value) : null
  const displayLabel = selected
    ? `${selected.iataCode ?? selected.icaoCode} — ${selected.name}`
    : (value ?? 'Select airport…')

  const q = search.toLowerCase()
  const filtered = q
    ? airports
        .filter(
          (a) =>
            a.iataCode?.toLowerCase().includes(q) ||
            a.icaoCode.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            a.city?.toLowerCase().includes(q),
        )
        .slice(0, 40)
    : airports.slice(0, 40)

  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
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
        {required && <Text style={{ color: '#ef4444' }}> *</Text>}
      </Text>
      <Pressable
        onPress={() => setModalOpen(true)}
        className="flex-row items-center justify-between py-1"
        style={{ borderBottomWidth: 1, borderBottomColor: accentTint('#1e40af', 0.3) }}
      >
        <Text style={{ fontSize: 15, fontWeight: '500', color: value ? palette.text : palette.textTertiary }}>
          {displayLabel}
        </Text>
        <ChevronDown size={16} color={palette.textTertiary} strokeWidth={1.8} />
      </Pressable>
      {hint && <Text style={{ fontSize: 13, color: palette.textTertiary, marginTop: 4 }}>{hint}</Text>}

      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }}>
          <View
            className="px-4 pt-3 pb-3 flex-row items-center justify-between"
            style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>Select Airport</Text>
            <Pressable
              onPress={() => {
                setModalOpen(false)
                setSearch('')
              }}
              className="active:opacity-60"
            >
              <X size={22} color={palette.textSecondary} strokeWidth={1.8} />
            </Pressable>
          </View>

          <View className="px-4 py-2" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
            <View
              className="flex-row items-center rounded-xl"
              style={{
                backgroundColor: palette.card,
                borderWidth: 1,
                borderColor: palette.cardBorder,
                paddingHorizontal: 13,
              }}
            >
              <Search size={16} color={palette.textTertiary} strokeWidth={1.8} />
              <TextInput
                className="flex-1 py-2.5 ml-2"
                style={{ fontSize: 15, color: palette.text }}
                placeholder="Search IATA, ICAO, name, city…"
                placeholderTextColor={palette.textTertiary}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
            </View>
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(a) => a._id}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item: a }) => {
              const isCurrent = a.icaoCode === value
              return (
                <Pressable
                  className="flex-row items-center active:opacity-70"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: palette.border,
                    backgroundColor: isCurrent ? accentTint(accent, isDark ? 0.08 : 0.04) : 'transparent',
                  }}
                  onPress={() => {
                    onChange(a.icaoCode)
                    setModalOpen(false)
                    setSearch('')
                  }}
                >
                  <Text
                    style={{ fontSize: 15, fontWeight: '700', color: isCurrent ? accent : palette.text, width: 44 }}
                  >
                    {a.iataCode ?? '—'}
                  </Text>
                  <View className="flex-1 ml-2">
                    <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>
                      {a.name}
                    </Text>
                    <Text style={{ fontSize: 13, color: palette.textSecondary, marginTop: 1 }}>
                      {a.city} · {a.icaoCode}
                    </Text>
                  </View>
                  {isCurrent && <Check size={18} color={accent} strokeWidth={2.5} />}
                </Pressable>
              )
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  )
}
