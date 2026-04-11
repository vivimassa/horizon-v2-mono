'use client'

import { useState, useMemo } from 'react'
import { X, Copy, Download, Check } from 'lucide-react'
import { colors } from '@skyhub/ui/theme'
import { MODULE_THEMES } from '@skyhub/constants'
import { api } from '@skyhub/api'
import type { SlotSeriesRef } from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'
import { generateSCR } from '@skyhub/logic'
import type { SCRParams, SlotSeriesForMessage, AirlineActionCode } from '@skyhub/logic'
import { ACTION_CODE_LABELS, STATUS_CHIP_CLASSES } from './slot-types'

interface GenerateSCRDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  series: SlotSeriesRef[]
  airportIata: string
  seasonCode: string
  onGenerated: () => void
  isDark: boolean
}

const AIRLINE_ACTIONS: AirlineActionCode[] = ['N', 'Y', 'B', 'V', 'F', 'C', 'M', 'R', 'L', 'I', 'D', 'A', 'P', 'Z']

export function GenerateSCRDialog({
  open,
  onOpenChange,
  series,
  airportIata,
  seasonCode,
  onGenerated,
  isDark,
}: GenerateSCRDialogProps) {
  const palette = isDark ? colors.dark : colors.light
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selected, setSelected] = useState<Map<string, AirlineActionCode>>(new Map())
  const [siText, setSiText] = useState('')
  const [giText, setGiText] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  function toggleSeries(id: string) {
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else next.set(id, 'N')
      return next
    })
  }

  function setActionCode(id: string, code: AirlineActionCode) {
    setSelected((prev) => new Map(prev).set(id, code))
  }

  const scrText = useMemo(() => {
    if (selected.size === 0) return ''

    const seriesForMsg: SlotSeriesForMessage[] = []
    for (const [id, actionCode] of selected) {
      const s = series.find((x) => x._id === id)
      if (!s) continue
      seriesForMsg.push({
        actionCode,
        arrivalFlightNumber: s.arrivalFlightNumber || undefined,
        departureFlightNumber: s.departureFlightNumber || undefined,
        arrivalOrigin: s.arrivalOriginIata || undefined,
        departureDestination: s.departureDestIata || undefined,
        arrivalTime: s.requestedArrivalTime ?? undefined,
        departureTime: s.requestedDepartureTime ?? undefined,
        overnightIndicator: s.overnightIndicator || undefined,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        daysOfOperation: s.daysOfOperation,
        seats: s.seats || 0,
        aircraftType: s.aircraftTypeIcao || '???',
        arrivalServiceType: s.arrivalServiceType || undefined,
        departureServiceType: s.departureServiceType || undefined,
        flexibilityArrival: s.flexibilityArrival || undefined,
        flexibilityDeparture: s.flexibilityDeparture || undefined,
        minTurnaround: s.minTurnaroundMinutes || undefined,
      })
    }

    const params: SCRParams = {
      operatorCode: 'VJ',
      seasonCode,
      airportIata,
      series: seriesForMsg,
      supplementaryInfo: siText.trim() ? siText.trim().split('\n') : undefined,
      generalInfo: giText.trim() ? giText.trim().split('\n') : undefined,
    }

    return generateSCR(params)
  }, [selected, series, seasonCode, airportIata, siText, giText])

  async function handleCopy() {
    await navigator.clipboard.writeText(scrText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.createSlotMessage({
        operatorId: getOperatorId(),
        direction: 'outbound',
        messageType: 'SCR',
        airportIata,
        seasonCode,
        rawText: scrText,
        parseStatus: 'parsed',
        parsedSeriesCount: selected.size,
      })
      onGenerated()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const glassBg = isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.95)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="w-[760px] max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(24px)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${glassBorder}` }}
        >
          <div className="flex items-center gap-3">
            <h2 className="text-[16px] font-semibold" style={{ color: palette.text }}>
              Generate SCR Message
            </h2>
            {/* Step indicator */}
            <div className="flex gap-1">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className="w-6 h-6 rounded-full text-[13px] font-semibold flex items-center justify-center"
                  style={{
                    background:
                      step === s
                        ? MODULE_THEMES.network.accent
                        : isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.06)',
                    color: step === s ? '#fff' : palette.textSecondary,
                  }}
                >
                  {s}
                </div>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} className="p-1 rounded-md hover:opacity-70">
            <X size={16} style={{ color: palette.textSecondary }} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 1 && (
            <div className="space-y-1">
              <div className="text-[13px] font-medium mb-3" style={{ color: palette.textSecondary }}>
                Select series and assign action codes
              </div>
              {series.map((s) => {
                const isSelected = selected.has(s._id)
                const actionCode = selected.get(s._id) || 'N'
                const chipStyle = STATUS_CHIP_CLASSES[s.status] || STATUS_CHIP_CLASSES.draft
                return (
                  <div
                    key={s._id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                    style={{
                      background: isSelected ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)') : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSeries(s._id)}
                      className="w-4 h-4 rounded accent-blue-600"
                    />
                    <span className="text-[13px] font-mono font-semibold w-24" style={{ color: palette.text }}>
                      {s.arrivalFlightNumber || s.departureFlightNumber || '\u2014'}
                    </span>
                    <span
                      className="text-[13px] px-2 py-0.5 rounded-md"
                      style={{
                        background: chipStyle.bg,
                        color: chipStyle.text,
                        border: `1px solid ${chipStyle.border}`,
                      }}
                    >
                      {s.status}
                    </span>
                    <span className="flex-1" />
                    {isSelected && (
                      <select
                        value={actionCode}
                        onChange={(e) => setActionCode(s._id, e.target.value as AirlineActionCode)}
                        className="h-7 px-2 rounded-lg text-[13px] font-mono appearance-none"
                        style={{
                          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                          border: `1px solid ${glassBorder}`,
                          color: palette.text,
                        }}
                      >
                        {AIRLINE_ACTIONS.map((a) => (
                          <option key={a} value={a}>
                            {a} – {ACTION_CODE_LABELS[a]}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-[13px] font-medium mb-1 block" style={{ color: palette.textSecondary }}>
                  Supplementary Information (SI)
                </label>
                <textarea
                  value={siText}
                  onChange={(e) => setSiText(e.target.value)}
                  rows={3}
                  placeholder="Optional SI lines..."
                  className="w-full rounded-xl p-3 text-[13px] font-mono resize-none outline-none"
                  style={{
                    background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
                    border: `1px solid ${glassBorder}`,
                    color: palette.text,
                  }}
                />
              </div>
              <div>
                <label className="text-[13px] font-medium mb-1 block" style={{ color: palette.textSecondary }}>
                  General Information (GI)
                </label>
                <textarea
                  value={giText}
                  onChange={(e) => setGiText(e.target.value)}
                  rows={3}
                  placeholder="Optional GI lines..."
                  className="w-full rounded-xl p-3 text-[13px] font-mono resize-none outline-none"
                  style={{
                    background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
                    border: `1px solid ${glassBorder}`,
                    color: palette.text,
                  }}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-medium" style={{ color: palette.text }}>
                  Generated SCR
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="h-7 px-2.5 rounded-lg text-[13px] font-medium flex items-center gap-1"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      color: palette.text,
                      border: `1px solid ${glassBorder}`,
                    }}
                  >
                    {copied ? <Check size={12} style={{ color: '#06C270' }} /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <pre
                className="text-[13px] font-mono whitespace-pre-wrap rounded-xl p-4"
                style={{
                  background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
                  border: `1px solid ${glassBorder}`,
                  color: palette.text,
                }}
              >
                {scrText}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between px-5 py-4 shrink-0" style={{ borderTop: `1px solid ${glassBorder}` }}>
          <button
            type="button"
            onClick={() => (step > 1 ? setStep((step - 1) as 1 | 2) : onOpenChange(false))}
            className="h-9 px-4 rounded-xl text-[13px] font-medium"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              color: palette.text,
              border: `1px solid ${glassBorder}`,
            }}
          >
            {step > 1 ? 'Back' : 'Cancel'}
          </button>

          <div className="flex gap-2">
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((step + 1) as 2 | 3)}
                disabled={step === 1 && selected.size === 0}
                className="h-9 px-4 rounded-xl text-[13px] font-medium disabled:opacity-50"
                style={{ background: MODULE_THEMES.network.accent, color: '#fff' }}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-9 px-4 rounded-xl text-[13px] font-medium disabled:opacity-50"
                style={{ background: '#06C270', color: '#fff' }}
              >
                {saving ? 'Saving...' : 'Save & Close'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
