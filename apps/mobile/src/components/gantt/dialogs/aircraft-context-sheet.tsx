// Aircraft long-press context. Block all / Maintenance / Unassign all / View.

import { useMemo, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { Ban, Wrench, Eye, Trash2 } from 'lucide-react-native'
import { Icon, useAuthStore } from '@skyhub/ui'
import { api } from '@skyhub/api'
import { useMobileGanttStore } from '../../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { DialogShell } from './dialog-shell'

export function AircraftContextSheet() {
  const { palette, accent } = useAppTheme()
  const target = useMobileGanttStore((s) => s.mutationSheet)
  const flights = useMobileGanttStore((s) => s.flights)
  const aircraft = useMobileGanttStore((s) => s.aircraft)
  const closeMutationSheet = useMobileGanttStore((s) => s.closeMutationSheet)
  const openDetailSheet = useMobileGanttStore((s) => s.openDetailSheet)
  const openMutationSheet = useMobileGanttStore((s) => s.openMutationSheet)
  const showToast = useMobileGanttStore((s) => s.showToast)
  const refresh = useMobileGanttStore((s) => s.refresh)
  const operatorId = useAuthStore((s) => s.user?.operatorId ?? null)
  const [busy, setBusy] = useState(false)

  const open = target?.kind === 'aircraftContext'
  const reg = open ? target.registration : null
  const ac = useMemo(() => aircraft.find((a) => a.registration === reg) ?? null, [aircraft, reg])
  const acFlightIds = useMemo(() => flights.filter((f) => f.aircraftReg === reg).map((f) => f.id), [flights, reg])

  if (!ac) {
    return <DialogShell open={open} title="Aircraft" />
  }

  const handleView = () => {
    closeMutationSheet()
    openDetailSheet({ kind: 'aircraft', registration: ac.registration })
  }

  const handleUnassignAll = async () => {
    if (!operatorId || acFlightIds.length === 0) return
    setBusy(true)
    try {
      await api.ganttUnassignFlights(operatorId, acFlightIds)
      showToast('success', `Unassigned ${acFlightIds.length} flights from ${ac.registration}.`)
      closeMutationSheet()
      await refresh(operatorId)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Unassign failed')
    } finally {
      setBusy(false)
    }
  }

  const handleBlockAll = () => {
    closeMutationSheet()
    openMutationSheet({ kind: 'cancel', flightIds: acFlightIds })
  }

  const handleMaintenance = () => {
    showToast('info', 'Maintenance scheduling not yet wired in mobile.')
  }

  return (
    <DialogShell open={open} title={ac.registration} snapPercent={55} secondaryLabel="Close">
      <Text style={{ fontSize: 13, color: palette.textTertiary, marginBottom: 12 }}>
        {ac.aircraftTypeIcao} · {ac.status} · {ac.homeBaseIcao ?? '—'} · {acFlightIds.length} scheduled
      </Text>
      <ActionRow
        icon={<Icon icon={Eye} size="md" color={accent} />}
        label="View aircraft details"
        onPress={handleView}
        palette={palette}
      />
      <ActionRow
        icon={<Icon icon={Trash2} size="md" color={accent} />}
        label={`Unassign all (${acFlightIds.length})`}
        onPress={handleUnassignAll}
        palette={palette}
        disabled={busy || acFlightIds.length === 0}
        loading={busy}
      />
      <ActionRow
        icon={<Icon icon={Ban} size="md" color="#FF3B3B" />}
        label={`Cancel all (${acFlightIds.length})`}
        onPress={handleBlockAll}
        palette={palette}
        disabled={acFlightIds.length === 0}
        destructive
      />
      <ActionRow
        icon={<Icon icon={Wrench} size="md" color={palette.textSecondary} />}
        label="Schedule maintenance"
        onPress={handleMaintenance}
        palette={palette}
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
