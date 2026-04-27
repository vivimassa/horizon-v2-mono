// Reschedule a flight — pick new STD time, optional reason, optional propagate.

import { useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput } from 'react-native'
import { api } from '@skyhub/api'
import { useAuthStore, Switch } from '@skyhub/ui'
import { useMobileGanttStore } from '../../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { DialogShell, FieldLabel } from './dialog-shell'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function formatHHMM(ms: number): string {
  const d = new Date(ms)
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

export function RescheduleSheet() {
  const { palette } = useAppTheme()
  const target = useMobileGanttStore((s) => s.mutationSheet)
  const flights = useMobileGanttStore((s) => s.flights)
  const closeMutationSheet = useMobileGanttStore((s) => s.closeMutationSheet)
  const showToast = useMobileGanttStore((s) => s.showToast)
  const refresh = useMobileGanttStore((s) => s.refresh)
  const applyOptimisticReschedule = useMobileGanttStore((s) => s.applyOptimisticReschedule)
  const operatorId = useAuthStore((s) => s.user?.operatorId ?? null)

  const open = target?.kind === 'reschedule'
  const flightId = open ? target.flightId : null
  const flight = useMemo(() => flights.find((f) => f.id === flightId), [flights, flightId])

  const [hhmm, setHhmm] = useState('')
  const [reason, setReason] = useState('')
  const [propagate, setPropagate] = useState(true)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (flight) {
      setHhmm(formatHHMM(flight.etdUtc ?? flight.stdUtc))
    } else {
      setHhmm('')
      setReason('')
    }
  }, [flight?.id])

  const parseTime = (input: string): { hours: number; mins: number } | null => {
    const m = input.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return null
    const h = parseInt(m[1], 10)
    const mins = parseInt(m[2], 10)
    if (h < 0 || h > 23 || mins < 0 || mins > 59) return null
    return { hours: h, mins }
  }

  const parsed = parseTime(hhmm)
  const newEtdUtc = useMemo(() => {
    if (!parsed || !flight) return null
    const baseDate = new Date(flight.stdUtc)
    baseDate.setUTCHours(parsed.hours, parsed.mins, 0, 0)
    return baseDate.getTime()
  }, [parsed, flight])
  const blockMs = flight ? flight.staUtc - flight.stdUtc || flight.blockMinutes * 60_000 : 0
  const newEtaUtc = newEtdUtc != null ? newEtdUtc + blockMs : null

  if (!flight) {
    return <DialogShell open={open} title="Reschedule" />
  }

  const flightForHandler = flight

  async function handleConfirm() {
    if (!operatorId || !newEtdUtc) return
    setConfirming(true)
    applyOptimisticReschedule(flightForHandler.id, newEtdUtc, newEtaUtc)
    try {
      await api.ganttRescheduleFlight(flightForHandler.id, {
        newEtdUtc,
        newEtaUtc,
        reason: reason || undefined,
      })
      if (propagate && flightForHandler.rotationId) {
        const offsetMs = newEtdUtc - flightForHandler.stdUtc
        const siblings = flights.filter(
          (f) =>
            f.rotationId === flightForHandler.rotationId &&
            f.id !== flightForHandler.id &&
            (f.rotationSequence ?? 0) > (flightForHandler.rotationSequence ?? 0),
        )
        await Promise.all(
          siblings.map((sib) => {
            const sibBlockMs = sib.staUtc - sib.stdUtc
            const sibNewEtd = (sib.etdUtc ?? sib.stdUtc) + offsetMs
            applyOptimisticReschedule(sib.id, sibNewEtd, sibNewEtd + sibBlockMs)
            return api.ganttRescheduleFlight(sib.id, {
              newEtdUtc: sibNewEtd,
              newEtaUtc: sibNewEtd + sibBlockMs,
              reason: reason || 'Rotation propagation',
            })
          }),
        )
      }
      showToast('success', 'Flight rescheduled.')
      closeMutationSheet()
      await refresh(operatorId)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Reschedule failed')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <DialogShell
      open={open}
      title="Reschedule"
      primaryLabel="Reschedule"
      primaryDisabled={!parsed || confirming}
      primaryLoading={confirming}
      onPrimary={handleConfirm}
      secondaryLabel="Cancel"
    >
      <Text style={{ fontSize: 13, color: palette.text, fontFamily: 'monospace', marginBottom: 12 }}>
        {flight.flightNumber} · {flight.depStation}-{flight.arrStation} · {flight.operatingDate}
      </Text>

      <FieldLabel label="NEW STD (UTC)" palette={palette} />
      <TextInput
        value={hhmm}
        onChangeText={setHhmm}
        placeholder="HH:MM"
        placeholderTextColor={palette.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        style={{
          height: 40,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: parsed ? palette.cardBorder : '#FF3B3B',
          backgroundColor: palette.background,
          paddingHorizontal: 10,
          fontSize: 14,
          color: palette.text,
          fontFamily: 'monospace',
          marginBottom: 12,
        }}
      />

      <FieldLabel label="REASON (OPTIONAL)" palette={palette} />
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="e.g. crew unavailable"
        placeholderTextColor={palette.textTertiary}
        multiline
        numberOfLines={2}
        style={{
          minHeight: 60,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: palette.cardBorder,
          backgroundColor: palette.background,
          paddingHorizontal: 10,
          paddingVertical: 8,
          fontSize: 13,
          color: palette.text,
          marginBottom: 12,
          textAlignVertical: 'top',
        }}
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 10,
        }}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontSize: 14, color: palette.text }}>Propagate to rotation</Text>
          <Text style={{ fontSize: 13, color: palette.textTertiary, marginTop: 2 }}>
            Shift downstream legs in the same rotation by the same delta.
          </Text>
        </View>
        <Switch value={propagate && !!flight.rotationId} onValueChange={setPropagate} disabled={!flight.rotationId} />
      </View>
    </DialogShell>
  )
}
