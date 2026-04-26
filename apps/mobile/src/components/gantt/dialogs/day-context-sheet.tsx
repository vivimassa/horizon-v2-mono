// Day long-press context. Cancel all this day / Bulk reassign by type.

import { useMemo, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { Ban, ArrowLeftRight, Eye } from 'lucide-react-native'
import { Icon } from '@skyhub/ui'
import { useMobileGanttStore } from '../../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { DialogShell } from './dialog-shell'

export function DayContextSheet() {
  const { palette, accent } = useAppTheme()
  const target = useMobileGanttStore((s) => s.mutationSheet)
  const flights = useMobileGanttStore((s) => s.flights)
  const closeMutationSheet = useMobileGanttStore((s) => s.closeMutationSheet)
  const openMutationSheet = useMobileGanttStore((s) => s.openMutationSheet)
  const openDetailSheet = useMobileGanttStore((s) => s.openDetailSheet)

  const open = target?.kind === 'dayContext'
  const date = open ? target.date : null
  const dayFlights = useMemo(() => (date ? flights.filter((f) => f.operatingDate === date) : []), [flights, date])
  const dayFlightIds = dayFlights.map((f) => f.id)
  const typeBreakdown = useMemo(() => {
    const m = new Map<string, number>()
    for (const f of dayFlights) {
      const t = f.aircraftTypeIcao ?? 'UNKN'
      m.set(t, (m.get(t) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [dayFlights])

  if (!date) {
    return <DialogShell open={open} title="Day" />
  }

  const handleView = () => {
    closeMutationSheet()
    openDetailSheet({ kind: 'day', date })
  }
  const handleCancelAll = () => {
    closeMutationSheet()
    openMutationSheet({ kind: 'cancel', flightIds: dayFlightIds })
  }

  return (
    <DialogShell open={open} title={date} snapPercent={55} secondaryLabel="Close">
      <Text style={{ fontSize: 13, color: palette.textTertiary, marginBottom: 12 }}>
        {dayFlights.length} flights · {typeBreakdown.map(([t, n]) => `${t}:${n}`).join(' · ')}
      </Text>
      <ActionRow
        icon={<Icon icon={Eye} size="md" color={accent} />}
        label="View day summary"
        onPress={handleView}
        palette={palette}
      />
      <ActionRow
        icon={<Icon icon={ArrowLeftRight} size="md" color={accent} />}
        label="Bulk reassign (use selection)"
        onPress={() => closeMutationSheet()}
        palette={palette}
        disabled
      />
      <ActionRow
        icon={<Icon icon={Ban} size="md" color="#FF3B3B" />}
        label={`Cancel all flights this day (${dayFlights.length})`}
        onPress={handleCancelAll}
        palette={palette}
        destructive
        disabled={dayFlights.length === 0}
      />
    </DialogShell>
  )
}

function ActionRow({
  icon,
  label,
  onPress,
  palette,
  disabled,
  loading,
  destructive,
}: {
  icon: React.ReactNode
  label: string
  onPress: () => void
  palette: { text: string; border: string }
  disabled?: boolean
  loading?: boolean
  destructive?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {icon}
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: destructive ? '#FF3B3B' : palette.text }}>
        {label}
      </Text>
      {loading && <ActivityIndicator size="small" />}
    </Pressable>
  )
}
