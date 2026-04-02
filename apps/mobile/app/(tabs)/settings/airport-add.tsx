import { useState, useCallback, useEffect, useMemo } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, setApiBaseUrl, type AirportRef, type AirportLookupResult, type CountryRef } from '@skyhub/api'
import {
  ChevronLeft, Globe, Loader2, AlertCircle, ChevronDown, Check,
} from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'

setApiBaseUrl('http://192.168.1.101:3002')

export default function AirportAddScreen() {
  const router = useRouter()
  const { palette, isDark, accent } = useAppTheme()

  // Lookup state
  const [lookupCode, setLookupCode] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupResult, setLookupResult] = useState<AirportLookupResult | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // Manual form
  const [form, setForm] = useState({
    icaoCode: '', iataCode: '', name: '', city: '',
    countryId: '', timezone: '',
    latitude: '', longitude: '', elevationFt: '',
  })

  // Country picker
  const [countries, setCountries] = useState<CountryRef[]>([])
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')

  useEffect(() => {
    api.getCountries().then(setCountries).catch(console.error)
  }, [])

  const filteredCountries = useMemo(() => {
    const q = countrySearch.toLowerCase()
    const list = q ? countries.filter(c => c.name.toLowerCase().includes(q) || c.isoCode2.toLowerCase().includes(q)) : countries
    return list.slice(0, 50)
  }, [countries, countrySearch])

  const selectedCountry = countries.find(c => c._id === form.countryId)

  const friendlyError = useCallback((err: any) => {
    const msg = err.message || 'Failed'
    try {
      const match = msg.match(/API (\d+): (.+)/)
      if (match) {
        const parsed = JSON.parse(match[2])
        if (Number(match[1]) === 409) return 'This airport already exists in the database.'
        return parsed.error || parsed.details?.join(', ') || msg
      }
    } catch { /* use raw */ }
    return msg
  }, [])

  const handleLookup = useCallback(async () => {
    if (lookupCode.length < 3) return
    setLookupLoading(true); setError(''); setLookupResult(null); setNotFound(false)
    try {
      setLookupResult(await api.lookupAirport(lookupCode.trim()))
    } catch { setNotFound(true) }
    finally { setLookupLoading(false) }
  }, [lookupCode])

  const handleCreateFromLookup = useCallback(async () => {
    if (!lookupResult) return
    setCreating(true)
    try {
      await api.createAirport({
        icaoCode: lookupResult.icaoCode ?? undefined,
        iataCode: lookupResult.iataCode,
        name: lookupResult.name ?? 'Unknown',
        city: lookupResult.city,
        timezone: lookupResult.timezone ?? 'UTC',
        latitude: lookupResult.latitude,
        longitude: lookupResult.longitude,
        elevationFt: lookupResult.elevationFt,
        numberOfRunways: lookupResult.numberOfRunways,
        longestRunwayFt: lookupResult.longestRunwayFt,
        isActive: true,
      } as Partial<AirportRef>)
      router.back()
    } catch (err: any) { setError(friendlyError(err)) }
    finally { setCreating(false) }
  }, [lookupResult, router, friendlyError])

  const handleManualCreate = useCallback(async () => {
    if (!form.icaoCode || !form.name || !form.timezone) {
      setError('ICAO code, name, and timezone are required')
      return
    }
    setCreating(true); setError('')
    try {
      const country = countries.find(c => c._id === form.countryId)
      await api.createAirport({
        icaoCode: form.icaoCode.toUpperCase(),
        iataCode: form.iataCode ? form.iataCode.toUpperCase() : null,
        name: form.name,
        city: form.city || null,
        countryId: form.countryId || null,
        countryName: country?.name ?? null,
        countryIso2: country?.isoCode2 ?? null,
        countryFlag: country?.flagEmoji ?? null,
        timezone: form.timezone,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        elevationFt: form.elevationFt ? Number(form.elevationFt) : null,
        isActive: true,
      } as Partial<AirportRef>)
      router.back()
    } catch (err: any) { setError(friendlyError(err)) }
    finally { setCreating(false) }
  }, [form, countries, router, friendlyError])

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
          <ChevronLeft size={24} color={accent} strokeWidth={2} />
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Add Airport</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {!manualMode ? (
          <>
            {/* Lookup */}
            <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text, marginBottom: 8 }}>
              Lookup by ICAO Code
            </Text>
            <View className="flex-row" style={{ gap: 8 }}>
              <TextInput
                value={lookupCode}
                onChangeText={(v) => setLookupCode(v.toUpperCase())}
                onSubmitEditing={handleLookup}
                placeholder="e.g. VVTS"
                placeholderTextColor={palette.textTertiary}
                maxLength={4}
                autoCapitalize="characters"
                autoCorrect={false}
                style={{
                  flex: 1, fontSize: 15, fontFamily: 'monospace', fontWeight: '700',
                  color: palette.text, backgroundColor: palette.card,
                  borderWidth: 1, borderColor: palette.cardBorder,
                  borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
                }}
              />
              <Pressable onPress={handleLookup} disabled={lookupLoading || lookupCode.length < 3}
                className="flex-row items-center rounded-xl px-4 active:opacity-70"
                style={{ backgroundColor: '#0f766e', opacity: lookupCode.length < 3 ? 0.5 : 1, gap: 6 }}>
                {lookupLoading ? <Loader2 size={18} color="#fff" strokeWidth={2} /> : <Globe size={18} color="#fff" strokeWidth={1.8} />}
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Lookup</Text>
              </Pressable>
            </View>

            {/* Not found */}
            {notFound && (
              <View className="mt-4 rounded-xl p-4" style={{ backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : '#fffbeb', borderWidth: 1, borderColor: isDark ? 'rgba(245,158,11,0.2)' : '#fde68a' }}>
                <View className="flex-row items-start" style={{ gap: 10 }}>
                  <AlertCircle size={20} color={isDark ? '#fbbf24' : '#b45309'} strokeWidth={1.8} />
                  <View className="flex-1">
                    <Text style={{ fontSize: 15, fontWeight: '600', color: isDark ? '#fcd34d' : '#92400e' }}>
                      Could not locate airport {lookupCode}
                    </Text>
                    <Text style={{ fontSize: 15, color: isDark ? 'rgba(252,211,77,0.6)' : '#b4530999', marginTop: 4 }}>
                      This may be a new or unregistered airport. You can add it manually.
                    </Text>
                    <Pressable onPress={() => { setManualMode(true); setNotFound(false); setForm(p => ({ ...p, icaoCode: lookupCode })) }}
                      className="self-start mt-3 px-4 py-2 rounded-lg active:opacity-70"
                      style={{ backgroundColor: accent }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Proceed Adding Manually</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            {/* Lookup result */}
            {lookupResult && (
              <View className="mt-4 rounded-xl p-4" style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder }}>
                <View className="flex-row items-center justify-between mb-2">
                  <Text style={{ fontSize: 17, fontWeight: '700', color: palette.text }}>{lookupResult.name}</Text>
                  <View className="px-2 py-0.5 rounded" style={{ backgroundColor: palette.border }}>
                    <Text style={{ fontSize: 15, color: palette.textSecondary }}>{lookupResult.source}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 15, color: palette.textSecondary }}>
                  ICAO: {lookupResult.icaoCode} · IATA: {lookupResult.iataCode ?? '—'}
                </Text>
                <Text style={{ fontSize: 15, color: palette.textSecondary, marginTop: 2 }}>
                  {[lookupResult.city, lookupResult.country].filter(Boolean).join(' · ')}
                </Text>
                <Text style={{ fontSize: 15, color: palette.textSecondary, marginTop: 2 }}>
                  Timezone: {lookupResult.timezone} · Elev: {lookupResult.elevationFt ?? '—'} ft
                </Text>

                <Pressable onPress={handleCreateFromLookup} disabled={creating}
                  className="mt-4 py-3 rounded-xl items-center active:opacity-70"
                  style={{ backgroundColor: accent, opacity: creating ? 0.5 : 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                    {creating ? 'Creating…' : 'Add to Database'}
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        ) : (
          /* Manual form */
          <>
            <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text, marginBottom: 12 }}>Manual Entry</Text>

            <FormField label="ICAO Code *" value={form.icaoCode} palette={palette} mono
              onChange={(v) => setForm(p => ({ ...p, icaoCode: v.toUpperCase() }))} maxLength={4} />
            <FormField label="IATA Code" value={form.iataCode} palette={palette} mono
              onChange={(v) => setForm(p => ({ ...p, iataCode: v.toUpperCase() }))} maxLength={3} />
            <FormField label="Airport Name *" value={form.name} palette={palette}
              onChange={(v) => setForm(p => ({ ...p, name: v }))} />
            <FormField label="City" value={form.city} palette={palette}
              onChange={(v) => setForm(p => ({ ...p, city: v }))} />

            {/* Country picker */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 15, color: palette.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Country</Text>
              <Pressable onPress={() => setCountryPickerOpen(!countryPickerOpen)}
                className="flex-row items-center justify-between rounded-xl px-4 py-3"
                style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder }}>
                <Text style={{ fontSize: 15, color: selectedCountry ? palette.text : palette.textTertiary }}>
                  {selectedCountry ? `${selectedCountry.name} (${selectedCountry.isoCode2})` : 'Select country…'}
                </Text>
                <ChevronDown size={16} color={palette.textSecondary} strokeWidth={1.8} />
              </Pressable>
              {countryPickerOpen && (
                <View className="mt-1 rounded-xl overflow-hidden" style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder, maxHeight: 250 }}>
                  <TextInput
                    value={countrySearch} onChangeText={setCountrySearch}
                    placeholder="Search…" placeholderTextColor={palette.textTertiary}
                    style={{ fontSize: 15, color: palette.text, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}
                    autoFocus
                  />
                  <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                    {filteredCountries.map(c => (
                      <Pressable key={c._id}
                        onPress={() => { setForm(p => ({ ...p, countryId: c._id })); setCountryPickerOpen(false); setCountrySearch('') }}
                        className="flex-row items-center justify-between px-4 py-3 active:opacity-70"
                        style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
                        <Text style={{ fontSize: 15, color: palette.text }}>{c.name}</Text>
                        <Text style={{ fontSize: 15, fontFamily: 'monospace', color: palette.textSecondary }}>{c.isoCode2}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Timezone */}
            <FormField label="Timezone *" value={form.timezone} palette={palette}
              onChange={(v) => setForm(p => ({ ...p, timezone: v }))}
              placeholder="e.g. Asia/Ho_Chi_Minh" />

            <View className="flex-row" style={{ gap: 8 }}>
              <View style={{ flex: 1 }}>
                <FormField label="Latitude" value={form.latitude} palette={palette} numeric
                  onChange={(v) => setForm(p => ({ ...p, latitude: v }))} />
              </View>
              <View style={{ flex: 1 }}>
                <FormField label="Longitude" value={form.longitude} palette={palette} numeric
                  onChange={(v) => setForm(p => ({ ...p, longitude: v }))} />
              </View>
            </View>

            <FormField label="Elevation (ft)" value={form.elevationFt} palette={palette} numeric
              onChange={(v) => setForm(p => ({ ...p, elevationFt: v }))} />

            <Pressable onPress={handleManualCreate} disabled={creating}
              className="mt-4 py-3.5 rounded-xl items-center active:opacity-70"
              style={{ backgroundColor: accent, opacity: creating ? 0.5 : 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                {creating ? 'Creating…' : 'Add to Database'}
              </Text>
            </Pressable>
          </>
        )}

        {error ? (
          <View className="mt-3 rounded-xl p-3" style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.1)' : '#fef2f2', borderWidth: 1, borderColor: isDark ? 'rgba(220,38,38,0.2)' : '#fecaca' }}>
            <Text style={{ fontSize: 15, color: isDark ? '#f87171' : '#dc2626' }}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function FormField({ label, value, onChange, palette, mono, numeric, maxLength, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; palette: Palette;
  mono?: boolean; numeric?: boolean; maxLength?: number; placeholder?: string
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 15, color: palette.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChange} maxLength={maxLength}
        keyboardType={numeric ? 'numeric' : 'default'}
        placeholder={placeholder} placeholderTextColor={palette.textTertiary}
        autoCapitalize={mono ? 'characters' : 'sentences'} autoCorrect={false}
        style={{
          fontSize: 15, color: palette.text, fontFamily: mono ? 'monospace' : undefined,
          fontWeight: mono ? '700' : '500',
          backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder,
          borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
        }}
      />
    </View>
  )
}
