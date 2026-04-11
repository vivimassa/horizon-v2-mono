// SkyHub — FieldRow
// Label + value row with view/edit modes. Union of the three detail-screen
// Field() helpers from airport-detail, carrier-code-detail, activity-code-detail.
//
// View mode: uppercase label above, value below (or inline).
// Edit mode: label above, input/toggle/picker below.
import React from 'react'
import { View, Pressable, TextInput as RNTextInput } from 'react-native'
import { useTheme } from '../hooks/useTheme'
import { accentTint } from '../theme/colors'
import { Text } from './Text'

const GREEN = '#06C270'
const GREEN_BG = 'rgba(6,194,112,0.12)'
const RED = '#E63535'
const RED_BG = 'rgba(255,59,59,0.12)'

export type FieldRowType = 'text' | 'number' | 'toggle' | 'select' | 'time-hhmm' | 'multiline' | 'readonly'

export interface FieldRowOption {
  label: string
  value: string
  color?: string
}

type FieldRowValue = string | number | boolean | null | undefined

interface FieldRowProps {
  label: string
  value?: FieldRowValue
  editing?: boolean
  editValue?: FieldRowValue
  onChangeValue?: (value: FieldRowValue) => void
  type?: FieldRowType
  options?: FieldRowOption[]
  mono?: boolean
  maxLength?: number
  placeholder?: string
  /** 50% width — used inside half-width rows */
  half?: boolean
  suffix?: string
  icon?: React.ReactNode
}

export function FieldRow({
  label,
  value,
  editing = false,
  editValue,
  onChangeValue,
  type = 'text',
  options,
  mono = false,
  maxLength,
  placeholder,
  half = false,
  suffix,
  icon,
}: FieldRowProps) {
  const { palette, accentColor, isDark } = useTheme()
  const width = half ? '50%' : '100%'
  const rowStyle = { width, paddingRight: half ? 12 : 0, paddingVertical: 8 } as const

  // Edit mode: toggle
  if (editing && type === 'toggle') {
    const on = Boolean(editValue)
    return (
      <View style={rowStyle}>
        <Text variant="fieldLabel" muted>
          {label}
        </Text>
        <Pressable
          onPress={() => onChangeValue?.(!on)}
          accessibilityRole="switch"
          accessibilityState={{ checked: on }}
          style={{
            alignSelf: 'flex-start',
            marginTop: 6,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: on ? GREEN_BG : RED_BG,
          }}
        >
          <Text variant="cardTitle" color={on ? GREEN : RED} style={{ fontWeight: '600' }}>
            {on ? 'Yes' : 'No'}
          </Text>
        </Pressable>
      </View>
    )
  }

  // Edit mode: select/picker
  if (editing && type === 'select' && options) {
    return (
      <View style={rowStyle}>
        <Text variant="fieldLabel" muted>
          {label}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {options.map((opt) => {
            const active = String(editValue ?? '') === opt.value
            return (
              <Pressable
                key={opt.value}
                onPress={() => onChangeValue?.(opt.value)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: active ? accentColor : palette.cardBorder,
                  backgroundColor: active ? accentTint(accentColor, 0.1) : 'transparent',
                }}
              >
                {opt.color ? (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: opt.color,
                    }}
                  />
                ) : null}
                <Text
                  variant="cardTitle"
                  color={active ? accentColor : palette.text}
                  style={{ fontWeight: active ? '600' : '500' }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    )
  }

  // Edit mode: text / number / multiline / time-hhmm
  if (editing && type !== 'readonly') {
    const isNumber = type === 'number'
    const isTime = type === 'time-hhmm'
    const isMultiline = type === 'multiline'
    const displayValue =
      editValue === null || editValue === undefined
        ? ''
        : isTime && typeof editValue === 'number'
          ? minutesToHHMM(editValue)
          : String(editValue)

    return (
      <View style={rowStyle}>
        <Text variant="fieldLabel" muted>
          {label}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 4,
            borderBottomWidth: 1,
            borderBottomColor: accentTint(accentColor, isDark ? 0.4 : 0.3),
          }}
        >
          {icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}
          <RNTextInput
            value={displayValue}
            onChangeText={(raw) => {
              if (isNumber) {
                onChangeValue?.(raw === '' ? null : Number(raw))
              } else if (isTime) {
                onChangeValue?.(raw === '' ? null : hhmmToMinutes(raw))
              } else {
                onChangeValue?.(raw)
              }
            }}
            placeholder={placeholder ?? (isTime ? 'H:MM' : undefined)}
            placeholderTextColor={palette.textTertiary}
            keyboardType={isNumber ? 'numeric' : 'default'}
            multiline={isMultiline}
            maxLength={maxLength}
            style={{
              flex: 1,
              fontSize: 14,
              fontWeight: '500',
              color: palette.text,
              fontFamily: mono || isTime ? 'monospace' : undefined,
              paddingVertical: 6,
              minHeight: isMultiline ? 60 : undefined,
              textAlignVertical: isMultiline ? 'top' : 'center',
            }}
          />
          {suffix ? (
            <Text variant="secondary" muted style={{ marginLeft: 6 }}>
              {suffix}
            </Text>
          ) : null}
        </View>
      </View>
    )
  }

  // View mode
  const display = renderDisplayValue(value, type, options)
  const displayColor = type === 'toggle' ? (value ? GREEN : palette.textSecondary) : palette.text

  return (
    <View style={rowStyle}>
      <Text variant="fieldLabel" muted>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 4,
          gap: 6,
        }}
      >
        {icon}
        <Text
          variant="body"
          color={displayColor}
          style={{
            fontWeight: '500',
            fontFamily: mono ? 'monospace' : undefined,
            flex: 1,
          }}
        >
          {display}
        </Text>
        {suffix && display !== '—' ? (
          <Text variant="secondary" muted>
            {suffix}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

function renderDisplayValue(value: FieldRowValue, type: FieldRowType, options?: FieldRowOption[]): string {
  if (value === null || value === undefined || value === '') return '—'
  if (type === 'toggle') return value ? 'Yes' : 'No'
  if (type === 'time-hhmm' && typeof value === 'number') {
    return minutesToHHMM(value)
  }
  if (type === 'select' && options) {
    const match = options.find((o) => o.value === String(value))
    return match?.label ?? String(value)
  }
  return String(value)
}

function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function hhmmToMinutes(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (trimmed.includes(':')) {
    const [hStr, mStr] = trimmed.split(':')
    const h = parseInt(hStr ?? '0', 10)
    const m = parseInt(mStr ?? '0', 10)
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    return h * 60 + m
  }
  const n = parseInt(trimmed, 10)
  return Number.isNaN(n) ? null : n
}
