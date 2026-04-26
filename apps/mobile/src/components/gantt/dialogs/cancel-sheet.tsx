// Cancel flight(s) — show preview list + slot impact + confirm.

import { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, ActivityIndicator } from 'react-native'
import { api } from '@skyhub/api'
import { useAuthStore } from '@skyhub/ui'
import { useMobileGanttStore } from '../../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { DialogShell, FieldLabel } from './dialog-shell'

interface SlotImpact {
  seriesId: string
  airportIata: string
  seasonCode: string
  currentUtilizationPct: number
  projectedUtilizationPct: number
  cancelledCount: number
}

export function CancelSheet() {
  const { palette } = useAppTheme()
  const target = useMobileGanttStore((s) => s.mutationSheet)
  const flights = useMobileGanttStore((s) => s.flights)
  const closeMutationSheet = useMobileGanttStore((s) => s.closeMutationSheet)
  const showToast = useMobileGanttStore((s) => s.showToast)
  const refresh = useMobileGanttStore((s) => s.refresh)
  const clearSelection = useMobileGanttStore((s) => s.clearSelection)
  const operatorId = useAuthStore((s) => s.user?.operatorId ?? null)
  const [impacts, setImpacts] = useState<SlotImpact[] | null>(null)
  const [impactLoading, setImpactLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const open = target?.kind === 'cancel'
  const flightIds = open ? target.flightIds : []
  const subset = useMemo(() => flights.filter((f) => flightIds.includes(f.id)), [flights, flightIds])

  useEffect(() => {
    if (!open || !operatorId || flightIds.length === 0) {
      setImpacts(null)
      return
    }
    setImpactLoading(true)
    api
      .ganttFetchCancelImpact(operatorId, flightIds)
      .then((res) => setImpacts(res.impacts))
      .catch(() => setImpacts([]))
      .finally(() => setImpactLoading(false))
  }, [open, operatorId, flightIds])

  async function handleConfirm() {
    if (!operatorId) return
    setConfirming(true)
    try {
      await api.ganttCancelFlights(operatorId, flightIds)
      showToast('success', `Cancelled ${flightIds.length} flight${flightIds.length === 1 ? '' : 's'}.`)
      clearSelection()
      closeMutationSheet()
      await refresh(operatorId)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Cancel failed')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <DialogShell
      open={open}
      title="Cancel flights"
      snapPercent={75}
      primaryLabel={`Cancel ${flightIds.length} flight${flightIds.length === 1 ? '' : 's'}`}
      primaryDestructive
      primaryDisabled={confirming || flightIds.length === 0}
      primaryLoading={confirming}
      onPrimary={handleConfirm}
      secondaryLabel="Keep"
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <FieldLabel label="FLIGHTS" palette={palette} />
        <View
          style={{
            borderRadius: 8,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            paddingHorizontal: 10,
            paddingVertical: 8,
            marginBottom: 16,
          }}
        >
          {subset.slice(0, 6).map((f) => (
            <Text key={f.id} style={{ fontSize: 13, color: palette.text, fontFamily: 'monospace', paddingVertical: 2 }}>
              {f.flightNumber} · {f.depStation}-{f.arrStation} · {f.operatingDate}
            </Text>
          ))}
          {subset.length > 6 && (
            <Text style={{ fontSize: 13, color: palette.textTertiary, marginTop: 4 }}>+ {subset.length - 6} more</Text>
          )}
        </View>

        <FieldLabel label="SLOT IMPACT" palette={palette} />
        <View
          style={{
            borderRadius: 8,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        >
          {impactLoading && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator size="small" />
              <Text style={{ fontSize: 13, color: palette.textTertiary }}>Computing impact…</Text>
            </View>
          )}
          {!impactLoading && impacts && impacts.length === 0 && (
            <Text style={{ fontSize: 13, color: palette.textTertiary }}>
              No linked slot series — cancellations will not affect slot utilization.
            </Text>
          )}
          {!impactLoading &&
            impacts?.map((im) => {
              const drop = im.currentUtilizationPct - im.projectedUtilizationPct
              return (
                <View
                  key={im.seriesId}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontSize: 13, color: palette.text, fontFamily: 'monospace' }}>
                    {im.airportIata} · {im.seasonCode}
                  </Text>
                  <Text style={{ fontSize: 13, color: drop > 5 ? '#FF3B3B' : palette.textSecondary }}>
                    {im.currentUtilizationPct.toFixed(0)}% → {im.projectedUtilizationPct.toFixed(0)}% (-
                    {drop.toFixed(0)}%)
                  </Text>
                </View>
              )
            })}
        </View>
      </ScrollView>
    </DialogShell>
  )
}
