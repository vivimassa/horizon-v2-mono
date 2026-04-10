"use client"

import { useState, useCallback } from 'react'
import { Inbox, FileText, CheckCircle, XCircle, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { parseAsmMessage, ACTION_LABELS } from '@skyhub/logic'
import { api } from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'
import type { AsmParsed } from '@skyhub/types'

interface ReceivePanelProps {
  operatorIataCode: string
  onApplied: () => void
}

type Step = 'paste' | 'review' | 'done'

export function ReceivePanel({ operatorIataCode, onApplied }: ReceivePanelProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState<AsmParsed | null>(null)
  const [step, setStep] = useState<Step>('paste')
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'
  const sectionBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  const handleParse = useCallback(() => {
    if (!rawText.trim()) return
    const p = parseAsmMessage(rawText)
    setParsed(p)
    setStep('review')
    setResult(null)
  }, [rawText])

  const handleApply = useCallback(async () => {
    if (!parsed || parsed.errors.length > 0) return
    const opId = getOperatorId()
    if (!opId) return

    setApplying(true)
    try {
      // Create message log entry
      const { id } = await api.createScheduleMessage({
        operatorId: opId,
        messageType: parsed.messageType,
        actionCode: parsed.actionCode,
        direction: 'inbound',
        status: 'pending',
        flightNumber: parsed.flightNumber || null,
        flightDate: parsed.flightDate || null,
        summary: `${ACTION_LABELS[parsed.actionCode] || parsed.actionCode}: ${parsed.flightNumber} on ${parsed.flightDate}`,
        rawMessage: parsed.rawMessage,
        changes: parsed.changes,
      })

      // Apply to flight instances
      await api.applyInboundMessage({
        messageId: id,
        actionCode: parsed.actionCode,
        flightNumber: parsed.flightNumber,
        flightDate: parsed.flightDate,
        changes: parsed.changes,
      })

      setResult({ ok: true, message: `Applied ${ACTION_LABELS[parsed.actionCode] || parsed.actionCode} to ${parsed.flightNumber} on ${parsed.flightDate}` })
      setStep('done')
      onApplied()
    } catch (err: any) {
      setResult({ ok: false, message: err?.message || 'Failed to apply message' })
    } finally {
      setApplying(false)
    }
  }, [parsed, onApplied])

  const handleReject = useCallback(async () => {
    if (!parsed) return
    const opId = getOperatorId()
    if (!opId) return

    setApplying(true)
    try {
      await api.createScheduleMessage({
        operatorId: opId,
        messageType: parsed.messageType,
        actionCode: parsed.actionCode,
        direction: 'inbound',
        status: 'rejected',
        flightNumber: parsed.flightNumber || null,
        flightDate: parsed.flightDate || null,
        summary: `${ACTION_LABELS[parsed.actionCode] || parsed.actionCode}: ${parsed.flightNumber} on ${parsed.flightDate}`,
        rawMessage: parsed.rawMessage,
        changes: parsed.changes,
      })

      setResult({ ok: true, message: 'Message rejected and logged' })
      setStep('done')
      onApplied()
    } catch (err: any) {
      setResult({ ok: false, message: err?.message || 'Failed to reject message' })
    } finally {
      setApplying(false)
    }
  }, [parsed, onApplied])

  const handleReset = useCallback(() => {
    setRawText('')
    setParsed(null)
    setStep('paste')
    setResult(null)
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-5" style={{ height: 44, borderBottom: `1px solid ${sectionBorder}` }}>
        <Inbox size={14} className="text-module-accent" />
        <span className="text-[14px] font-bold">Receive Inbound ASM / SSM</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        {/* Step 1: Paste */}
        {step === 'paste' && (
          <div className="space-y-4 max-w-2xl">
            <p className="text-[13px] text-hz-text-secondary">
              Paste a raw ASM or SSM message below. The parser supports IATA SSIM Chapter 4/5 format.
            </p>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={'ASM\nUTC\nTIM\nVJ301/22MAR\nJ 320\nSGN0615 ICN1430'}
              rows={10}
              className="w-full rounded-xl px-4 py-3 text-[13px] font-mono outline-none resize-none"
              style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
            />
            <button
              onClick={handleParse}
              disabled={!rawText.trim()}
              className="h-10 px-6 rounded-xl text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 disabled:opacity-40 transition-colors flex items-center gap-2"
            >
              <FileText size={15} />
              Parse Message
            </button>
          </div>
        )}

        {/* Step 2: Review */}
        {step === 'review' && parsed && (
          <div className="space-y-5 max-w-2xl">
            {/* Parse errors */}
            {parsed.errors.length > 0 && (
              <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'rgba(255,59,59,0.08)', border: '1px solid rgba(255,59,59,0.2)' }}>
                <AlertTriangle size={16} className="text-[#FF3B3B] shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-semibold text-[#FF3B3B] mb-1">Parse Errors</p>
                  {parsed.errors.map((e, i) => (
                    <p key={i} className="text-[13px] text-hz-text-secondary">{e}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Parsed summary */}
            <div className="rounded-xl p-4" style={{ background: inputBg, border: `1px solid ${inputBorder}` }}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Message Type" value={parsed.messageType} />
                <Field label="Action Code" value={`${parsed.actionCode} — ${ACTION_LABELS[parsed.actionCode] || 'Unknown'}`} />
                <Field label="Flight" value={parsed.flightNumber || '—'} />
                <Field label="Date" value={parsed.flightDate || '—'} />
                <Field label="Airline" value={parsed.airline || '—'} />
              </div>
            </div>

            {/* Changes */}
            {Object.keys(parsed.changes).length > 0 && (
              <div>
                <h3 className="text-[13px] font-semibold text-hz-text-secondary mb-2">Detected Changes</h3>
                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${inputBorder}` }}>
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${sectionBorder}` }}>
                        <th className="text-left px-4 py-2 text-[13px] font-medium text-hz-text-tertiary uppercase">Field</th>
                        <th className="text-left px-4 py-2 text-[13px] font-medium text-hz-text-tertiary uppercase">From</th>
                        <th className="text-center px-2 py-2 w-8" />
                        <th className="text-left px-4 py-2 text-[13px] font-medium text-hz-text-tertiary uppercase">To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(parsed.changes).map(([field, ch]) => (
                        <tr key={field} style={{ borderBottom: `1px solid ${sectionBorder}` }}>
                          <td className="px-4 py-2 text-[13px] font-medium">{FIELD_LABELS[field] || field}</td>
                          <td className="px-4 py-2 text-[13px] font-mono text-hz-text-secondary">{ch.from || '—'}</td>
                          <td className="px-2 py-2 text-center"><ArrowRight size={13} className="text-hz-text-tertiary" /></td>
                          <td className="px-4 py-2 text-[13px] font-mono font-semibold">{ch.to}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Raw message */}
            <div>
              <h3 className="text-[13px] font-semibold text-hz-text-secondary mb-2">Raw Message</h3>
              <pre
                className="rounded-xl px-4 py-3 text-[13px] font-mono whitespace-pre-wrap"
                style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
              >
                {parsed.rawMessage}
              </pre>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {parsed.errors.length === 0 && (
                <button
                  onClick={handleApply}
                  disabled={applying}
                  className="h-10 px-6 rounded-xl text-[13px] font-semibold text-white transition-colors flex items-center gap-2 disabled:opacity-50"
                  style={{ background: '#06C270' }}
                >
                  {applying ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                  Apply to Schedule
                </button>
              )}
              <button
                onClick={handleReject}
                disabled={applying}
                className="h-10 px-6 rounded-xl text-[13px] font-semibold text-white transition-colors flex items-center gap-2 disabled:opacity-50"
                style={{ background: '#E63535' }}
              >
                <XCircle size={15} />
                Reject
              </button>
              <button
                onClick={handleReset}
                className="h-10 px-6 rounded-xl text-[13px] font-semibold text-hz-text-secondary border border-hz-border hover:bg-hz-border/30 transition-colors"
              >
                Start Over
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 'done' && result && (
          <div className="space-y-4 max-w-2xl">
            <div
              className="rounded-xl p-4 flex items-start gap-3"
              style={{
                background: result.ok ? 'rgba(6,194,112,0.08)' : 'rgba(255,59,59,0.08)',
                border: `1px solid ${result.ok ? 'rgba(6,194,112,0.2)' : 'rgba(255,59,59,0.2)'}`,
              }}
            >
              {result.ok
                ? <CheckCircle size={16} className="text-[#06C270] shrink-0 mt-0.5" />
                : <XCircle size={16} className="text-[#FF3B3B] shrink-0 mt-0.5" />}
              <p className="text-[13px] font-medium">{result.message}</p>
            </div>
            <button
              onClick={handleReset}
              className="h-10 px-6 rounded-xl text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 transition-colors"
            >
              Process Another Message
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[13px] text-hz-text-tertiary font-medium block mb-0.5">{label}</span>
      <span className="text-[13px] font-semibold">{value}</span>
    </div>
  )
}

const FIELD_LABELS: Record<string, string> = {
  dep_station: 'Departure',
  arr_station: 'Arrival',
  std: 'STD (UTC)',
  sta: 'STA (UTC)',
  aircraft_type: 'Aircraft Type',
  service_type: 'Service Type',
  departure_iata: 'Departure',
  arrival_iata: 'Arrival',
}
