// Optimizer step 1 — pick objective + preset.

import { View, Text, Pressable } from 'react-native'
import { Sparkles, Activity, Clock, Wrench } from 'lucide-react-native'
import { Icon, type LucideIcon } from '@skyhub/ui'
import type { OptimizerMethod, OptimizerPreset } from '@skyhub/logic'
import { FieldLabel } from '../dialog-shell'

const METHODS: {
  value: OptimizerMethod
  label: string
  hint: string
  icon: LucideIcon
}[] = [
  { value: 'minimize', label: 'Minimize Gaps', hint: 'Tight rotations, strict station continuity', icon: Clock },
  { value: 'balance', label: 'Balance Fleet', hint: 'Even utilisation across aircraft', icon: Activity },
  { value: 'fuel', label: 'Fuel Efficient', hint: 'Lowest fuel burn — may break chains', icon: Sparkles },
]

const PRESETS: { value: OptimizerPreset; label: string; budget: string }[] = [
  { value: 'quick', label: 'Quick', budget: '5s' },
  { value: 'normal', label: 'Normal', budget: '15s' },
  { value: 'deep', label: 'Deep', budget: '30s' },
]

export { METHODS as OPTIMIZER_METHODS, PRESETS as OPTIMIZER_PRESETS, Wrench }

export function ConfigPane({
  method,
  setMethod,
  preset,
  setPreset,
  palette,
  accent,
  isDark,
  flightCount,
  acCount,
}: {
  method: OptimizerMethod
  setMethod: (m: OptimizerMethod) => void
  preset: OptimizerPreset
  setPreset: (p: OptimizerPreset) => void
  palette: { text: string; textSecondary: string; textTertiary: string; cardBorder: string }
  accent: string
  isDark: boolean
  flightCount: number
  acCount: number
}) {
  return (
    <>
      <Text style={{ fontSize: 13, color: palette.textSecondary, marginBottom: 16 }}>
        Optimizer reassigns {flightCount} flights across {acCount} aircraft. Phase 1 runs greedy in milliseconds; Phase
        2 refines via simulated annealing.
      </Text>
      <FieldLabel label="OBJECTIVE" palette={palette} />
      <View style={{ flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {METHODS.map((m) => {
          const active = m.value === method
          const MethodIcon = m.icon
          return (
            <Pressable
              key={m.value}
              onPress={() => setMethod(m.value)}
              style={{
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: active ? accent : palette.cardBorder,
                backgroundColor: active ? (isDark ? 'rgba(62,123,250,0.15)' : 'rgba(62,123,250,0.10)') : 'transparent',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Icon icon={MethodIcon} size="md" color={active ? accent : palette.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: active ? accent : palette.text }}>
                  {m.label}
                </Text>
                <Text style={{ fontSize: 13, color: palette.textTertiary, marginTop: 2 }}>{m.hint}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>

      <FieldLabel label="PRESET" palette={palette} />
      <View
        style={{
          flexDirection: 'row',
          borderRadius: 8,
          borderWidth: 1,
          borderColor: palette.cardBorder,
          overflow: 'hidden',
        }}
      >
        {PRESETS.map((p, i) => {
          const active = p.value === preset
          return (
            <Pressable
              key={p.value}
              onPress={() => setPreset(p.value)}
              style={{
                flex: 1,
                paddingVertical: 12,
                alignItems: 'center',
                backgroundColor: active ? (isDark ? 'rgba(62,123,250,0.15)' : 'rgba(62,123,250,0.10)') : 'transparent',
                borderLeftWidth: i === 0 ? 0 : 1,
                borderLeftColor: palette.cardBorder,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: active ? accent : palette.text }}>{p.label}</Text>
              <Text style={{ fontSize: 13, color: palette.textTertiary, marginTop: 2 }}>{p.budget}</Text>
            </Pressable>
          )
        })}
      </View>
    </>
  )
}
