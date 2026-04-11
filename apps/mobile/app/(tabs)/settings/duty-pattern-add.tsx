import { useState, useCallback } from 'react'
import { Text, View, ScrollView, Pressable, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api } from '@skyhub/api'
import { ChevronLeft, Timer, Plus, Minus } from 'lucide-react-native'
import { accentTint } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { useOperatorId } from '../../../hooks/useOperatorId'

const ON_COLOR = '#06C270'
const OFF_COLOR = '#FF5C5C'
const OFF_CODES = ['DO', 'RDO', 'AO', 'LV', 'REST']

export default function DutyPatternAddScreen() {
  const router = useRouter()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const operatorId = useOperatorId()

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    code: '',
    description: '',
    offCode: 'DO',
    sequence: [5, 2] as number[],
  })

  const cycleDays = form.sequence.reduce((s, n) => s + n, 0)
  const onDays = form.sequence.filter((_, i) => i % 2 === 0).reduce((s, n) => s + n, 0)

  const handleCreate = useCallback(async () => {
    if (!form.code.trim()) {
      setError('Code is required')
      return
    }
    if (form.sequence.length < 2 || form.sequence.length % 2 !== 0) {
      setError('Sequence must have even number of segments (ON/OFF pairs)')
      return
    }
    if (form.sequence.some((n) => n < 1)) {
      setError('Each segment must be at least 1 day')
      return
    }
    setCreating(true)
    setError('')
    try {
      await api.createDutyPattern({
        operatorId,
        code: form.code.toUpperCase().trim(),
        description: form.description.trim() || null,
        sequence: form.sequence,
        offCode: form.offCode,
      })
      router.back()
    } catch (err: any) {
      let msg = err.message || 'Failed'
      try {
        const m = msg.match(/API (\d+): (.+)/)
        if (m) {
          const p = JSON.parse(m[2])
          msg = Number(m[1]) === 409 ? 'This pattern code already exists.' : p.error || msg
        }
      } catch {}
      setError(msg)
    } finally {
      setCreating(false)
    }
  }, [form, operatorId, router])

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
          <Timer size={18} color={accent} strokeWidth={1.8} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Add Duty Pattern</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Code + Description */}
        <View className={isTablet ? 'flex-row' : ''} style={{ gap: 12, marginBottom: 16 }}>
          <FormField
            label="Code *"
            value={form.code}
            flex={isTablet ? 0.4 : 1}
            onChangeText={(v) => setForm((p) => ({ ...p, code: v.toUpperCase() }))}
            palette={palette}
            mono
            maxLength={20}
            placeholder="e.g. 52"
          />
          <FormField
            label="Description"
            value={form.description}
            flex={1}
            onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
            palette={palette}
            placeholder="e.g. Standard 5-on 2-off"
          />
        </View>

        {/* Sequence editor */}
        <Text
          style={{
            fontSize: 12,
            color: palette.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            fontWeight: '600',
            marginBottom: 8,
          }}
        >
          Sequence ({cycleDays} days: {onDays} on, {cycleDays - onDays} off)
        </Text>
        <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
          {form.sequence.map((days, i) => (
            <View
              key={i}
              className="items-center rounded-lg p-2"
              style={{
                backgroundColor: i % 2 === 0 ? `${ON_COLOR}15` : `${OFF_COLOR}15`,
                borderWidth: 1,
                borderColor: i % 2 === 0 ? `${ON_COLOR}30` : `${OFF_COLOR}30`,
                minWidth: 56,
              }}
            >
              <Text
                style={{ fontSize: 11, fontWeight: '600', color: i % 2 === 0 ? ON_COLOR : OFF_COLOR, marginBottom: 4 }}
              >
                {i % 2 === 0 ? 'ON' : 'OFF'}
              </Text>
              <TextInput
                value={String(days)}
                keyboardType="numeric"
                textAlign="center"
                onChangeText={(v) => {
                  const n = parseInt(v, 10)
                  if (v === '' || (!isNaN(n) && n >= 1)) {
                    const next = [...form.sequence]
                    next[i] = v === '' ? 1 : n
                    setForm((p) => ({ ...p, sequence: next }))
                  }
                }}
                style={{
                  fontSize: 20,
                  fontWeight: '800',
                  fontFamily: 'monospace',
                  color: i % 2 === 0 ? ON_COLOR : OFF_COLOR,
                  width: 40,
                  borderBottomWidth: 1,
                  borderBottomColor: i % 2 === 0 ? ON_COLOR : OFF_COLOR,
                  paddingVertical: 2,
                }}
              />
            </View>
          ))}
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <Pressable
              onPress={() => setForm((p) => ({ ...p, sequence: [...p.sequence, 1, 1] }))}
              className="items-center justify-center rounded-lg active:opacity-60"
              style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}
            >
              <Plus size={16} color={accent} strokeWidth={2} />
            </Pressable>
            {form.sequence.length > 2 && (
              <Pressable
                onPress={() => setForm((p) => ({ ...p, sequence: p.sequence.slice(0, -2) }))}
                className="items-center justify-center rounded-lg active:opacity-60"
                style={{ width: 36, height: 36, backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}
              >
                <Minus size={16} color={isDark ? '#f87171' : '#dc2626'} strokeWidth={2} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Segment bar preview */}
        <View className="flex-row rounded-lg overflow-hidden mb-4" style={{ height: 10 }}>
          {form.sequence.map((days, i) => (
            <View
              key={i}
              style={{
                flex: days,
                backgroundColor: i % 2 === 0 ? ON_COLOR : OFF_COLOR,
                opacity: i % 2 === 0 ? 0.7 : 0.35,
              }}
            />
          ))}
        </View>

        {/* Off Code */}
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
          Off Code
        </Text>
        <View className="flex-row flex-wrap" style={{ gap: 6, marginBottom: 16 }}>
          {OFF_CODES.map((code) => {
            const active = form.offCode === code
            return (
              <Pressable
                key={code}
                onPress={() => setForm((p) => ({ ...p, offCode: code }))}
                className="px-3 py-2 rounded-lg"
                style={{
                  backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? accent : palette.cardBorder,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: active ? '600' : '400',
                    fontFamily: 'monospace',
                    color: active ? accent : palette.text,
                  }}
                >
                  {code}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {/* Error */}
        {error ? (
          <View
            className="rounded-lg px-3 py-2 mb-3"
            style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}
          >
            <Text style={{ fontSize: 13, color: isDark ? '#f87171' : '#dc2626' }}>{error}</Text>
          </View>
        ) : null}

        {/* Create */}
        <Pressable
          onPress={handleCreate}
          disabled={creating}
          className="items-center py-3.5 rounded-xl active:opacity-70"
          style={{ backgroundColor: accent, opacity: creating ? 0.5 : 1 }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
            {creating ? 'Creating...' : 'Add Pattern'}
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
  maxLength,
  placeholder,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  palette: any
  flex?: number
  mono?: boolean
  maxLength?: number
  placeholder?: string
}) {
  return (
    <View style={{ flex, marginBottom: 4 }}>
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
        maxLength={maxLength}
        autoCapitalize={mono ? 'characters' : 'sentences'}
        placeholder={placeholder}
        placeholderTextColor={palette.textTertiary}
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
      />
    </View>
  )
}
