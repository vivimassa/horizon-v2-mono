'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapPin, Trash2 } from 'lucide-react'
import { api, type AirportRef } from '@skyhub/api'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { useDateFormat } from '@/hooks/use-date-format'
import { DialogShell, DialogCancelButton, DialogPrimaryButton } from './dialog-shell'

interface Props {
  crewIds: string[]
  fromIso: string
  toIso: string
  /** When set, the dialog edits this existing assignment instead of
   *  creating new ones; `crewIds` is ignored in that case. */
  editingId?: string
  onClose: () => void
}

/**
 * Create OR modify a temporary base assignment for one or more crew.
 *
 *   • Create mode — fired from the Shift+drag block menu. One new row
 *     per crewId is persisted in a single POST.
 *   • Modify mode — fired from a right-click on an existing band. The
 *     planner can shift the window (from/to), swap the airport, or
 *     remove the assignment entirely.
 */
export function TemporaryBaseDialog({ crewIds, fromIso, toIso, editingId, onClose }: Props) {
  const isEdit = !!editingId
  const reconcilePeriod = useCrewScheduleStore((s) => s.reconcilePeriod)
  const existing = useCrewScheduleStore((s) =>
    editingId ? (s.tempBases.find((t) => t._id === editingId) ?? null) : null,
  )
  const fmtDate = useDateFormat()

  const [fromDraft, setFromDraft] = useState(existing?.fromIso ?? fromIso)
  const [toDraft, setToDraft] = useState(existing?.toIso ?? toIso)
  const [query, setQuery] = useState(existing?.airportCode ?? '')
  const [results, setResults] = useState<AirportRef[]>([])
  const [picked, setPicked] = useState<AirportRef | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    const handle = window.setTimeout(async () => {
      try {
        const res = await api.getAirports({ search: q })
        if (!cancelled) setResults(res.slice(0, 10))
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [query])

  const freeTextIata = useMemo(() => {
    const up = query.trim().toUpperCase()
    return /^[A-Z]{3}$/.test(up) ? up : null
  }, [query])

  const effectiveCode = (picked?.iataCode ?? freeTextIata ?? '').toUpperCase()
  const validRange = fromDraft && toDraft && fromDraft <= toDraft
  const canSubmit = effectiveCode.length === 3 && validRange && !busy

  const onSubmit = async () => {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      if (isEdit && editingId) {
        await api.patchCrewTempBase(editingId, {
          fromIso: fromDraft,
          toIso: toDraft,
          airportCode: effectiveCode,
        })
      } else {
        await api.createCrewTempBases(
          crewIds.map((crewId) => ({
            crewId,
            fromIso: fromDraft,
            toIso: toDraft,
            airportCode: effectiveCode,
          })),
        )
      }
      await reconcilePeriod()
      onClose()
    } catch (e) {
      setError((e as Error).message || 'Failed to save temporary base')
      setBusy(false)
    }
  }

  const onRemove = async () => {
    if (!editingId) return
    setBusy(true)
    setError(null)
    try {
      await api.deleteCrewTempBase(editingId)
      await reconcilePeriod()
      onClose()
    } catch (e) {
      setError((e as Error).message || 'Failed to remove temporary base')
      setBusy(false)
    }
  }

  const title = isEdit ? 'Modify Temp Assignment' : 'Temporary Base Assignment'

  return (
    <DialogShell
      title={title}
      onClose={onClose}
      width={520}
      footer={
        <>
          {isEdit && (
            <button
              onClick={onRemove}
              disabled={busy}
              className="mr-auto h-9 px-3 rounded-lg text-[13px] font-medium flex items-center gap-1.5 hover:bg-white/10 disabled:opacity-50"
              style={{ color: '#E63535' }}
            >
              <Trash2 className="w-4 h-4" />
              Remove
            </button>
          )}
          <DialogCancelButton onClick={onClose} disabled={busy} />
          <DialogPrimaryButton onClick={onSubmit} label={isEdit ? 'Save' : 'Assign'} disabled={!canSubmit} />
        </>
      }
    >
      <div className="space-y-3">
        {!isEdit && (
          <div className="text-[13px] text-hz-text-tertiary">
            Temporarily re-bases {crewIds.length === 1 ? 'the selected crew' : `${crewIds.length} crew`} to the chosen
            airport. Pairings operating out of this airport during the period will not raise a base-mismatch warning.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <div className="text-[12px] font-medium text-hz-text-secondary mb-1">From</div>
            <input
              type="date"
              value={fromDraft}
              onChange={(e) => setFromDraft(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-[14px] outline-none"
              style={{
                background: 'rgba(142,142,160,0.12)',
                border: '1px solid rgba(142,142,160,0.3)',
              }}
            />
          </label>
          <label className="block">
            <div className="text-[12px] font-medium text-hz-text-secondary mb-1">To</div>
            <input
              type="date"
              value={toDraft}
              onChange={(e) => setToDraft(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-[14px] outline-none"
              style={{
                background: 'rgba(142,142,160,0.12)',
                border: '1px solid rgba(142,142,160,0.3)',
              }}
            />
          </label>
        </div>
        {!validRange && (
          <div className="text-[12px]" style={{ color: '#E63535' }}>
            “From” must be on or before “To”.
          </div>
        )}

        <label className="block">
          <div className="text-[12px] font-medium text-hz-text-secondary mb-1">Airport (IATA)</div>
          <div className="relative">
            <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-hz-text-tertiary" aria-hidden />
            <input
              autoFocus={!isEdit}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPicked(null)
              }}
              placeholder="Search by IATA, city, or name (e.g. CXR, Da Nang)"
              maxLength={64}
              className="w-full h-10 pl-9 pr-3 rounded-lg text-[14px] outline-none"
              style={{
                background: 'rgba(142,142,160,0.12)',
                border: '1px solid rgba(142,142,160,0.3)',
              }}
            />
          </div>
        </label>

        {results.length > 0 && (
          <div className="rounded-lg max-h-60 overflow-y-auto" style={{ border: '1px solid rgba(142,142,160,0.25)' }}>
            {results.map((a) => {
              const isActive = picked?._id === a._id
              return (
                <button
                  key={a._id}
                  onClick={() => {
                    setPicked(a)
                    setQuery(a.iataCode ?? a.icaoCode)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5"
                  style={{
                    backgroundColor: isActive ? 'rgba(62,123,250,0.08)' : undefined,
                  }}
                >
                  <span
                    className="text-[13px] font-semibold tabular-nums w-10 shrink-0"
                    style={{ color: isActive ? 'var(--module-accent)' : undefined }}
                  >
                    {a.iataCode ?? a.icaoCode}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-[13px]">{a.name}</span>
                  {a.city && <span className="text-[12px] text-hz-text-tertiary">{a.city}</span>}
                </button>
              )
            })}
          </div>
        )}

        {loading && <div className="text-[12px] text-hz-text-tertiary">Searching…</div>}

        {!loading && query.trim().length >= 2 && results.length === 0 && freeTextIata && (
          <div className="text-[12px] text-hz-text-tertiary">
            No airport matched — will save free-text code <span className="font-semibold">{freeTextIata}</span>.
          </div>
        )}

        {isEdit && existing && (
          <div className="text-[12px] text-hz-text-tertiary">
            Current window: {fmtDate(existing.fromIso)} → {fmtDate(existing.toIso)} · {existing.airportCode}
          </div>
        )}

        {error && (
          <div className="text-[12px]" style={{ color: '#E63535' }}>
            {error}
          </div>
        )}
      </div>
    </DialogShell>
  )
}
