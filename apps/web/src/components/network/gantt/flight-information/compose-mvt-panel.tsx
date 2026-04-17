'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronUp, Send, Plus, X, Loader2, Check, AlertTriangle } from 'lucide-react'
import type { FlightDetail } from '@/lib/gantt/flight-detail-types'
import { useTheme } from '@/components/theme-provider'
import { useOperatorStore } from '@/stores/use-operator-store'
import { useDelayCodes, useCreateMovementMessage } from '@skyhub/api/src/hooks'
import type { DelayCodeRef, CreateMovementMessageInput, MvtDelayInput, DuplicateHeldExisting } from '@skyhub/api'
import { encodeMvtMessage } from '@skyhub/logic/src/iata/index'

type ActionCode = 'AD' | 'AA' | 'ED' | 'EA' | 'NI' | 'RR' | 'FR'

interface Props {
  data: FlightDetail
  onClose: () => void
  onSent: () => void
}

const ACTION_OPTIONS: Array<{ code: ActionCode; label: string; desc: string }> = [
  { code: 'ED', label: 'ED', desc: 'Estimated Departure' },
  { code: 'AD', label: 'AD', desc: 'Actual Departure' },
  { code: 'EA', label: 'EA', desc: 'Estimated Arrival' },
  { code: 'AA', label: 'AA', desc: 'Actual Arrival' },
  { code: 'NI', label: 'NI', desc: 'Next Information' },
  { code: 'RR', label: 'RR', desc: 'Return to Ramp' },
  { code: 'FR', label: 'FR', desc: 'Forced Return' },
]

function msToHHMM(ms: number | null): string {
  if (!ms) return ''
  const d = new Date(ms)
  return `${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function minutesToHHMM(m: number): string {
  if (m <= 0) return ''
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}${String(mm).padStart(2, '0')}`
}

function defaultActionFor(data: FlightDetail): ActionCode {
  if (data.actual.ataUtc) return 'AA'
  if (data.actual.atdUtc && !data.actual.onUtc) return 'AD'
  if (data.estimated.etaUtc) return 'EA'
  return 'ED'
}

interface DraftDelay {
  /** Primary code displayed in composer. For AHM 730: numeric code "81". For AHM 732: derived from triple */
  code: string
  duration: string
  process: string
  reason: string
  stakeholder: string
}

