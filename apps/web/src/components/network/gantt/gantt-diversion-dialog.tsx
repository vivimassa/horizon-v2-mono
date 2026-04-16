'use client'

import { useEffect, useState } from 'react'
import { useGanttStore } from '@/stores/use-gantt-store'
import { useOperatorStore } from '@/stores/use-operator-store'
import { fetchFlightDetail } from '@/lib/gantt/flight-detail-api'
import type { FlightDetail } from '@/lib/gantt/flight-detail-types'
import { DisruptionDialog } from './flight-information/disruption-dialog'

// Wrapper that lets Gantt-level callers (ribbon toolbar, right-click menu)
// open the Disruption dialog by flight id. Fetches FlightDetail on mount so
// the existing dialog component can stay unchanged.

export function GanttDiversionDialog() {
  const flightId = useGanttStore((s) => s.diversionDialogFlightId)
  const close = useGanttStore((s) => s.closeDiversionDialog)
  const refetch = useGanttStore((s) => s._fetchFlights)

  const [detail, setDetail] = useState<FlightDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!flightId) {
      setDetail(null)
      setError(null)
      return
    }
    const [sfId, opDate] = flightId.split('|')
    if (!sfId || !opDate) return
    const operatorId = useOperatorStore.getState().operator?._id ?? ''
    fetchFlightDetail(sfId, opDate, operatorId)
      .then(setDetail)
      .catch((e) => setError((e as Error).message))
  }, [flightId])

  if (!flightId) return null
  if (error) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={close}>
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 text-[13px]">
          Failed to load flight: {error}
        </div>
      </div>
    )
  }
  if (!detail) return null

  return (
    <DisruptionDialog
      open={true}
      flight={detail}
      onClose={close}
      onApplied={async () => {
        await refetch()
      }}
    />
  )
}
