// Bulk assign — pick aircraft of matching type and assign all selected flights.

import { useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { api } from '@skyhub/api'
import { useAuthStore } from '@skyhub/ui'
import { useMobileGanttStore } from '../../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { DialogShell } from './dialog-shell'

export function AssignSheet() {
  const { palette, accent, isDark } = useAppTheme()
  const target = useMobileGanttStore((s) => s.mutationSheet)
  const aircraft = useMobileGanttStore((s) => s.aircraft)
  const aircraftTypes = useMobileGanttStore((s) => s.aircraftTypes)
  const flights = useMobileGanttStore((s) => s.flights)
  const closeMutationSheet = useMobileGanttStore((s) => s.closeMutationSheet)
  const applyOptimisticPlacement = useMobileGanttStore((s) => s.applyOptimisticPlacement)
  const revertOptimisticPlacement = useMobileGanttStore((s) => s.revertOptimisticPlacement)
  const showToast = useMobileGanttStore((s) => s.showToast)
  const clearSelection = useMobileGanttStore((s) => s.clearSelection)
  const operatorId = useAuthStore((s) => s.user?.operatorId ?? null)
  const [picked, setPicked] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const open = target?.kind === 'assign'
  const flightIds = open ? target.flightIds : []
  const aircraftTypeIcao = open ? target.aircraftTypeIcao : null

  const candidates = useMemo(() => {
    if (!aircraftTypeIcao) return aircraft
    return aircraft.filter((a) => a.aircraftTypeIcao === aircraftTypeIcao)
  }, [aircraft, aircraftTypeIcao])

  const flightSummary = useMemo(() => {
    const subset = flights.filter((f) => flightIds.includes(f.id))
    const codes = new Set(subset.map((f) => f.flightNumber))
    return `${flightIds.length} flight${flightIds.length === 1 ? '' : 's'} (${[...codes].slice(0, 3).join(', ')}${codes.size > 3 ? '…' : ''})`
  }, [flights, flightIds])

  async function handleAssign() {
    if (!operatorId || !picked) return
    setLoading(true)
    applyOptimisticPlacement(flightIds, picked)
    try {
      await api.ganttAssignFlights(operatorId, flightIds, picked)
      showToast('success', `Assigned to ${picked}.`)
      clearSelection()
      closeMutationSheet()
    } catch (err) {
      revertOptimisticPlacement(flightIds)
      showToast('error', err instanceof Error ? err.message : 'Assignment failed')
    } finally {
      setLoading(false)
      setPicked(null)
    }
  }

  return (
    <DialogShell
      open={open}
      title="Assign aircraft"
      onClose={() => {
        setPicked(null)
        closeMutationSheet()
      }}
      primaryLabel={picked ? `Assign to ${picked}` : 'Pick a tail'}
      primaryDisabled={!picked || loading}
      primaryLoading={loading}
      onPrimary={handleAssign}
      secondaryLabel="Cancel"
    >
      <Text style={{ fontSize: 13, color: palette.textSecondary, marginBottom: 6 }}>{flightSummary}</Text>
      {aircraftTypeIcao && (
        <Text style={{ fontSize: 13, color: palette.textTertiary, marginBottom: 12 }}>
          Type filter: {aircraftTypeIcao} ({aircraftTypes.find((t) => t.icaoType === aircraftTypeIcao)?.name ?? ''})
        </Text>
      )}
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {candidates.length === 0 && (
          <View style={{ paddingVertical: 30, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: palette.textTertiary }}>No matching aircraft.</Text>
          </View>
        )}
        {candidates.map((ac) => {
          const active = picked === ac.registration
          return (
            <Pressable
              key={ac.registration}
              onPress={() => setPicked(ac.registration)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: active ? accent : palette.cardBorder,
                marginBottom: 8,
                backgroundColor: active ? (isDark ? 'rgba(62,123,250,0.18)' : 'rgba(62,123,250,0.10)') : 'transparent',
              }}
            >
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: active ? accent : palette.textTertiary,
                  marginRight: 10,
                  backgroundColor: active ? accent : 'transparent',
                }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, fontFamily: 'monospace' }}>
                  {ac.registration}
                </Text>
                <Text style={{ fontSize: 13, color: palette.textTertiary, marginTop: 2 }}>
                  {ac.aircraftTypeIcao} · {ac.status} · {ac.homeBaseIcao ?? '—'}
                </Text>
              </View>
              {loading && active && <ActivityIndicator size="small" color={accent} />}
            </Pressable>
          )
        })}
      </ScrollView>
    </DialogShell>
  )
}
