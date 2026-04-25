// Shared sub-components for Gantt detail tabs.

import { View, Text } from 'react-native'
import type { GanttFlight } from '@skyhub/types'

export function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontSize: 12,
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
      <Text style={{ fontSize: 11, color: palette.textSecondary, letterSpacing: 0.5 }}>{label.toUpperCase()}</Text>
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
      <Text style={{ fontSize: 11, fontWeight: '700', color: fg, letterSpacing: 0.5 }}>{label}</Text>
    </View>
  )
}

function statusStyle(f: GanttFlight, isDark: boolean): { bg: string; fg: string; label: string } {
  if (f.ataUtc) return { bg: 'rgba(107,114,128,0.18)', fg: isDark ? '#d1d5db' : '#374151', label: 'COMPLETED' }
  if (f.atdUtc) return { bg: 'rgba(34,197,94,0.18)', fg: '#16a34a', label: 'AIRBORNE' }
  if (f.status === 'cancelled') return { bg: 'rgba(220,38,38,0.18)', fg: '#dc2626', label: 'CANCELLED' }
  if (f.status === 'suspended') return { bg: 'rgba(143,144,166,0.18)', fg: '#8F90A6', label: 'SUSPENDED' }
  if (f.status === 'active' && f.aircraftReg) return { bg: 'rgba(22,163,74,0.18)', fg: '#16a34a', label: 'ACTIVE' }
  if (f.status === 'active') return { bg: 'rgba(217,119,6,0.18)', fg: '#d97706', label: 'UNASSIGNED' }
  return { bg: 'rgba(37,99,235,0.18)', fg: '#2563eb', label: f.status.toUpperCase() }
}
