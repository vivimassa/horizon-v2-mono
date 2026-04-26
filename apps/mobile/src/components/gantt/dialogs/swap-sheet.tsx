// Swap two flights between aircraft. Two flight ID lists, current tails are
// inferred from the flight records.

import { useMemo, useState } from 'react'
import { View, Text } from 'react-native'
import { ArrowDownUp } from 'lucide-react-native'
import { Icon, useAuthStore } from '@skyhub/ui'
import { api } from '@skyhub/api'
import { useMobileGanttStore } from '../../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { DialogShell, FieldLabel } from './dialog-shell'

export function SwapSheet() {
  const { palette, accent } = useAppTheme()
  const target = useMobileGanttStore((s) => s.mutationSheet)
  const flights = useMobileGanttStore((s) => s.flights)
  const closeMutationSheet = useMobileGanttStore((s) => s.closeMutationSheet)
  const showToast = useMobileGanttStore((s) => s.showToast)
  const refresh = useMobileGanttStore((s) => s.refresh)
  const clearSelection = useMobileGanttStore((s) => s.clearSelection)
  const operatorId = useAuthStore((s) => s.user?.operatorId ?? null)
  const [confirming, setConfirming] = useState(false)

  const open = target?.kind === 'swap'
  const aFlightIds = open ? target.aFlightIds : []
  const bFlightIds = open ? target.bFlightIds : []

  const aSubset = useMemo(() => flights.filter((f) => aFlightIds.includes(f.id)), [flights, aFlightIds])
  const bSubset = useMemo(() => flights.filter((f) => bFlightIds.includes(f.id)), [flights, bFlightIds])

  const aReg = aSubset[0]?.aircraftReg ?? null
  const bReg = bSubset[0]?.aircraftReg ?? null
  const aType = aSubset[0]?.aircraftTypeIcao ?? null
  const bType = bSubset[0]?.aircraftTypeIcao ?? null
  const typeMismatch = aType && bType && aType !== bType

  async function handleConfirm() {
    if (!operatorId) return
    setConfirming(true)
    try {
      await api.ganttSwapFlights(operatorId, aFlightIds, aReg, bFlightIds, bReg)
      showToast('success', 'Swap complete.')
      clearSelection()
      closeMutationSheet()
      await refresh(operatorId)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Swap failed')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <DialogShell
      open={open}
      title="Swap aircraft"
      snapPercent={60}
      primaryLabel="Swap"
      primaryDisabled={confirming || aFlightIds.length === 0 || bFlightIds.length === 0 || !!typeMismatch}
      primaryLoading={confirming}
      onPrimary={handleConfirm}
      secondaryLabel="Cancel"
    >
      <FieldLabel label="GROUP A" palette={palette} />
      <View
        style={{
          padding: 10,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: palette.cardBorder,
          marginBottom: 8,
        }}
      >
        <Text style={{ fontSize: 13, color: palette.textTertiary, marginBottom: 4 }}>
          Currently on {aReg ?? 'unassigned'} → moves to {bReg ?? 'unassigned'}
        </Text>
        {aSubset.slice(0, 4).map((f) => (
          <Text key={f.id} style={{ fontSize: 13, color: palette.text, fontFamily: 'monospace' }}>
            {f.flightNumber} · {f.depStation}-{f.arrStation}
          </Text>
        ))}
      </View>

      <View style={{ alignItems: 'center', paddingVertical: 6 }}>
        <Icon icon={ArrowDownUp} size="md" color={accent} />
      </View>

      <FieldLabel label="GROUP B" palette={palette} />
      <View
        style={{
          padding: 10,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: palette.cardBorder,
          marginBottom: 8,
        }}
      >
        <Text style={{ fontSize: 13, color: palette.textTertiary, marginBottom: 4 }}>
          Currently on {bReg ?? 'unassigned'} → moves to {aReg ?? 'unassigned'}
        </Text>
        {bSubset.slice(0, 4).map((f) => (
          <Text key={f.id} style={{ fontSize: 13, color: palette.text, fontFamily: 'monospace' }}>
            {f.flightNumber} · {f.depStation}-{f.arrStation}
          </Text>
        ))}
      </View>

      {typeMismatch && (
        <Text style={{ fontSize: 13, color: '#FF3B3B', marginTop: 8 }}>
          Type mismatch: {aType} ↔ {bType}. Swap will be rejected by the server.
        </Text>
      )}
    </DialogShell>
  )
}
