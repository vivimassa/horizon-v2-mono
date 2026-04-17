'use client'

import { useState } from 'react'
import { X, Loader2, Check, AlertTriangle } from 'lucide-react'
import { useParseInboundTelex, useApplyInboundMvtMessage } from '@skyhub/api/src/hooks'
import type { ParseInboundResult } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'

interface Props {
  open: boolean
  accentColor: string
  onClose: () => void
  onApplied: () => void
}

// Tenant scoping happens server-side via JWT — no operatorId required on the client.
export function PasteToApplyModal({ open, accentColor, onClose, onApplied }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [rawMessage, setRawMessage] = useState('')
  const [preview, setPreview] = useState<ParseInboundResult | null>(null)
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null)
  const parseMutation = useParseInboundTelex()
  const applyMutation = useApplyInboundMvtMessage()

  if (!open) return null

  const handleParse = async () => {
    if (!rawMessage.trim()) return
    const res = await parseMutation.mutateAsync(rawMessage.trim())
    setPreview(res)
    setSelectedFlightId(res.candidateFlights[0]?._id ?? null)
  }

  const handleApply = async () => {
    if (!selectedFlightId) return
    await applyMutation.mutateAsync({ rawMessage: rawMessage.trim(), flightInstanceId: selectedFlightId })
    setRawMessage('')
    setPreview(null)
    setSelectedFlightId(null)
    onApplied()
    onClose()
  }

  const canApply = preview && preview.type === 'MVT' && selectedFlightId

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[720px] max-h-[88vh] rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: isDark ? '#191921' : '#FFFFFF',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.32)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-5 py-4 border-b"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
        >
          <div className="w-[3px] h-5 rounded-full" style={{ background: accentColor }} />
          <span className="text-[15px] font-semibold text-hz-text">Paste inbound telex</span>
          <button
            onClick={onClose}
            className="ml-auto h-8 w-8 rounded-lg flex items-center justify-center hover:bg-hz-surface-hover text-hz-text-secondary"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary mb-2 block">
              Raw MVT or LDM message
            </label>
            <textarea
              value={rawMessage}
              onChange={(e) => {
                setRawMessage(e.target.value)
                setPreview(null)
              }}
              rows={10}
              placeholder={`MVT\nVJ123/15.VNA321.SGN\nAD0810/0830\nDL81/0045\nSI NIL\n=`}
              className="w-full rounded-xl font-mono text-[13px] p-3 outline-none text-hz-text placeholder:text-hz-text-tertiary"
              style={{
                background: isDark ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleParse}
              disabled={!rawMessage.trim() || parseMutation.isPending}
              className="h-9 px-4 rounded-xl text-[13px] font-semibold flex items-center gap-2 transition-opacity"
              style={{
                background: `${accentColor}1A`,
                color: accentColor,
                border: `1px solid ${accentColor}40`,
                opacity: !rawMessage.trim() || parseMutation.isPending ? 0.4 : 1,
              }}
            >
              {parseMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Parse preview
            </button>
            {preview && preview.type !== 'UNKNOWN' && (
              <span className="text-[13px] text-hz-text-secondary flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" style={{ color: '#06C270' }} />
                Parsed as {preview.type}
              </span>
            )}
            {preview && preview.type === 'UNKNOWN' && (
              <span className="text-[13px] flex items-center gap-1.5" style={{ color: '#FF3B3B' }}>
                <AlertTriangle className="w-3.5 h-3.5" />
                Could not parse: {preview.error}
              </span>
            )}
          </div>

          {preview && preview.type !== 'UNKNOWN' && (
            <div>
              <label className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary mb-2 block">
                Candidate flights
              </label>
              {preview.candidateFlights.length === 0 ? (
                <div
                  className="rounded-lg px-3 py-3 text-[13px] text-hz-text-tertiary"
                  style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                >
                  No flight found for this message. Check the flight number and day.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {preview.candidateFlights.map((f) => {
                    const selected = f._id === selectedFlightId
                    return (
                      <button
                        key={f._id}
                        onClick={() => setSelectedFlightId(f._id)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors"
                        style={{
                          background: selected
                            ? `${accentColor}14`
                            : isDark
                              ? 'rgba(255,255,255,0.03)'
                              : 'rgba(0,0,0,0.03)',
                          border: `1px solid ${selected ? accentColor : 'transparent'}`,
                        }}
                      >
                        <span className="text-[13px] font-mono font-semibold text-hz-text">{f.flightNumber}</span>
                        <span className="text-[13px] font-mono text-hz-text-secondary">
                          {f.dep?.iata ?? f.dep?.icao ?? '?'}–{f.arr?.iata ?? f.arr?.icao ?? '?'}
                        </span>
                        <span className="ml-auto text-[13px] text-hz-text-tertiary">{f.operatingDate}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-4 border-t"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
        >
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-xl text-[13px] font-semibold text-hz-text-secondary hover:bg-hz-surface-hover"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!canApply || applyMutation.isPending}
            className="h-9 px-4 rounded-xl text-[13px] font-semibold flex items-center gap-2 transition-opacity"
            style={{
              background: accentColor,
              color: '#fff',
              opacity: !canApply || applyMutation.isPending ? 0.4 : 1,
            }}
          >
            {applyMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Apply to flight
          </button>
        </div>
      </div>
    </div>
  )
}
