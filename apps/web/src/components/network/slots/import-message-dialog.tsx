'use client'

import { useState } from 'react'
import { X, AlertCircle, CheckCircle } from 'lucide-react'
import { colors } from '@skyhub/ui/theme'
import { MODULE_THEMES } from '@skyhub/constants'
import { api } from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'
import { parseSlotMessage, convertParsedLineToSlotSeries } from '@skyhub/logic'
import type { ParsedSlotMessage } from '@skyhub/logic'
import { parsedSeriesToApiFormat } from './slot-types'

interface ImportMessageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  airportIata: string
  seasonCode: string
  onImported: () => void
  isDark: boolean
}

export function ImportMessageDialog({
  open,
  onOpenChange,
  airportIata,
  seasonCode,
  onImported,
  isDark,
}: ImportMessageDialogProps) {
  const palette = isDark ? colors.dark : colors.light
  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState<ParsedSlotMessage | null>(null)
  const [step, setStep] = useState<'input' | 'preview'>('input')
  const [importing, setImporting] = useState(false)

  function handleParse() {
    if (!rawText.trim()) return
    const result = parseSlotMessage(rawText)
    setParsed(result)
    setStep('preview')
  }

  async function handleImport() {
    if (!parsed) return
    setImporting(true)
    try {
      const opId = getOperatorId()

      // Save the message record
      const msgResult = await api.createSlotMessage({
        operatorId: opId,
        direction: 'inbound',
        messageType: parsed.messageType || 'SAL',
        airportIata: parsed.airportIata || airportIata,
        seasonCode: parsed.seasonCode || seasonCode,
        rawText,
        parseStatus: parsed.errors.length > 0 ? 'partial' : 'parsed',
        parseErrors: parsed.errors.length > 0 ? parsed.errors : null,
        parsedSeriesCount: parsed.dataLines.length,
        reference: parsed.replyRef,
      })

      // Convert each parsed line to a slot series and create
      for (const line of parsed.dataLines) {
        const snakeSeries = convertParsedLineToSlotSeries(
          line,
          parsed.airportIata || airportIata,
          parsed.seasonCode || seasonCode,
          opId,
        )
        const camelSeries = parsedSeriesToApiFormat(snakeSeries as Record<string, unknown>)
        await api.createSlotSeries({
          ...camelSeries,
          operatorId: opId,
        })

        // Log the action
        if (line.actionCode) {
          const isAirline = ['N', 'Y', 'B', 'V', 'F', 'C', 'M', 'R', 'L', 'I', 'D', 'A', 'P', 'Z'].includes(
            line.actionCode,
          )
          await api.logSlotAction({
            seriesId: '', // Will be set after creation in a future iteration
            actionCode: line.actionCode,
            actionSource: isAirline ? 'airline' : 'coordinator',
            messageId: msgResult.id,
          })
        }
      }

      onImported()
      onOpenChange(false)
    } finally {
      setImporting(false)
    }
  }

  if (!open) return null

  const glassBg = isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.95)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="w-[680px] max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(24px)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${glassBorder}` }}
        >
          <h2 className="text-[16px] font-semibold" style={{ color: palette.text }}>
            Import Slot Message
          </h2>
          <button type="button" onClick={() => onOpenChange(false)} className="p-1 rounded-md hover:opacity-70">
            <X size={16} style={{ color: palette.textSecondary }} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 'input' ? (
            <div>
              <label className="text-[13px] font-medium mb-2 block" style={{ color: palette.textSecondary }}>
                Paste SCR/SAL/SHL message text
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`SCR\n/CREATOR-REF\nS26\n22MAR\nSGN\nNVJ301 VJ302 29MAR24OCT 1234567 284320 ICN0615 0730ICN JJ`}
                rows={12}
                className="w-full rounded-xl p-4 text-[13px] font-mono resize-none outline-none"
                style={{
                  background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
                  border: `1px solid ${glassBorder}`,
                  color: palette.text,
                }}
              />
            </div>
          ) : parsed ? (
            <div className="space-y-4">
              {/* Parse summary */}
              <div className="flex items-center gap-3 text-[13px]">
                {parsed.errors.filter((e) => e.severity === 'error').length === 0 ? (
                  <CheckCircle size={16} style={{ color: '#06C270' }} />
                ) : (
                  <AlertCircle size={16} style={{ color: '#FF8800' }} />
                )}
                <span style={{ color: palette.text }}>
                  {parsed.dataLines.length} series parsed from {parsed.messageType || 'message'}
                </span>
                {parsed.errors.length > 0 && (
                  <span style={{ color: '#FF8800' }}>
                    ({parsed.errors.length} warning{parsed.errors.length !== 1 ? 's' : ''})
                  </span>
                )}
              </div>

              {/* Header info */}
              <div className="grid grid-cols-3 gap-3 text-[13px]">
                <div>
                  <span style={{ color: palette.textSecondary }}>Type: </span>
                  <span className="font-mono" style={{ color: palette.text }}>
                    {parsed.messageType}
                  </span>
                </div>
                <div>
                  <span style={{ color: palette.textSecondary }}>Season: </span>
                  <span className="font-mono" style={{ color: palette.text }}>
                    {parsed.seasonCode}
                  </span>
                </div>
                <div>
                  <span style={{ color: palette.textSecondary }}>Airport: </span>
                  <span className="font-mono" style={{ color: palette.text }}>
                    {parsed.airportIata}
                  </span>
                </div>
              </div>

              {/* Parsed lines preview */}
              <div className="space-y-1">
                {parsed.dataLines.map((line, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-[13px] px-3 py-2 rounded-lg"
                    style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
                  >
                    <span className="font-mono font-bold w-4" style={{ color: MODULE_THEMES.network.accent }}>
                      {line.actionCode}
                    </span>
                    <span className="font-mono" style={{ color: palette.text }}>
                      {line.arrivalFlight || ''}
                      {line.departureFlight ? ` / ${line.departureFlight}` : ''}
                    </span>
                    <span style={{ color: palette.textSecondary }}>
                      {line.periodStart}\u2013{line.periodEnd}
                    </span>
                    <span className="font-mono" style={{ color: palette.textSecondary }}>
                      {line.daysOfOperation}
                    </span>
                  </div>
                ))}
              </div>

              {/* Errors */}
              {parsed.errors.length > 0 && (
                <div className="space-y-1">
                  {parsed.errors.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-[13px]">
                      <AlertCircle
                        size={14}
                        className="shrink-0 mt-0.5"
                        style={{ color: e.severity === 'error' ? '#FF3B3B' : '#FF8800' }}
                      />
                      <span style={{ color: palette.textSecondary }}>
                        Line {e.line}: {e.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex justify-between px-5 py-4 shrink-0" style={{ borderTop: `1px solid ${glassBorder}` }}>
          {step === 'preview' ? (
            <button
              type="button"
              onClick={() => setStep('input')}
              className="h-9 px-4 rounded-xl text-[13px] font-medium"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                color: palette.text,
                border: `1px solid ${glassBorder}`,
              }}
            >
              Back
            </button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 rounded-xl text-[13px] font-medium"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                color: palette.text,
                border: `1px solid ${glassBorder}`,
              }}
            >
              Cancel
            </button>
            {step === 'input' ? (
              <button
                type="button"
                onClick={handleParse}
                disabled={!rawText.trim()}
                className="h-9 px-4 rounded-xl text-[13px] font-medium disabled:opacity-50"
                style={{ background: MODULE_THEMES.network.accent, color: '#fff' }}
              >
                Parse Message
              </button>
            ) : (
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || !parsed?.dataLines.length}
                className="h-9 px-4 rounded-xl text-[13px] font-medium disabled:opacity-50"
                style={{ background: '#06C270', color: '#fff' }}
              >
                {importing ? 'Importing...' : `Import ${parsed?.dataLines.length || 0} Series`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
