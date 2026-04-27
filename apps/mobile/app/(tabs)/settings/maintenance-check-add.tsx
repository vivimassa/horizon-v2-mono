import { useState, useCallback } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api } from '@skyhub/api'
import { ChevronLeft, ClipboardCheck } from 'lucide-react-native'
import { Switch } from '@skyhub/ui'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { useOperatorId } from '../../../hooks/useOperatorId'

export default function MaintenanceCheckAddScreen() {
  const router = useRouter()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const operatorId = useOperatorId()

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [amosCode, setAmosCode] = useState('')
  const [hoursInterval, setHoursInterval] = useState('')
  const [cyclesInterval, setCyclesInterval] = useState('')
  const [daysInterval, setDaysInterval] = useState('')
  const [durationHours, setDurationHours] = useState('')
  const [defaultStation, setDefaultStation] = useState('')
  const [requiresGrounding, setRequiresGrounding] = useState(true)
  const [color, setColor] = useState('#3b82f6')

  const numOrNull = (v: string) => {
    const n = parseFloat(v)
    return isNaN(n) || n <= 0 ? null : n
  }
  const intOrNull = (v: string) => {
    const n = parseInt(v, 10)
    return isNaN(n) || n <= 0 ? null : n
  }

  const handleCreate = useCallback(async () => {
    if (!code.trim() || !name.trim()) {
      setError('Code and Name are required')
      return
    }
    setCreating(true)
    setError('')
    try {
      await api.createMaintenanceCheckType({
        operatorId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || null,
        amosCode: amosCode.trim() || null,
        defaultHoursInterval: numOrNull(hoursInterval),
        defaultCyclesInterval: intOrNull(cyclesInterval),
        defaultDaysInterval: intOrNull(daysInterval),
        defaultDurationHours: numOrNull(durationHours),
        defaultStation: defaultStation.trim().toUpperCase() || null,
        requiresGrounding,
        color,
        isActive: true,
        sortOrder: 0,
      } as any)
      router.back()
    } catch (err: any) {
      let msg = err.message || 'Failed'
      try {
        const match = msg.match(/API (\d+): (.+)/)
        if (match) {
          const parsed = JSON.parse(match[2])
          if (Number(match[1]) === 409) msg = 'This check code already exists.'
          else msg = parsed.error || msg
        }
      } catch {}
      setError(msg)
    } finally {
      setCreating(false)
    }
  }, [
    code,
    name,
    description,
    amosCode,
    hoursInterval,
    cyclesInterval,
    daysInterval,
    durationHours,
    defaultStation,
    requiresGrounding,
    color,
    operatorId,
    router,
  ])

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        {/* Header */}
        <View className="px-4 pt-2 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <View className="flex-row items-center">
            <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
              <ChevronLeft size={24} color={accent} strokeWidth={2} />
            </Pressable>
            <View
              className="items-center justify-center rounded-lg mr-3"
              style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}
            >
              <ClipboardCheck size={18} color={accent} strokeWidth={1.8} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Add Check Type</Text>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* General section */}
          <SectionLabel label="General" palette={palette} accent={accent} />

          <View className={isTablet ? 'flex-row' : ''} style={{ gap: 12, marginBottom: 12 }}>
            <Field
              label="Code *"
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              palette={palette}
              flex={isTablet ? 0.4 : 1}
              mono
              maxLength={10}
              placeholder="TR"
            />
            <Field
              label="Name *"
              value={name}
              onChangeText={setName}
              palette={palette}
              flex={1}
              placeholder="Transit Check"
            />
          </View>

          <View className={isTablet ? 'flex-row' : ''} style={{ gap: 12, marginBottom: 12 }}>
            <Field
              label="MRO Code"
              value={amosCode}
              onChangeText={setAmosCode}
              palette={palette}
              flex={isTablet ? 0.5 : 1}
              mono
              placeholder="AMOS code"
            />
            <Field
              label="Description"
              value={description}
              onChangeText={setDescription}
              palette={palette}
              flex={1}
              placeholder="Optional description"
            />
          </View>

          {/* Frequency thresholds */}
          <SectionLabel label="Frequency Thresholds" palette={palette} accent={accent} />
          <Text style={{ fontSize: 13, color: palette.textTertiary, marginBottom: 10 }}>
            Check is triggered when any threshold is reached - whichever comes first.
          </Text>

          <View className={isTablet ? 'flex-row' : ''} style={{ gap: 12, marginBottom: 12 }}>
            <Field
              label="Flight Hours"
              value={hoursInterval}
              onChangeText={setHoursInterval}
              palette={palette}
              flex={1}
              keyboardType="numeric"
              placeholder="--"
            />
            <Field
              label="Cycles"
              value={cyclesInterval}
              onChangeText={setCyclesInterval}
              palette={palette}
              flex={1}
              keyboardType="numeric"
              placeholder="--"
            />
            <Field
              label="Calendar Days"
              value={daysInterval}
              onChangeText={setDaysInterval}
              palette={palette}
              flex={1}
              keyboardType="numeric"
              placeholder="--"
            />
          </View>

          {/* Operational settings */}
          <SectionLabel label="Operational Settings" palette={palette} accent={accent} />

          <View className={isTablet ? 'flex-row' : ''} style={{ gap: 12, marginBottom: 12 }}>
            <Field
              label="Duration (hours)"
              value={durationHours}
              onChangeText={setDurationHours}
              palette={palette}
              flex={1}
              keyboardType="numeric"
              placeholder="24"
            />
            <Field
              label="Default Station"
              value={defaultStation}
              onChangeText={(v) => setDefaultStation(v.toUpperCase())}
              palette={palette}
              flex={1}
              mono
              maxLength={4}
              placeholder="VVTS"
            />
          </View>

          <View className="flex-row items-center mb-4" style={{ gap: 10 }}>
            <Switch value={requiresGrounding} onValueChange={setRequiresGrounding} />
            <Text style={{ fontSize: 15, color: palette.text }}>Requires Grounding</Text>
            <Text style={{ fontSize: 13, color: palette.textTertiary }}>
              {requiresGrounding ? '- aircraft grounded' : '- can stay in service'}
            </Text>
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

          {/* Submit */}
          <Pressable
            onPress={handleCreate}
            disabled={creating}
            className="items-center py-3.5 rounded-xl active:opacity-70"
            style={{ backgroundColor: accent, opacity: creating ? 0.5 : 1 }}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
              {creating ? 'Creating...' : 'Add Check Type'}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function SectionLabel({ label, palette, accent }: { label: string; palette: Palette; accent: string }) {
  return (
    <View className="flex-row items-center mb-3 mt-2" style={{ gap: 8 }}>
      <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accent }} />
      <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text }}>{label}</Text>
    </View>
  )
}

function Field({
  label,
  value,
  onChangeText,
  palette,
  flex = 1,
  mono,
  maxLength,
  placeholder,
  keyboardType,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  palette: Palette
  flex?: number
  mono?: boolean
  maxLength?: number
  placeholder?: string
  keyboardType?: 'numeric' | 'default'
}) {
  return (
    <View style={{ flex }}>
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
      <TextInput
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={palette.textTertiary}
        keyboardType={keyboardType}
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
        }}
      />
    </View>
  )
}