export function ComposeMvtPanel({ data, onClose, onSent }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const operator = useOperatorStore((s) => s.operator)
  const standard: 'ahm730' | 'ahm732' = operator?.delayCodeAdherence === 'ahm732' ? 'ahm732' : 'ahm730'
  const accent = operator?.accentColor ?? '#1e40af'

  const delayCodesQuery = useDelayCodes(operator?._id ?? '')
  const create = useCreateMovementMessage()

  // Single time-bundle reducer — six individual useStates collapsed into one to stay
  // under the 8-hook ceiling (CLAUDE.md Rule 11).
  const [times, setTimes] = useState({
    offBlocks: msToHHMM(data.actual.atdUtc),
    airborne: msToHHMM(data.actual.offUtc),
    touchdown: msToHHMM(data.actual.onUtc),
    onBlocks: msToHHMM(data.actual.ataUtc),
    estDeparture: msToHHMM(data.estimated.etdUtc),
    estArrival: msToHHMM(data.estimated.etaUtc),
  })
  const patchTime = (key: keyof typeof times, value: string) => setTimes((prev) => ({ ...prev, [key]: value }))
  const { offBlocks, airborne, touchdown, onBlocks, estDeparture, estArrival } = times

  const [actionCode, setActionCode] = useState<ActionCode>(defaultActionFor(data))
  const [siText, setSiText] = useState('')
  const [recipients, setRecipients] = useState<string[]>([])
  const [recipientInput, setRecipientInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<DuplicateHeldExisting | null>(null)

  // Pre-populate delays from flight.delays[]
  const [delays, setDelays] = useState<DraftDelay[]>(() =>
    data.delays.map((d) => ({
      code: d.code,
      duration: minutesToHHMM(d.minutes),
      process: d.code.length >= 3 ? d.code.charAt(0) : '',
      reason: d.code.length >= 3 ? d.code.charAt(1) : '',
      stakeholder: d.code.length >= 3 ? d.code.charAt(2) : '',
    })),
  )

  // Build lookup tables for delay pickers
  const codes730 = useMemo(() => (delayCodesQuery.data ?? []).filter((c) => c.isActive), [delayCodesQuery.data])
  const processCodes = useMemo(() => uniqueTriples(codes730, 'ahm732Process'), [codes730])
  const reasonCodes = useMemo(() => uniqueTriples(codes730, 'ahm732Reason'), [codes730])
  const stakeholderCodes = useMemo(() => uniqueTriples(codes730, 'ahm732Stakeholder'), [codes730])

  // Live telex preview
  const preview = useMemo(() => {
    const airline = (operator?.iataCode || data.airlineCode || '').toUpperCase()
    const flightDigits = data.flightNumber.replace(/^[A-Z]{2,3}/i, '')
    const dayOfMonth = (data.operatingDate ?? '').slice(8, 10) || '01'
    const station = actionCode === 'AA' || actionCode === 'FR' ? data.arrStation : data.depStation

    const delayInputs: MvtDelayInput[] = delays
      .filter((d) => d.duration || d.code)
      .map((d) => ({
        code: standard === 'ahm732' ? `${d.process || '?'}${d.reason || '?'}${d.stakeholder || '?'}` : d.code,
        duration: d.duration || undefined,
        ahm732:
          standard === 'ahm732'
            ? { process: d.process || '?', reason: d.reason || '?', stakeholder: d.stakeholder || '?' }
            : undefined,
      }))

    try {
      return encodeMvtMessage({
        flightId: {
          airline: airline.toUpperCase(),
          flightNumber: flightDigits,
          dayOfMonth,
          registration: (data.aircraftReg ?? '').replace(/-/g, '').toUpperCase(),
          station: (station ?? '').toUpperCase(),
        },
        actionCode,
        offBlocks: actionCode === 'AD' || actionCode === 'RR' ? offBlocks : undefined,
        airborne: actionCode === 'AD' ? airborne : undefined,
        touchdown: actionCode === 'AA' || actionCode === 'FR' ? touchdown : undefined,
        onBlocks: actionCode === 'AA' || actionCode === 'FR' ? onBlocks : undefined,
        estimatedDeparture: actionCode === 'ED' ? estDeparture : undefined,
        etas: actionCode === 'EA' && estArrival ? [{ time: estArrival, destination: data.arrStation }] : undefined,
        delayStandard: standard,
        delays: delayInputs,
        supplementaryInfo: siText ? [siText] : undefined,
      })
    } catch {
      return '(invalid input — fix the highlighted fields)'
    }
  }, [data, actionCode, offBlocks, airborne, touchdown, onBlocks, estDeparture, estArrival, delays, siText, standard])

  const handleAddDelay = () => {
    setDelays((prev) => [...prev, { code: '', duration: '', process: '', reason: '', stakeholder: '' }])
  }

  const handleRemoveDelay = (i: number) => {
    setDelays((prev) => prev.filter((_, idx) => idx !== i))
  }

  const handleDelayField = (i: number, field: keyof DraftDelay, value: string) => {
    setDelays((prev) =>
      prev.map((d, idx) => {
        if (idx !== i) return d
        const next = { ...d, [field]: value }
        if (standard === 'ahm732' && (field === 'process' || field === 'reason' || field === 'stakeholder')) {
          next.code = `${next.process}${next.reason}${next.stakeholder}`.toUpperCase()
        }
        return next
      }),
    )
  }

  const handleAddRecipient = () => {
    const v = recipientInput.trim().toUpperCase()
    if (!v || recipients.includes(v)) return
    if (!/^[A-Z0-9]{7}$/.test(v)) {
      setError('Recipient must be a 7-character IATA Type B address')
      return
    }
    setRecipients((prev) => [...prev, v])
    setRecipientInput('')
    setError(null)
  }

  const buildPayload = (): CreateMovementMessageInput | null => {
    if (!data.id) return null
    return {
      flightInstanceId: data.id,
      actionCode,
      offBlocks: actionCode === 'AD' || actionCode === 'RR' ? offBlocks || undefined : undefined,
      airborne: actionCode === 'AD' ? airborne || undefined : undefined,
      touchdown: actionCode === 'AA' || actionCode === 'FR' ? touchdown || undefined : undefined,
      onBlocks: actionCode === 'AA' || actionCode === 'FR' ? onBlocks || undefined : undefined,
      estimatedDeparture: actionCode === 'ED' ? estDeparture || undefined : undefined,
      etas: actionCode === 'EA' && estArrival ? [{ time: estArrival, destination: data.arrStation }] : undefined,
      delays: delays
        .filter((d) => d.duration && (standard === 'ahm730' ? d.code : d.process && d.reason && d.stakeholder))
        .map((d) => ({
          code: standard === 'ahm732' ? `${d.process}${d.reason}${d.stakeholder}`.toUpperCase() : d.code,
          duration: d.duration,
          ahm732:
            standard === 'ahm732' ? { process: d.process, reason: d.reason, stakeholder: d.stakeholder } : undefined,
        })),
      supplementaryInfo: siText ? [siText] : undefined,
      recipients,
    }
  }

  const submit = async (extra: Partial<CreateMovementMessageInput>) => {
    const base = buildPayload()
    if (!base) {
      setError('Flight has no instance — cannot send')
      return
    }
    setError(null)
    try {
      const result = await create.mutateAsync({ ...base, ...extra })
      if (!result.ok) {
        setConflict(result.conflict)
        return
      }
      setConflict(null)
      onSent()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed')
    }
  }

  const handleSend = () => submit({})
  const handleReplaceExisting = () => (conflict ? submit({ replaceExistingId: conflict._id }) : undefined)
  const handleKeepBoth = () => submit({ allowDuplicate: true })
  const handleDismissConflict = () => setConflict(null)

  const isArrivalAction = actionCode === 'AA' || actionCode === 'FR'
  const isDepartureAction = actionCode === 'AD' || actionCode === 'RR'
  const panelBg = isDark ? 'rgba(25,25,33,0.92)' : 'rgba(255,255,255,0.96)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : '#fff'
  const inputBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'
  const mutedBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  return (
    <div
      className="rounded-2xl mb-4 overflow-hidden"
      style={{ background: panelBg, border: `1px solid ${panelBorder}`, boxShadow: '0 12px 32px rgba(0,0,0,0.16)' }}
    >
      <div className="flex items-center gap-2 px-5 h-11 border-b" style={{ borderColor: mutedBorder }}>
        <div className="w-[3px] h-5 rounded-full" style={{ background: accent }} />
        <span className="text-[14px] font-semibold text-hz-text">Compose MVT</span>
        <span className="text-[13px] text-hz-text-tertiary">
          · {standard === 'ahm732' ? 'AHM 732 Triple-A' : 'AHM 730/731'}
        </span>
        <button
          onClick={onClose}
          className="ml-auto h-8 w-8 rounded-lg flex items-center justify-center text-hz-text-secondary hover:bg-hz-surface-hover"
          aria-label="Collapse"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {conflict && (
        <div
          className="mx-5 mt-5 rounded-xl px-4 py-3"
          style={{
            background: 'rgba(255,136,0,0.10)',
            border: '1px solid rgba(255,136,0,0.36)',
          }}
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#FF8800' }} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold" style={{ color: '#FF8800' }}>
                A held {conflict.actionCode} already exists for this flight
              </div>
              <div className="text-[13px] text-hz-text-secondary mt-1">
                {conflict.flightNumber ?? '—'}
                {conflict.flightDate ? ` · ${conflict.flightDate}` : ''} · composed by{' '}
                <span className="font-semibold text-hz-text">{conflict.createdByName ?? 'unknown user'}</span> at{' '}
                <span className="font-mono">
                  {new Date(conflict.createdAtUtc).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              {conflict.summary && (
                <div
                  className="mt-2 rounded-md px-2.5 py-1.5 text-[13px] font-mono"
                  style={{
                    background: isDark ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.04)',
                    color: isDark ? '#D0D1DC' : '#555770',
                  }}
                >
                  {conflict.summary}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={handleReplaceExisting}
                  disabled={create.isPending}
                  className="h-8 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 transition-opacity"
                  style={{
                    background: accent,
                    color: '#fff',
                    opacity: create.isPending ? 0.6 : 1,
                  }}
                >
                  {create.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Replace existing
                </button>
                <button
                  onClick={handleKeepBoth}
                  disabled={create.isPending}
                  className="h-8 px-3 rounded-lg text-[13px] font-semibold transition-opacity"
                  style={{
                    background: `${accent}1A`,
                    color: accent,
                    border: `1px solid ${accent}40`,
                    opacity: create.isPending ? 0.6 : 1,
                  }}
                >
                  Keep both
                </button>
                <button
                  onClick={handleDismissConflict}
                  className="h-8 px-3 rounded-lg text-[13px] font-semibold text-hz-text-secondary hover:bg-hz-surface-hover"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-5 grid grid-cols-[1fr_300px] gap-5">
        {/* Left — form */}
        <div className="space-y-4 min-w-0">
          {/* Action code row */}
          <div>
            <label className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary mb-2 block">
              Action code
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ACTION_OPTIONS.map((opt) => {
                const sel = actionCode === opt.code
                return (
                  <button
                    key={opt.code}
                    onClick={() => setActionCode(opt.code)}
                    title={opt.desc}
                    className="h-8 px-3 rounded-lg text-[13px] font-mono font-semibold transition-colors"
                    style={{
                      background: sel ? accent : inputBg,
                      color: sel ? '#fff' : 'var(--hz-text)',
                      border: `1px solid ${sel ? accent : inputBorder}`,
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time inputs */}
          <div className="grid grid-cols-2 gap-3">
            {isDepartureAction && (
              <>
                <TimeField
                  label="Off blocks (HHMM)"
                  value={offBlocks}
                  onChange={(v) => patchTime('offBlocks', v)}
                  inputBg={inputBg}
                  inputBorder={inputBorder}
                />
                {actionCode === 'AD' && (
                  <TimeField
                    label="Airborne (HHMM)"
                    value={airborne}
                    onChange={(v) => patchTime('airborne', v)}
                    inputBg={inputBg}
                    inputBorder={inputBorder}
                  />
                )}
              </>
            )}
            {isArrivalAction && (
              <>
                <TimeField
                  label="Touchdown (HHMM)"
                  value={touchdown}
                  onChange={(v) => patchTime('touchdown', v)}
                  inputBg={inputBg}
                  inputBorder={inputBorder}
                />
                <TimeField
                  label="On blocks (HHMM)"
                  value={onBlocks}
                  onChange={(v) => patchTime('onBlocks', v)}
                  inputBg={inputBg}
                  inputBorder={inputBorder}
                />
              </>
            )}
            {actionCode === 'ED' && (
              <TimeField
                label="Estimated departure (HHMM)"
                value={estDeparture}
                onChange={(v) => patchTime('estDeparture', v)}
                inputBg={inputBg}
                inputBorder={inputBorder}
              />
            )}
            {actionCode === 'EA' && (
              <TimeField
                label="Estimated arrival (HHMM)"
                value={estArrival}
                onChange={(v) => patchTime('estArrival', v)}
                inputBg={inputBg}
                inputBorder={inputBorder}
              />
            )}
          </div>

          {/* Delays */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary">
                Delays ({standard === 'ahm732' ? 'Triple-A' : 'IATA code'})
              </label>
              <button
                onClick={handleAddDelay}
                className="h-7 px-2 rounded-lg text-[13px] flex items-center gap-1 text-hz-text-secondary hover:bg-hz-surface-hover"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
            {delays.length === 0 ? (
              <div
                className="rounded-lg px-3 py-3 text-[13px] text-hz-text-tertiary"
                style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
              >
                No delays. Auto-captured from flight data when present.
              </div>
            ) : (
              <div className="space-y-2">
                {delays.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {standard === 'ahm730' ? (
                      <select
                        value={d.code}
                        onChange={(e) => handleDelayField(i, 'code', e.target.value)}
                        className="h-9 px-2 rounded-lg text-[13px] outline-none text-hz-text flex-1 min-w-0"
                        style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
                      >
                        <option value="">Select code…</option>
                        {codes730.map((c) => (
                          <option key={c._id} value={c.code}>
                            {c.code} — {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <>
                        <TripleSelect
                          label="P"
                          value={d.process}
                          options={processCodes}
                          onChange={(v) => handleDelayField(i, 'process', v)}
                          inputBg={inputBg}
                          inputBorder={inputBorder}
                        />
                        <TripleSelect
                          label="R"
                          value={d.reason}
                          options={reasonCodes}
                          onChange={(v) => handleDelayField(i, 'reason', v)}
                          inputBg={inputBg}
                          inputBorder={inputBorder}
                        />
                        <TripleSelect
                          label="S"
                          value={d.stakeholder}
                          options={stakeholderCodes}
                          onChange={(v) => handleDelayField(i, 'stakeholder', v)}
                          inputBg={inputBg}
                          inputBorder={inputBorder}
                        />
                      </>
                    )}
                    <input
                      type="text"
                      value={d.duration}
                      onChange={(e) => handleDelayField(i, 'duration', e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="HHMM"
                      className="h-9 w-[80px] px-2 rounded-lg text-[13px] font-mono outline-none text-hz-text"
                      style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
                    />
                    <button
                      onClick={() => handleRemoveDelay(i)}
                      className="h-9 w-9 rounded-lg flex items-center justify-center text-hz-text-tertiary hover:bg-hz-surface-hover"
                      aria-label="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recipients */}
          <div>
            <label className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary mb-2 block">
              Recipients (Type B addresses)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {recipients.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[13px] font-mono"
                  style={{ background: `${accent}1A`, color: accent, border: `1px solid ${accent}40` }}
                >
                  {r}
                  <button
                    onClick={() => setRecipients((p) => p.filter((x) => x !== r))}
                    className="ml-1 text-hz-text-tertiary hover:text-hz-text"
                    aria-label="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleAddRecipient()}
                placeholder="e.g. HANKLVJ"
                className="flex-1 h-9 px-3 rounded-lg text-[13px] font-mono outline-none text-hz-text placeholder:text-hz-text-tertiary"
                style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
              />
              <button
                onClick={handleAddRecipient}
                className="h-9 px-3 rounded-lg text-[13px] font-semibold text-hz-text-secondary hover:bg-hz-surface-hover"
              >
                Add
              </button>
            </div>
          </div>

          {/* SI */}
          <div>
            <label className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary mb-2 block">
              Supplementary info (SI)
            </label>
            <input
              type="text"
              value={siText}
              onChange={(e) => setSiText(e.target.value.toUpperCase())}
              placeholder="e.g. ATC EN-ROUTE FLOW RESTR"
              className="w-full h-9 px-3 rounded-lg text-[13px] font-mono outline-none text-hz-text placeholder:text-hz-text-tertiary"
              style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
            />
          </div>
        </div>

        {/* Right — preview + send */}
        <div className="flex flex-col min-w-0">
          <label className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary mb-2 block">
            Telex preview
          </label>
          <pre
            className="text-[13px] font-mono whitespace-pre-wrap rounded-lg p-3 text-hz-text-secondary flex-1 overflow-auto"
            style={{
              background: isDark ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.03)',
              border: `1px solid ${inputBorder}`,
              minHeight: 160,
            }}
          >
            {preview}
          </pre>
          {error && (
            <div className="mt-2 flex items-start gap-1.5 text-[13px]" style={{ color: '#FF3B3B' }}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          <button
            onClick={handleSend}
            disabled={create.isPending}
            className="mt-3 h-10 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-opacity"
            style={{ background: accent, color: '#fff', opacity: create.isPending ? 0.6 : 1 }}
          >
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Hold for review
          </button>
          <span className="mt-2 text-[13px] text-hz-text-tertiary text-center">
            Lands in the Communication Deck under Held status.
          </span>
        </div>
      </div>
    </div>
  )
}

function TimeField({
  label,
  value,
  onChange,
  inputBg,
  inputBorder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  inputBg: string
  inputBorder: string
}) {
  return (
    <div>
      <label className="text-[13px] text-hz-text-secondary mb-1.5 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        placeholder="HHMM"
        className="w-full h-9 px-3 rounded-lg text-[13px] font-mono outline-none text-hz-text placeholder:text-hz-text-tertiary"
        style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
      />
    </div>
  )
}

function TripleSelect({
  label,
  value,
  options,
  onChange,
  inputBg,
  inputBorder,
}: {
  label: string
  value: string
  options: Array<{ key: string; name: string }>
  onChange: (v: string) => void
  inputBg: string
  inputBorder: string
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[13px] font-semibold text-hz-text-tertiary">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-[84px] px-1.5 rounded-lg text-[13px] font-mono outline-none text-hz-text"
        style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.key} · {o.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function uniqueTriples(
  codes: DelayCodeRef[],
  field: 'ahm732Process' | 'ahm732Reason' | 'ahm732Stakeholder',
): Array<{ key: string; name: string }> {
  const map = new Map<string, string>()
  for (const c of codes) {
    const v = c[field]
    if (!v) continue
    if (!map.has(v)) map.set(v, c.category || c.name)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, name]) => ({ key, name }))
}
