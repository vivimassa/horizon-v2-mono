import { useState } from 'react'
import type { AirportRef, CurfewEntry } from '@skyhub/api'
import { FieldRow } from '@/components/ui'
import { Plus, Trash2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'

interface Props {
  airport: AirportRef
  editing?: boolean
  draft?: Partial<AirportRef>
  onChange?: (key: string, value: unknown) => void
}

export function AirportOperationsTab({ airport, editing, draft = {}, onChange }: Props) {
  const get = (key: keyof AirportRef) => (key in draft ? (draft as any)[key] : airport[key])
  const change = (key: string) => (v: unknown) => onChange?.(key, v ?? null)

  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const curfews: CurfewEntry[] = (get('curfews') as CurfewEntry[]) ?? airport.curfews ?? []

  const updateCurfews = (updated: CurfewEntry[]) => {
    onChange?.('curfews', updated)
  }

  const addCurfew = () => {
    updateCurfews([
      ...curfews,
      {
        _id: crypto.randomUUID(),
        startTime: '23:00',
        endTime: '06:00',
        effectiveFrom: null,
        effectiveUntil: null,
        remarks: null,
      },
    ])
  }

  const removeCurfew = (id: string) => {
    updateCurfews(curfews.filter((c) => c._id !== id))
  }

  const updateCurfewField = (id: string, field: keyof CurfewEntry, value: string | null) => {
    updateCurfews(curfews.map((c) => (c._id === id ? { ...c, [field]: value } : c)))
  }

  const inputStyle = {
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
    color: palette.text,
  }

  return (
    <div className="px-6 pt-3 pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
        <FieldRow
          label="Slot Controlled"
          value={airport.isSlotControlled}
          editing={editing}
          editValue={get('isSlotControlled')}
          onChangeValue={change('isSlotControlled')}
          type="toggle"
        />
        <FieldRow label="Has Curfew" value={curfews.length > 0 ? 'Yes' : 'No'} />
        <FieldRow
          label="Weather Monitored"
          value={airport.weatherMonitored}
          editing={editing}
          editValue={get('weatherMonitored')}
          onChangeValue={change('weatherMonitored')}
          type="toggle"
        />
        <FieldRow
          label="Weather Station"
          value={airport.weatherStation}
          editing={editing}
          editValue={get('weatherStation')}
          onChangeValue={change('weatherStation')}
        />
        <FieldRow
          label="Home Base"
          value={airport.isHomeBase}
          editing={editing}
          editValue={get('isHomeBase')}
          onChangeValue={change('isHomeBase')}
          type="toggle"
        />
        <FieldRow
          label="UTC Offset"
          value={
            airport.utcOffsetHours != null
              ? `UTC${airport.utcOffsetHours >= 0 ? '+' : ''}${airport.utcOffsetHours}`
              : null
          }
          editing={editing}
          editValue={get('utcOffsetHours')}
          onChangeValue={change('utcOffsetHours')}
          type="number"
        />
      </div>

      {/* Curfew rows */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: palette.textTertiary }}>
            Curfew Windows
          </h3>
          {editing && (
            <button
              onClick={addCurfew}
              className="flex items-center gap-1 text-[12px] font-medium px-2 py-1 rounded-md transition-colors"
              style={{ color: '#0063F7', background: isDark ? 'rgba(0,99,247,0.10)' : 'rgba(0,99,247,0.06)' }}
            >
              <Plus size={13} /> Add Curfew
            </button>
          )}
        </div>

        {curfews.length === 0 && (
          <div className="text-[13px] py-3" style={{ color: palette.textTertiary }}>
            No curfew windows defined
          </div>
        )}

        {curfews.length > 0 && (
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${palette.border}` }}>
            {/* Header */}
            <div
              className="grid gap-2 px-3 py-2 text-[11px] font-medium uppercase tracking-wider"
              style={{
                gridTemplateColumns: editing ? '72px 72px 96px 96px 1fr 32px' : '72px 72px 96px 96px 1fr',
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                color: palette.textTertiary,
              }}
            >
              <span>Start</span>
              <span>End</span>
              <span>Eff. From</span>
              <span>Eff. Until</span>
              <span>Remarks</span>
              {editing && <span />}
            </div>

            {/* Rows */}
            {curfews.map((c, i) => (
              <div
                key={c._id}
                className="grid gap-2 px-3 py-2 items-center text-[13px]"
                style={{
                  gridTemplateColumns: editing ? '72px 72px 96px 96px 1fr 32px' : '72px 72px 96px 96px 1fr',
                  color: palette.text,
                  borderTop: i > 0 ? `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` : undefined,
                }}
              >
                {editing ? (
                  <>
                    <input
                      type="text"
                      value={c.startTime}
                      onChange={(e) => updateCurfewField(c._id, 'startTime', e.target.value)}
                      placeholder="HH:MM"
                      className="rounded px-1.5 py-1 text-[13px] font-medium outline-none"
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      value={c.endTime}
                      onChange={(e) => updateCurfewField(c._id, 'endTime', e.target.value)}
                      placeholder="HH:MM"
                      className="rounded px-1.5 py-1 text-[13px] font-medium outline-none"
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      value={c.effectiveFrom ?? ''}
                      onChange={(e) => updateCurfewField(c._id, 'effectiveFrom', e.target.value || null)}
                      placeholder="YYYY-MM-DD"
                      className="rounded px-1.5 py-1 text-[13px] outline-none"
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      value={c.effectiveUntil ?? ''}
                      onChange={(e) => updateCurfewField(c._id, 'effectiveUntil', e.target.value || null)}
                      placeholder="YYYY-MM-DD"
                      className="rounded px-1.5 py-1 text-[13px] outline-none"
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      value={c.remarks ?? ''}
                      onChange={(e) => updateCurfewField(c._id, 'remarks', e.target.value || null)}
                      placeholder="Reason / justification"
                      className="rounded px-1.5 py-1 text-[13px] outline-none"
                      style={inputStyle}
                    />
                    <button
                      onClick={() => removeCurfew(c._id)}
                      className="p-1 rounded transition-colors"
                      style={{ color: '#FF3B3B' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="font-medium">{c.startTime}</span>
                    <span className="font-medium">{c.endTime}</span>
                    <span style={{ color: palette.textSecondary }}>{c.effectiveFrom ?? '—'}</span>
                    <span style={{ color: palette.textSecondary }}>{c.effectiveUntil ?? '—'}</span>
                    <span style={{ color: palette.textSecondary }}>{c.remarks ?? '—'}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
