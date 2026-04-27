/**
 * iOS-style toggle switch (cross-platform).
 *
 * Renders a green pill + white knob on both iOS and Android (does NOT fall
 * back to Android's Material switch). Matches the web `ToggleSwitch` so the
 * mobile and desktop apps share the exact same visual language.
 *
 * Compatible with the gluestack `Switch` API (`value` / `onValueChange`)
 * but accepts the simpler `checked` / `onChange` form too. Pass `accent` to
 * override the default iOS green; pass `danger` for an orange destructive
 * track.
 */
import React from 'react'
import { Pressable, View, type ViewStyle } from 'react-native'

export type ToggleSwitchSize = 'sm' | 'md' | 'lg'

interface SwitchProps {
  value?: boolean
  checked?: boolean
  onValueChange?: (next: boolean) => void
  onChange?: (next: boolean) => void
  size?: ToggleSwitchSize
  accent?: string
  danger?: boolean
  disabled?: boolean
  className?: string
  trackColor?: { false?: string; true?: string }
  thumbColor?: string
  accessibilityLabel?: string
}

const SIZES: Record<ToggleSwitchSize, { w: number; h: number; thumb: number; pad: number }> = {
  sm: { w: 36, h: 20, thumb: 16, pad: 2 },
  md: { w: 50, h: 30, thumb: 26, pad: 2 },
  lg: { w: 56, h: 32, thumb: 28, pad: 2 },
}

const IOS_GREEN = '#34C759'
const DANGER_ORANGE = '#FF8800'
const OFF_TRACK = 'rgba(120,120,128,0.32)'

export function Switch({
  value,
  checked,
  onValueChange,
  onChange,
  size = 'md',
  accent,
  danger,
  disabled,
  trackColor,
  thumbColor,
  accessibilityLabel,
}: SwitchProps) {
  const on = value ?? checked ?? false
  const handle = (next: boolean) => {
    if (disabled) return
    onValueChange?.(next)
    onChange?.(next)
  }

  const { w, h, thumb, pad } = SIZES[size]
  const travel = w - thumb - pad * 2
  const onColor = trackColor?.true ?? (danger ? DANGER_ORANGE : (accent ?? IOS_GREEN))
  const offColor = trackColor?.false ?? OFF_TRACK
  const knobColor = thumbColor ?? '#FFFFFF'

  const trackStyle: ViewStyle = {
    width: w,
    height: h,
    borderRadius: h / 2,
    backgroundColor: on ? onColor : offColor,
    opacity: disabled ? 0.5 : 1,
    justifyContent: 'center',
  }

  const thumbStyle: ViewStyle = {
    position: 'absolute',
    left: pad,
    top: pad,
    width: thumb,
    height: thumb,
    borderRadius: thumb / 2,
    backgroundColor: knobColor,
    transform: [{ translateX: on ? travel : 0 }],
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  }

  return (
    <Pressable
      onPress={() => handle(!on)}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      style={trackStyle}
    >
      <View style={thumbStyle} />
    </Pressable>
  )
}

/** Alias so cross-platform code can import the same name as web. */
export const ToggleSwitch = Switch
