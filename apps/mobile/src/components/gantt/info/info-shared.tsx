// Shared bits for info tabs.

import { View, Text, TextInput } from 'react-native'
import { SectionHeader } from '@skyhub/ui'

export function InfoSection({
  title,
  palette,
  children,
}: {
  title: string
  palette: { textSecondary: string }
  children: React.ReactNode
}) {
  void palette // SectionHeader reads palette from useTheme
  return (
    <View style={{ marginBottom: 18 }}>
      <SectionHeader title={title} />
      {children}
    </View>
  )
}

export function InfoRow({
  label,
  value,
  palette,
  mono,
}: {
  label: string
  value: string | number | null | undefined
  palette: { text: string; textSecondary: string; border: string }
  mono?: boolean
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 7,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
      }}
    >
      <Text style={{ fontSize: 13, color: palette.textSecondary }}>{label}</Text>
      <Text
        style={{ fontSize: 13, fontWeight: '600', color: palette.text, fontFamily: mono ? 'monospace' : undefined }}
      >
        {value == null || value === '' ? '—' : String(value)}
      </Text>
    </View>
  )
}

export function InfoEditField({
  label,
  value,
  onChange,
  placeholder,
  palette,
  mono,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  palette: { text: string; textSecondary: string; cardBorder: string; background: string; textTertiary: string }
  mono?: boolean
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: palette.textSecondary, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={palette.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          height: 40,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: palette.cardBorder,
          backgroundColor: palette.background,
          paddingHorizontal: 10,
          fontSize: 14,
          color: palette.text,
          fontFamily: mono ? 'monospace' : undefined,
        }}
      />
    </View>
  )
}

export function fmtUtcDateTime(ms: number | null | undefined): string {
  if (ms == null) return ''
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}Z`
}

export function fmtHHMM(ms: number | null | undefined): string {
  if (ms == null) return ''
  const d = new Date(ms)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}
