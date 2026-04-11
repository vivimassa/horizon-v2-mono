import { useState, useCallback, useEffect, useMemo } from 'react'
import { Text, View, ScrollView, Pressable, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type AircraftTypeRef } from '@skyhub/api'
import { ChevronLeft, PlaneTakeoff, ChevronDown, Search, Check } from 'lucide-react-native'
import { accentTint } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useOperatorId } from '../../../hooks/useOperatorId'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'stored', label: 'Stored' },
  { value: 'retired', label: 'Retired' },
]

export default function AircraftRegistrationAddScreen() {
  const router = useRouter()
  const { palette, isDark, accent } = useAppTheme()
  const operatorId = useOperatorId()
  const [acTypes, setAcTypes] = useState<AircraftTypeRef[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const [typePickerOpen, setTypePickerOpen] = useState(false)
  const [typeSearch, setTypeSearch] = useState('')

  const [form, setForm] = useState({
    registration: '',
    aircraftTypeId: '',
    serialNumber: '',
    variant: '',
    status: 'active',
    homeBaseIcao: '',
  })

  useEffect(() => {
    api.getAircraftTypes().then(setAcTypes).catch(console.error)
  }, [])

  const filteredTypes = useMemo(() => {
    const q = typeSearch.toLowerCase()
    return (
      q ? acTypes.filter((t) => t.icaoType.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)) : acTypes
    ).slice(0, 30)
  }, [acTypes, typeSearch])

  const selectedType = acTypes.find((t) => t._id === form.aircraftTypeId)

  const handleCreate = useCallback(async () => {
    if (!form.registration || !form.aircraftTypeId) {
      setError('Registration and aircraft type are required')
      return
    }
    setCreating(true)
    setError('')
    try {
      await api.createAircraftRegistration({
        operatorId,
        registration: form.registration.toUpperCase(),
        aircraftTypeId: form.aircraftTypeId,
        serialNumber: form.serialNumber || null,
        variant: form.variant || null,
        status: form.status,
        homeBaseIcao: form.homeBaseIcao?.toUpperCase() || null,
        isActive: true,
      })
      router.back()
    } catch (err: any) {
      let msg = err.message || 'Failed'
      try {
        const m = msg.match(/API (\d+): (.+)/)
        if (m) {
          const p = JSON.parse(m[2])
          msg = Number(m[1]) === 409 ? 'This registration already exists.' : p.error || msg
        }
      } catch {}
      setError(msg)
    } finally {
      setCreating(false)
    }
  }, [form, router])

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      <View
        className="flex-row items-center px-4 pt-2 pb-3"
        style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}
      >
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
          <ChevronLeft size={24} color={accent} strokeWidth={2} />
        </Pressable>
        <View
          className="items-center justify-center rounded-lg mr-3"
          style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}
        >
          <PlaneTakeoff size={18} color={accent} strokeWidth={1.8} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Add Aircraft</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Registration */}
        <View className="flex-row" style={{ gap: 12, marginBottom: 12 }}>
          <FormField
            label="Registration *"
            value={form.registration}
            flex={0.5}
            onChangeText={(v) => setForm((p) => ({ ...p, registration: v.toUpperCase() }))}
            palette={palette}
            mono
          />
          <FormField
            label="Serial Number"
            value={form.serialNumber}
            flex={0.5}
            onChangeText={(v) => setForm((p) => ({ ...p, serialNumber: v }))}
            palette={palette}
            mono
          />
        </View>

        {/* Aircraft Type picker */}
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
          Aircraft Type *
        </Text>
        <Pressable
          onPress={() => setTypePickerOpen(!typePickerOpen)}
          className="flex-row items-center rounded-xl mb-1"
          style={{
            borderWidth: 1,
            borderColor: palette.cardBorder,
            backgroundColor: palette.card,
            paddingHorizontal: 12,
            paddingVertical: 10,
            gap: 8,
          }}
        >
          {selectedType ? (
            <>
              <Text style={{ fontSize: 14, fontWeight: '700', fontFamily: 'monospace', color: accent }}>
                {selectedType.icaoType}
              </Text>
              <Text style={{ fontSize: 13, color: palette.textSecondary, flex: 1 }} numberOfLines={1}>
                {selectedType.name}
              </Text>
            </>
          ) : (
            <Text style={{ fontSize: 14, color: palette.textTertiary, flex: 1 }}>Select aircraft type...</Text>
          )}
          <ChevronDown
            size={16}
            color={palette.textTertiary}
            strokeWidth={1.8}
            style={{ transform: [{ rotate: typePickerOpen ? '180deg' : '0deg' }] }}
          />
        </Pressable>

        {typePickerOpen && (
          <View
            className="rounded-xl mb-3"
            style={{
              borderWidth: 1,
              borderColor: palette.cardBorder,
              backgroundColor: palette.card,
              maxHeight: 200,
              overflow: 'hidden',
            }}
          >
            <View
              className="flex-row items-center px-3"
              style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}
            >
              <Search size={14} color={palette.textTertiary} strokeWidth={1.8} />
              <TextInput
                value={typeSearch}
                onChangeText={setTypeSearch}
                placeholder="Search types..."
                placeholderTextColor={palette.textTertiary}
                style={{ fontSize: 13, color: palette.text, flex: 1, paddingVertical: 8, marginLeft: 8 }}
                autoCapitalize="none"
              />
            </View>
            <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
              {filteredTypes.map((t) => (
                <Pressable
                  key={t._id}
                  onPress={() => {
                    setForm((p) => ({ ...p, aircraftTypeId: t._id }))
                    setTypePickerOpen(false)
                    setTypeSearch('')
                  }}
                  className="flex-row items-center px-3 py-2.5 active:opacity-70"
                  style={{ borderBottomWidth: 1, borderBottomColor: palette.border, gap: 8 }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', fontFamily: 'monospace', color: accent, width: 40 }}>
                    {t.icaoType}
                  </Text>
                  <Text style={{ fontSize: 13, color: palette.text, flex: 1 }} numberOfLines={1}>
                    {t.name}
                  </Text>
                  {form.aircraftTypeId === t._id && <Check size={14} color={accent} strokeWidth={2.5} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Variant + Home Base */}
        <View className="flex-row" style={{ gap: 12, marginBottom: 12 }}>
          <FormField
            label="Variant"
            value={form.variant}
            flex={1}
            onChangeText={(v) => setForm((p) => ({ ...p, variant: v }))}
            palette={palette}
          />
          <FormField
            label="Home Base (ICAO)"
            value={form.homeBaseIcao}
            flex={1}
            onChangeText={(v) => setForm((p) => ({ ...p, homeBaseIcao: v.toUpperCase() }))}
            palette={palette}
            mono
          />
        </View>

        {/* Status */}
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
          Status
        </Text>
        <View className="flex-row flex-wrap" style={{ gap: 6, marginBottom: 16 }}>
          {STATUS_OPTIONS.map((s) => {
            const active = form.status === s.value
            return (
              <Pressable
                key={s.value}
                onPress={() => setForm((p) => ({ ...p, status: s.value }))}
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
                  {s.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {error ? (
          <View
            className="rounded-lg px-3 py-2 mb-3"
            style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}
          >
            <Text style={{ fontSize: 13, color: isDark ? '#f87171' : '#dc2626' }}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleCreate}
          disabled={creating}
          className="items-center py-3.5 rounded-xl active:opacity-70"
          style={{ backgroundColor: accent, opacity: creating ? 0.5 : 1 }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
            {creating ? 'Creating...' : 'Add Aircraft'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function FormField({
  label,
  value,
  onChangeText,
  palette,
  flex = 1,
  mono,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  palette: any
  flex?: number
  mono?: boolean
}) {
  return (
    <View style={{ flex }}>
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
        value={value}
        onChangeText={onChangeText}
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
          paddingVertical: 8,
          backgroundColor: palette.card,
        }}
        placeholderTextColor={palette.textTertiary}
      />
    </View>
  )
}
