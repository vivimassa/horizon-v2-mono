import { useState, useEffect, useCallback, useMemo } from 'react'
import { Text, View, ScrollView, Pressable, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type AircraftTypeRef } from '@skyhub/api'
import { ChevronLeft, Users, Search } from 'lucide-react-native'
import { accentTint } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { useOperatorId } from '../../../hooks/useOperatorId'

export default function CrewComplementAddScreen() {
  const router = useRouter()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const operatorId = useOperatorId()

  const [acTypes, setAcTypes] = useState<AircraftTypeRef[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [typeSearch, setTypeSearch] = useState('')
  const [form, setForm] = useState({ aircraftTypeIcao: '', templateKey: '' })

  useEffect(() => {
    api.getAircraftTypes().then(t => setAcTypes(t.filter(a => a.isActive))).catch(console.error)
  }, [])

  const filteredTypes = useMemo(() => {
    const q = typeSearch.toLowerCase().trim()
    const list = q ? acTypes.filter(t => t.icaoType.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)) : acTypes
    return list.slice(0, 30)
  }, [acTypes, typeSearch])

  const handleCreate = useCallback(async () => {
    if (!form.aircraftTypeIcao) { setError('Select an aircraft type'); return }
    if (!form.templateKey.trim()) { setError('Template key is required'); return }
    setCreating(true); setError('')
    try {
      await api.createCrewComplement({
        operatorId,
        aircraftTypeIcao: form.aircraftTypeIcao,
        templateKey: form.templateKey.toLowerCase().trim().replace(/\s+/g, '_'),
        counts: {},
      })
      router.back()
    } catch (err: any) {
      let msg = err.message || 'Failed'
      try { const m = msg.match(/API (\d+): (.+)/); if (m) { const p = JSON.parse(m[2]); msg = Number(m[1]) === 409 ? 'This template already exists for this aircraft type.' : p.error || msg } } catch {}
      setError(msg)
    } finally { setCreating(false) }
  }, [form, operatorId, router])

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      <View className="flex-row items-center px-4 pt-2 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
          <ChevronLeft size={24} color={accent} strokeWidth={2} />
        </Pressable>
        <View className="items-center justify-center rounded-lg mr-3"
          style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}>
          <Users size={18} color={accent} strokeWidth={1.8} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Add Crew Complement</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {/* Aircraft type picker */}
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 6 }}>Aircraft Type *</Text>
        <View className="flex-row items-center rounded-xl mb-2" style={{
          backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder, paddingHorizontal: 12,
        }}>
          <Search size={14} color={palette.textTertiary} strokeWidth={1.8} />
          <TextInput className="flex-1 py-2 ml-2" style={{ fontSize: 14, color: palette.text }}
            placeholder="Search aircraft types..." placeholderTextColor={palette.textTertiary}
            value={typeSearch} onChangeText={setTypeSearch} autoCapitalize="none" autoCorrect={false} />
        </View>
        <View className="flex-row flex-wrap" style={{ gap: 6, marginBottom: 16 }}>
          {filteredTypes.map(t => {
            const active = form.aircraftTypeIcao === t.icaoType
            return (
              <Pressable key={t._id} onPress={() => setForm(p => ({ ...p, aircraftTypeIcao: t.icaoType }))}
                className="px-3 py-2 rounded-lg"
                style={{ backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent', borderWidth: 1, borderColor: active ? accent : palette.cardBorder }}>
                <Text style={{ fontSize: 14, fontWeight: active ? '700' : '500', fontFamily: 'monospace', color: active ? accent : palette.text }}>{t.icaoType}</Text>
                <Text style={{ fontSize: 12, color: palette.textTertiary }}>{t.name}</Text>
              </Pressable>
            )
          })}
        </View>

        {/* Template key */}
        <View className={isTablet ? 'flex-row' : ''} style={{ gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>Template Key *</Text>
            <TextInput value={form.templateKey}
              onChangeText={(v) => setForm(p => ({ ...p, templateKey: v.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
              placeholder="e.g. long_haul" placeholderTextColor={palette.textTertiary}
              autoCapitalize="none"
              style={{ fontSize: 15, fontWeight: '500', fontFamily: 'monospace', color: palette.text,
                borderWidth: 1, borderColor: palette.cardBorder, borderRadius: 8,
                paddingHorizontal: 12, paddingVertical: 8, backgroundColor: palette.card }} />
          </View>
        </View>

        <Text style={{ fontSize: 13, color: palette.textTertiary, marginBottom: 16 }}>
          You can set crew counts after creating the template.
        </Text>

        {/* Error */}
        {error ? (
          <View className="rounded-lg px-3 py-2 mb-3" style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}>
            <Text style={{ fontSize: 13, color: isDark ? '#f87171' : '#dc2626' }}>{error}</Text>
          </View>
        ) : null}

        {/* Create */}
        <Pressable onPress={handleCreate} disabled={creating}
          className="items-center py-3.5 rounded-xl active:opacity-70"
          style={{ backgroundColor: accent, opacity: creating ? 0.5 : 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>{creating ? 'Creating...' : 'Add Complement'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}
