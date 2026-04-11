'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { colors } from '@skyhub/ui/theme'
import { MODULE_THEMES } from '@skyhub/constants'
import { api } from '@skyhub/api'
import type { SlotSeriesRef, SlotActionLogRef } from '@skyhub/api'
import { formatSlotTime, formatPeriod, STATUS_CHIP_CLASSES, ACTION_CODE_LABELS, PRIORITY_LABELS } from './slot-types'
import type { SlotStatus, PriorityCategory } from './slot-types'

interface SlotDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  seriesId: string
  onDataChanged: () => void
  isDark: boolean
}

export function SlotDetailDialog({ open, onOpenChange, seriesId, onDataChanged, isDark }: SlotDetailDialogProps) {
  const palette = isDark ? colors.dark : colors.light
  const [series, setSeries] = useState<SlotSeriesRef | null>(null)
  const [actionLog, setActionLog] = useState<SlotActionLogRef[]>([])

  useEffect(() => {
    if (!open) return
    api.getSlotSeriesById(seriesId).then(setSeries)
    api.getSlotActionLog(seriesId).then(setActionLog)
  }, [open, seriesId])

  if (!open || !series) return null

  const glassBg = isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.95)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const chipStyle = STATUS_CHIP_CLASSES[series.status] || STATUS_CHIP_CLASSES.draft

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="w-[640px] max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(24px)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${glassBorder}` }}
        >
          <div className="flex items-center gap-3">
            <h2 className="text-[16px] font-semibold" style={{ color: palette.text }}>
              Slot Detail
            </h2>
            <span
              className="text-[13px] font-semibold px-2 py-0.5 rounded-md"
              style={{ background: chipStyle.bg, color: chipStyle.text, border: `1px solid ${chipStyle.border}` }}
            >
              {series.status}
            </span>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} className="p-1 rounded-md hover:opacity-70">
            <X size={16} style={{ color: palette.textSecondary }} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Route & times */}
          <Section title="Route" palette={palette}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
              <Row label="Arrival Flight" value={series.arrivalFlightNumber} palette={palette} mono />
              <Row label="Departure Flight" value={series.departureFlightNumber} palette={palette} mono />
              <Row label="Origin" value={series.arrivalOriginIata} palette={palette} />
              <Row label="Destination" value={series.departureDestIata} palette={palette} />
              <Row label="Req. Arr Time" value={formatSlotTime(series.requestedArrivalTime)} palette={palette} mono />
              <Row label="Req. Dep Time" value={formatSlotTime(series.requestedDepartureTime)} palette={palette} mono />
              <Row label="Alloc. Arr Time" value={formatSlotTime(series.allocatedArrivalTime)} palette={palette} mono />
              <Row
                label="Alloc. Dep Time"
                value={formatSlotTime(series.allocatedDepartureTime)}
                palette={palette}
                mono
              />
            </div>
          </Section>

          {/* Period & schedule */}
          <Section title="Schedule" palette={palette}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
              <Row label="Period" value={formatPeriod(series.periodStart, series.periodEnd)} palette={palette} />
              <Row label="Days of Operation" value={series.daysOfOperation} palette={palette} mono />
              <Row label="Frequency" value={series.frequencyRate === 1 ? 'Weekly' : 'Biweekly'} palette={palette} />
              <Row label="Overnight" value={series.overnightIndicator ? 'Yes' : 'No'} palette={palette} />
            </div>
          </Section>

          {/* Aircraft & priority */}
          <Section title="Aircraft & Priority" palette={palette}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
              <Row label="Aircraft Type" value={series.aircraftTypeIcao} palette={palette} />
              <Row label="Seats" value={series.seats?.toString()} palette={palette} />
              <Row
                label="Priority"
                value={PRIORITY_LABELS[series.priorityCategory as PriorityCategory]}
                palette={palette}
              />
              <Row label="Historic Eligible" value={series.historicEligible ? 'Yes' : 'No'} palette={palette} />
            </div>
          </Section>

          {/* Flexibility & coordinator */}
          {(series.flexibilityArrival || series.flexibilityDeparture || series.coordinatorRef) && (
            <Section title="Flexibility" palette={palette}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                <Row label="Flex. Arrival" value={series.flexibilityArrival} palette={palette} mono />
                <Row label="Flex. Departure" value={series.flexibilityDeparture} palette={palette} mono />
                <Row
                  label="Min Turnaround"
                  value={series.minTurnaroundMinutes ? `${series.minTurnaroundMinutes} min` : null}
                  palette={palette}
                />
                <Row label="Coordinator Ref" value={series.coordinatorRef} palette={palette} />
              </div>
            </Section>
          )}

          {/* Action log */}
          <Section title="Action History" palette={palette}>
            {actionLog.length === 0 ? (
              <div className="text-[13px]" style={{ color: palette.textTertiary }}>
                No actions recorded
              </div>
            ) : (
              <div className="space-y-1.5">
                {actionLog.map((a) => (
                  <div key={a._id} className="flex items-center gap-3 text-[13px]">
                    <span
                      className="font-mono font-semibold w-6 text-center"
                      style={{ color: MODULE_THEMES.network.accent }}
                    >
                      {a.actionCode}
                    </span>
                    <span style={{ color: palette.textSecondary }}>
                      {ACTION_CODE_LABELS[a.actionCode] || a.actionCode}
                    </span>
                    <span
                      className="text-[13px] px-1.5 py-0.5 rounded"
                      style={{
                        background: a.actionSource === 'airline' ? 'rgba(0,99,247,0.1)' : 'rgba(124,58,237,0.1)',
                        color: a.actionSource === 'airline' ? '#0063F7' : '#7c3aed',
                      }}
                    >
                      {a.actionSource}
                    </span>
                    <span className="flex-1" />
                    <span className="text-[13px]" style={{ color: palette.textTertiary }}>
                      {a.createdAt
                        ? new Date(a.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-4 shrink-0" style={{ borderTop: `1px solid ${glassBorder}` }}>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 rounded-xl text-[13px] font-medium"
            style={{ background: MODULE_THEMES.network.accent, color: '#fff' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  palette,
  children,
}: {
  title: string
  palette: { text: string; accent: string }
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1 h-4 rounded-full" style={{ background: MODULE_THEMES.network.accent }} />
        <span className="text-[13px] font-semibold" style={{ color: palette.text }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}

function Row({
  label,
  value,
  mono,
  palette,
}: {
  label: string
  value?: string | null
  mono?: boolean
  palette: { text: string; textSecondary: string }
}) {
  return (
    <div className="flex justify-between">
      <span style={{ color: palette.textSecondary }}>{label}</span>
      <span className={mono ? 'font-mono' : ''} style={{ color: palette.text }}>
        {value || '\u2014'}
      </span>
    </div>
  )
}
