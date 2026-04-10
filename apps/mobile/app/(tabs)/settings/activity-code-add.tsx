import { useState, useEffect, useCallback } from 'react'
import { Text, View, ScrollView, Pressable, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type ActivityCodeGroupRef } from '@skyhub/api'
import { ChevronLeft, Tag } from 'lucide-react-native'
import { accentTint } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { useOperatorId } from '../../../hooks/useOperatorId'

export default function ActivityCodeAddScreen() {
  const router = useRouter()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const operatorId = useOperatorId()

  const [groups, setGroups] = useState<ActivityCodeGroupRef[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    groupId: '', code: '', name: '', description: '',
  })

  useEffect(() => {
    if (!operatorId) return
    api.getActivityCodeGroups(operatorId).then(g => {
      setGroups(g)
      if (g.length > 0 && !form.groupId) setForm(p => ({ ...p, groupId: g[0]._id }))
    }).catch(console.error)
  }, [operatorId])

  const handleCreate = useCallback(async () => {
    if (!form.code || !form.name) { setError('Code and name are required'); return }
    if (!form.groupId) { setError('Group is required'); return }
    setCreating(true); setError('')
    try {
      await api.createActivityCode({
        operatorId,
        groupId: form.groupId,
        code: form.code.toUpperCase().trim(),
        name: form.name.trim(),
        description: form.description || null,
        isActive: true,
      })
      router.back()
    } catch (err: any) {
      let msg = err.message || 'Failed'
      try { const m = msg.match(/API (\d+): (.+)/); if (m) { const p = JSON.parse(m[2]); msg = Number(m[1]) === 409 ? 'This activity code already exists.' : p.error || msg } } catch {}
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
          <Tag size={18} color={accent} strokeWidth={1.8} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Add Activity Code</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {/* Group picker */}
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 6 }}>Group *</Text>
        <View className="flex-row flex-wrap" style={{ gap: 6, marginBottom: 12 }}>
          {groups.map(g => {
            const active = form.groupId === g._id
            return (
              <Pressable key={g._id} onPress={() => setForm(p => ({ ...p, groupId: g._id }))}
                className="flex-row items-center px-2.5 py-1.5 rounded-lg"
                style={{ backgroundColor: active ? accentTint(g.color, isDark ? 0.15 : 0.08) : 'transparent', borderWidth: 1, borderColor: active ? g.color : palette.cardBorder, gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: g.color }} />
                <Text style={{ fontSize: 12, fontWeight: active ? '600' : '400', color: active ? g.color : palette.text }}>{g.name}</Text>
              </Pressable>
            )
          })}
        </View>

        {/* Code + Name */}
        <View className={isTablet ? 'flex-row' : ''} style={{ gap: 12, marginBottom: 12 }}>
          <FormField label="Code *" value={form.code} flex={isTablet ? 0.4 : 1}
            onChangeText={(v) => setForm(p => ({ ...p, code: v.toUpperCase() }))}
            palette={palette} mono maxLength={8} placeholder="e.g. FLT" />
          <FormField label="Name *" value={form.name} flex={1}
            onChangeText={(v) => setForm(p => ({ ...p, name: v }))}
            palette={palette} placeholder="e.g. Flight Duty" />
        </View>

        {/* Description */}
        <FormField label="Description" value={form.description} multiline
          onChangeText={(v) => setForm(p => ({ ...p, description: v }))}
          palette={palette} placeholder="Optional description..." />

        {/* Error */}
        {error ? (
          <View className="rounded-lg px-3 py-2 mt-3" style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}>
            <Text style={{ fontSize: 13, color: isDark ? '#f87171' : '#dc2626' }}>{error}</Text>
          </View>
        ) : null}

        {/* Create */}
        <Pressable onPress={handleCreate} disabled={creating}
          className="items-center py-3.5 rounded-xl mt-4 active:opacity-70"
          style={{ backgroundColor: accent, opacity: creating ? 0.5 : 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>{creating ? 'Creating...' : 'Add Activity Code'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function FormField({ label, value, onChangeText, palette, flex = 1, mono, maxLength, placeholder, multiline }: {
  label: string; value: string; onChangeText: (v: string) => void; palette: any; flex?: number;
  mono?: boolean; maxLength?: number; placeholder?: string; multiline?: boolean
}) {
  return (
    <View style={{ flex, marginBottom: 4 }}>
      <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} maxLength={maxLength}
        autoCapitalize={mono ? 'characters' : 'sentences'}
        placeholder={placeholder} placeholderTextColor={palette.textTertiary} multiline={multiline}
        style={{ fontSize: 15, fontWeight: '500', color: palette.text, fontFamily: mono ? 'monospace' : undefined,
          borderWidth: 1, borderColor: palette.cardBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
          backgroundColor: palette.card, minHeight: multiline ? 60 : undefined, textAlignVertical: multiline ? 'top' : undefined }} />
    </View>
  )
}
