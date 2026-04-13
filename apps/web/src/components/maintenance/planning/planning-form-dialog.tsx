'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { api, type MxFilterOptions } from '@skyhub/api'
import { useMaintenancePlanningStore } from '@/stores/use-maintenance-planning-store'
import { getOperatorId } from '@/stores/use-operator-store'

export function PlanningFormDialog() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const formDialog = useMaintenancePlanningStore((s) => s.formDialog)
  const closeForm = useMaintenancePlanningStore((s) => s.closeForm)
  const commitPeriod = useMaintenancePlanningStore((s) => s.commitPeriod)
  const filterOptions = useMaintenancePlanningStore((s) => s.filterOptions)
  const rows = useMaintenancePlanningStore((s) => s.rows)

  const [checkTypeId, setCheckTypeId] = useState(formDialog?.event?.checkTypeId || '')
  const [station, setStation] = useState(formDialog?.event?.station || '')
  const [startDate, setStartDate] = useState(formDialog?.event?.plannedStart || formDialog?.date || '')
  const [endDate, setEndDate] = useState(formDialog?.event?.plannedEnd || '')
  const [notes, setNotes] = useState(formDialog?.event?.notes || '')
  const [aircraftId, setAircraftId] = useState(formDialog?.aircraftId || '')
  const [saving, setSaving] = useState(false)

  const isEdit = formDialog?.mode === 'edit'

  // Auto-compute end date
  useEffect(() => {
    if (isEdit || !checkTypeId || !startDate) return
    const ct = filterOptions.checkTypes.find((c) => c.id === checkTypeId)
    if (!ct) return
    // Fetch check type for duration
    api
      .getMaintenanceCheckType(checkTypeId)
      .then((full) => {
        if (full.defaultDurationHours) {
          const days = Math.max(1, Math.ceil(full.defaultDurationHours / 24))
          const d = new Date(startDate)
          d.setDate(d.getDate() + days)
          setEndDate(d.toISOString().slice(0, 10))
        }
      })
      .catch(() => {})
  }, [checkTypeId, startDate, isEdit, filterOptions.checkTypes])

  const handleSave = useCallback(async () => {
    const operatorId = getOperatorId()
    if (!operatorId || !checkTypeId || !startDate || !station) return
    setSaving(true)
    try {
      if (isEdit && formDialog?.event) {
        await api.updateMaintenanceEvent(formDialog.event.id, {
          plannedStartUtc: startDate,
          plannedEndUtc: endDate || null,
          station: station.toUpperCase(),
          notes: notes || null,
        } as Parameters<typeof api.updateMaintenanceEvent>[1])
      } else {
        await api.createMaintenanceEvent({
          operatorId,
          aircraftId,
          checkTypeId,
          plannedStartUtc: startDate,
          plannedEndUtc: endDate || null,
          station: station.toUpperCase(),
          notes: notes || null,
        })
      }
      closeForm()
      await commitPeriod()
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }, [checkTypeId, startDate, endDate, station, notes, aircraftId, isEdit, formDialog, closeForm, commitPeriod])

  if (!formDialog) return null

  const bg = isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,0.98)'
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)'
  const text = isDark ? '#F5F2FD' : '#1C1C28'
  const muted = isDark ? '#8F90A6' : '#555770'

  const canSave = (isEdit || aircraftId) && checkTypeId && startDate && station

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={closeForm}
    >
      <div
        className="rounded-2xl w-[90%] max-w-[480px]"
        style={{
          background: bg,
          border: `1px solid ${border}`,
          boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.6)' : '0 16px 48px rgba(96,97,112,0.16)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${border}` }}>
          <h2 className="text-[16px] font-bold" style={{ color: text }}>
            {isEdit ? 'Edit Maintenance Event' : 'New Maintenance Event'}
          </h2>
          <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-white/5">
            <X size={18} style={{ color: muted }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-5 py-4">
          {/* Aircraft (only for create if not pre-selected) */}
          {!isEdit && !formDialog.aircraftId && (
            <Field label="Aircraft" muted={muted}>
              <select
                value={aircraftId}
                onChange={(e) => setAircraftId(e.target.value)}
                className="h-[40px] px-3 rounded-lg text-[14px]"
                style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: text }}
              >
                <option value="">Select aircraft</option>
                {rows.map((r) => (
                  <option key={r.aircraftId} value={r.aircraftId}>
                    {r.registration} ({r.icaoType})
                  </option>
                ))}
              </select>
            </Field>
          )}

          {/* Check type */}
          {!isEdit && (
            <Field label="Check Type" muted={muted}>
              <select
                value={checkTypeId}
                onChange={(e) => setCheckTypeId(e.target.value)}
                className="h-[40px] px-3 rounded-lg text-[14px]"
                style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: text }}
              >
                <option value="">Select check type</option>
                {filterOptions.checkTypes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {/* Station */}
          <Field label="Station (ICAO)" muted={muted}>
            <input
              type="text"
              value={station}
              onChange={(e) => setStation(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="e.g. VVTS"
              className="h-[40px] px-3 rounded-lg text-[14px] uppercase"
              style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: text }}
            />
          </Field>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Date" muted={muted}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-[40px] px-3 rounded-lg text-[14px]"
                style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: text }}
              />
            </Field>
            <Field label="End Date" muted={muted}>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-[40px] px-3 rounded-lg text-[14px]"
                style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: text }}
              />
            </Field>
          </div>

          {/* Notes */}
          <Field label="Notes" muted={muted}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="px-3 py-2 rounded-lg text-[14px] resize-none"
              style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: text }}
            />
          </Field>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4" style={{ borderTop: `1px solid ${border}` }}>
          <button
            onClick={closeForm}
            className="h-[36px] px-4 rounded-lg text-[13px] font-medium transition-colors"
            style={{
              color: muted,
              border: `1px solid ${border}`,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="h-[36px] px-4 rounded-lg text-[13px] font-medium text-white transition-opacity disabled:opacity-50"
            style={{ background: 'var(--module-accent, #1e40af)' }}
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Field({ label, muted, children }: { label: string; muted: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium uppercase" style={{ color: muted }}>
        {label}
      </label>
      {children}
    </div>
  )
}
