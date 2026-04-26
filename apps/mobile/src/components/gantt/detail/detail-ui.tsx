// Shared sub-components for Gantt detail tabs.

import { View, Text } from 'react-native'
import type { GanttFlight } from '@skyhub/types'

export function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.55)',
        marginBottom: 6,
      }}
    >
      {children}
    </Text>
  )
}

export function Row({
  label,
  value,
  palette,
  mono,
}: {
  label: string
  value: string
  palette: { text: string; textSecondary: string; border: string }
  mono?: boolean
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
      }}
    >
      <Text style={{ fontSize: 13, color: palette.textSecondary }}>{label}</Text>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '500',
          color: palette.text,
          fontFamily: mono ? 'monospace' : undefined,
        }}
      >
        {value}
      </Text>
    </View>
  )
}

export function StatRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: 10 }}>{children}</View>
}

export function StatTile({
  label,
  value,
  palette,
  accent,
}: {
  label: string
  value: string
  palette: { card: string; cardBorder: string; text: string; textSecondary: string }
  accent?: string
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: 12,
        borderRadius: 10,
        backgroundColor: palette.card,
        borderWidth: 1,
        borderColor: palette.cardBorder,
        gap: 4,
      }}
    >
      <Text style={{ fontSize: 13, color: palette.textSecondary, letterSpacing: 0.5 }}>{label.toUpperCase()}</Text>
      <Text
        style={{
          fontSize: 18,
          fontWeight: '700',
          color: accent ?? palette.text,
          fontFamily: 'monospace',
        }}
      >
        {value}
      </Text>
    </View>
  )
}

export function StatusPill({ flight, isDark }: { flight: GanttFlight; isDark: boolean }) {
  const { bg, fg, label } = statusStyle(flight, isDark)
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: bg,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '700', color: fg, letterSpacing: 0.5 }}>{label}</Text>
    </View>
  )
}

function statusStyle(f: GanttFlight, isDark: boolean): { bg: string; fg: string; label: string } {
  // All colors map to XD semantic palette (colors.status.*).
  if (f.ataUtc) return { bg: 'rgba(143,144,166,0.18)', fg: isDark ? '#8F90A6' : '#555770', label: 'COMPLETED' }
  if (f.atdUtc) return { bg: 'rgba(6,194,112,0.18)', fg: '#06C270', label: 'AIRBORNE' }
  if (f.status === 'cancelled') return { bg: 'rgba(255,59,59,0.18)', fg: '#FF3B3B', label: 'CANCELLED' }
  if (f.status === 'suspended') return { bg: 'rgba(143,144,166,0.18)', fg: '#8F90A6', label: 'SUSPENDED' }
  if (f.status === 'active' && f.aircraftReg) return { bg: 'rgba(6,194,112,0.18)', fg: '#06C270', label: 'ACTIVE' }
  if (f.status === 'active') return { bg: 'rgba(255,136,0,0.18)', fg: '#FF8800', label: 'UNASSIGNED' }
  return { bg: 'rgba(0,99,247,0.18)', fg: '#0063F7', label: f.status.toUpperCase() }
}
