import { memo } from 'react'
import { Text, View, Pressable } from 'react-native'
import type { Palette } from '@skyhub/ui/theme'

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const
const DAY_NUMS = ['1', '2', '3', '4', '5', '6', '7'] as const

export const FrequencyPicker = memo(function FrequencyPicker({
  value, onChange, palette, accent, disabled,
}: {
  value: string; onChange: (v: string) => void; palette: Palette; accent: string; disabled?: boolean
}) {
  const toggle = (dayNum: string) => {
    if (disabled) return
    const has = value.includes(dayNum)
    const next = has ? value.replace(dayNum, '') : (value + dayNum).split('').sort().join('')
    onChange(next)
  }

  return (
    <View className="flex-row" style={{ gap: 4 }}>
      {DAYS.map((label, i) => {
        const active = value.includes(DAY_NUMS[i])
        return (
          <Pressable key={i} onPress={() => toggle(DAY_NUMS[i])} disabled={disabled}
            className="items-center justify-center rounded"
            style={{
              width: 30, height: 30,
              backgroundColor: active ? accent : 'transparent',
              borderWidth: 1, borderColor: active ? accent : palette.cardBorder,
              opacity: disabled ? 0.5 : 1,
            }}>
            <Text style={{ fontSize: 12, fontWeight: active ? '700' : '400', color: active ? '#fff' : palette.textSecondary }}>
              {label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
})

/** Display-only frequency dots */
export const FrequencyDots = memo(function FrequencyDots({
  value, accent, palette, size = 18,
}: {
  value: string; accent: string; palette: Palette; size?: number
}) {
  return (
    <View className="flex-row" style={{ gap: 2 }}>
      {DAYS.map((label, i) => {
        const active = value.includes(DAY_NUMS[i])
        return (
          <View key={i} className="items-center justify-center"
            style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: active ? accent : 'transparent' }}>
            <Text style={{ fontSize: size * 0.55, fontWeight: '600', color: active ? '#fff' : palette.textTertiary }}>
              {label}
            </Text>
          </View>
        )
      })}
    </View>
  )
})
