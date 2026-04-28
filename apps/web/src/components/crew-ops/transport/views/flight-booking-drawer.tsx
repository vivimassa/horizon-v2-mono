'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Save, X, Upload, Trash2, FileText, Image as ImageIcon, PlaneTakeoff, ChevronDown } from 'lucide-react'
import {
  api,
  type CarrierCodeRef,
  type CrewFlightAttachmentRef,
  type CrewFlightBookingClass,
  type CrewFlightBookingRef,
  type CrewFlightGendecPosition,
  type FlightSearchResult,
} from '@skyhub/api'
import { getOperatorId, useOperatorStore } from '@/stores/use-operator-store'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'

interface DraftLeg {
  pairingId: string
  legId: string
  pairingCode: string
  flightDate: string | null
  depStation: string | null
  arrStation: string | null
  crewIds: string[]
}

/** Temp-base positioning context. Set instead of `leg` when creating a
 *  positioning booking from the GCS Gantt's flanking-day "+". */
interface PositioningContext {
  tempBaseId: string
  direction: 'outbound' | 'return'
  crewId: string
  flightDate: string
  depStation: string
  arrStation: string
  /** Existing activities / assignments that overlap the flightDate.
   *  Surfaced as a soft warning so the planner sees they're booking on
   *  a day the crew is already doing something else (training, OFF,
   *  pairing, sick leave). Doesn't block save — HOTAC may legitimately
   *  position before/after a half-day ground duty. */
  conflicts?: Array<{ kind: 'activity' | 'pairing'; label: string; window: string }>
}

interface Props {
  /** When `existing` is provided we edit; otherwise we create against
   *  `leg` (pairing deadhead) or `positioning` (temp-base positioning). */
  existing: CrewFlightBookingRef | null
  leg: DraftLeg | null
  positioning?: PositioningContext | null
  onClosed: (changed: boolean) => void
}

const BOOKING_CLASSES: CrewFlightBookingClass[] = ['Y', 'J', 'F', 'C', 'W']
const GENDEC_POSITIONS: CrewFlightGendecPosition[] = ['cockpit-jumpseat', 'cabin-jumpseat', 'pax-seat']

const GENDEC_LABELS: Record<CrewFlightGendecPosition, string> = {
  'cockpit-jumpseat': 'Cockpit jumpseat',
  'cabin-jumpseat': 'Cabin jumpseat',
  'pax-seat': 'Pax seat',
}

/** In-memory cache for /flights/search responses, keyed by
 *  `${origin}|${destination}|${date}`. Lives for the page session — same
 *  route + date hits cache instantly when the planner reopens the
 *  drawer. Cleared on full reload. */
const flightSearchCache = new Map<string, FlightSearchResult[]>()

export function FlightBookingDrawer({ existing, leg, positioning, onClosed }: Props) {
  // For positioning, jumpseat is a saner default than ticket: most temp-base
  // moves happen on the operator's own metal as supernumerary crew.
  const [method, setMethod] = useState<'ticket' | 'gendec'>(existing?.method ?? (positioning ? 'gendec' : 'ticket'))
  const [carrierCode, setCarrierCode] = useState(existing?.carrierCode ?? '')
  const [flightNumber, setFlightNumber] = useState(existing?.flightNumber ?? leg?.pairingCode ?? '')
  const [flightDate, setFlightDate] = useState(existing?.flightDate ?? leg?.flightDate ?? positioning?.flightDate ?? '')
  const [depStation, setDepStation] = useState(existing?.depStation ?? leg?.depStation ?? positioning?.depStation ?? '')
  const [arrStation, setArrStation] = useState(existing?.arrStation ?? leg?.arrStation ?? positioning?.arrStation ?? '')
  const [bookingClass, setBookingClass] = useState<CrewFlightBookingClass | ''>(existing?.bookingClass ?? '')
  const [pnr, setPnr] = useState(existing?.pnr ?? '')
  const [ticketNumbers, setTicketNumbers] = useState((existing?.ticketNumbers ?? []).join(', '))
  const [fareCost, setFareCost] = useState<string>(existing?.fareCost != null ? String(existing.fareCost) : '')
  const [fareCurrency, setFareCurrency] = useState(existing?.fareCurrency ?? 'USD')
  const [gendecPosition, setGendecPosition] = useState<CrewFlightGendecPosition>(existing?.gendecPosition ?? 'pax-seat')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [attachments, setAttachments] = useState<CrewFlightAttachmentRef[]>(existing?.attachments ?? [])
  const [stdUtcMs, setStdUtcMs] = useState<number | null>(existing?.stdUtcMs ?? null)
  const [staUtcMs, setStaUtcMs] = useState<number | null>(existing?.staUtcMs ?? null)
  const [bookingId, setBookingId] = useState<string | null>(existing?._id ?? null)
  const [busy, setBusy] = useState<null | 'save' | 'cancel' | 'upload'>(null)
  const [error, setError] = useState<string | null>(null)
  const [carriers, setCarriers] = useState<CarrierCodeRef[]>([])
  const [candidates, setCandidates] = useState<FlightSearchResult[]>([])
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [pickedCandidateId, setPickedCandidateId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const changedRef = useRef(false)

  useEffect(() => {
    api
      .getCarrierCodes(getOperatorId())
      .then(setCarriers)
      .catch((err) => console.warn('[transport] failed to load carriers', err))
  }, [])

  // Load company flight candidates for the positioning route. Debounced
  // 200ms so typing in the dep/arr fields doesn't fire one HTTP request
  // per keystroke. Cached per (origin|dest|date) so revisiting the same
  // pair stays instant.
  useEffect(() => {
    if (!positioning) return
    if (existing) return // editing — skip the candidate list
    if (!flightDate || !depStation || !arrStation) return
    const origin = depStation.toUpperCase()
    const destination = arrStation.toUpperCase()
    const key = `${origin}|${destination}|${flightDate}`
    const cached = flightSearchCache.get(key)
    if (cached) {
      setCandidates(cached)
      setCandidatesLoading(false)
      return
    }
    let cancelled = false
    setCandidatesLoading(true)
    const handle = window.setTimeout(() => {
      api
        .searchFlights({ origin, destination, date: flightDate })
        .then((rows) => {
          if (cancelled) return
          flightSearchCache.set(key, rows)
          setCandidates(rows)
        })
        .catch((err) => {
          if (!cancelled) {
            console.warn('[positioning] flight search failed', err)
            setCandidates([])
          }
        })
        .finally(() => {
          if (!cancelled) setCandidatesLoading(false)
        })
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [positioning, existing, flightDate, depStation, arrStation])

  const carrierOk = useMemo(() => {
    if (method !== 'ticket' && !carrierCode) return true
    const code = carrierCode.toUpperCase()
    // Own operator's IATA is always valid even when not registered in
    // /admin/carrier-codes — that table holds carriers you BOOK seats on,
    // not the carrier you ARE. Server treats an own-IATA ticket booking
    // as no-FK-required.
    const ownIata = (useOperatorStore.getState().operator?.iataCode ?? '').toUpperCase()
    if (ownIata && code === ownIata) return true
    return carriers.some((c) => c.iataCode === code || c.icaoCode === code)
  }, [carrierCode, carriers, method])

  const handleSave = async () => {
    setBusy('save')
    setError(null)
    try {
      let saved: CrewFlightBookingRef
      if (bookingId) {
        saved = await api.patchCrewFlightBooking(bookingId, {
          method,
          carrierCode: carrierCode ? carrierCode.toUpperCase() : null,
          flightNumber: flightNumber || null,
          flightDate: flightDate || null,
          stdUtcMs,
          staUtcMs,
          depStation: depStation || null,
          arrStation: arrStation || null,
          bookingClass: method === 'ticket' ? bookingClass || null : null,
          pnr: method === 'ticket' ? pnr || null : null,
          ticketNumbers:
            method === 'ticket'
              ? ticketNumbers
                  .split(/[,\s]+/)
                  .map((s) => s.trim())
                  .filter((s) => s.length > 0)
              : [],
          fareCost: method === 'ticket' && fareCost ? Number(fareCost) : null,
          fareCurrency,
          gendecPosition: method === 'gendec' ? gendecPosition : null,
          notes: notes || null,
        })
      } else {
        if (!leg && !positioning) throw new Error('No booking target supplied')
        // Identity payload — pairing leg or temp-base positioning. The two
        // shapes are mutually exclusive on the wire (server validates).
        const identity = positioning
          ? ({
              purpose: 'temp-base-positioning',
              tempBaseId: positioning.tempBaseId,
              direction: positioning.direction,
            } as const)
          : ({
              pairingId: leg!.pairingId,
              legId: leg!.legId,
            } as const)
        const pairingCodeForBody = leg?.pairingCode ?? ''
        const crewIdsForBody = positioning ? [positioning.crewId] : (leg?.crewIds ?? [])
        if (method === 'ticket') {
          saved = await api.createCrewFlightBooking({
            ...identity,
            method: 'ticket',
            pairingCode: pairingCodeForBody,
            crewIds: crewIdsForBody,
            carrierCode: carrierCode.toUpperCase(),
            flightNumber: flightNumber || null,
            flightDate: flightDate || null,
            stdUtcMs,
            staUtcMs,
            depStation: depStation || null,
            arrStation: arrStation || null,
            bookingClass: bookingClass || null,
            pnr: pnr || null,
            ticketNumbers: ticketNumbers
              .split(/[,\s]+/)
              .map((s) => s.trim())
              .filter((s) => s.length > 0),
            fareCost: fareCost ? Number(fareCost) : null,
            fareCurrency,
            notes: notes || null,
          })
        } else {
          saved = await api.createCrewFlightBooking({
            ...identity,
            method: 'gendec',
            pairingCode: pairingCodeForBody,
            crewIds: crewIdsForBody,
            gendecPosition,
            carrierCode: carrierCode ? carrierCode.toUpperCase() : null,
            flightNumber: flightNumber || null,
            flightDate: flightDate || null,
            stdUtcMs,
            staUtcMs,
            depStation: depStation || null,
            arrStation: arrStation || null,
            notes: notes || null,
          })
        }
        setBookingId(saved._id)
      }
      changedRef.current = true
      setAttachments(saved.attachments ?? attachments)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(null)
    }
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (!bookingId) {
      setError('Save the booking first, then attach files.')
      return
    }
    setBusy('upload')
    setError(null)
    try {
      let updated: CrewFlightBookingRef | null = null
      for (const file of Array.from(files)) {
        updated = await api.uploadCrewFlightBookingAttachment(bookingId, file)
      }
      if (updated) {
        setAttachments(updated.attachments)
        changedRef.current = true
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(null)
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!bookingId) return
    try {
      const updated = await api.deleteCrewFlightBookingAttachment(bookingId, attachmentId)
      setAttachments(updated.attachments)
      changedRef.current = true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const handleCancel = async () => {
    if (!bookingId) return
    setBusy('cancel')
    try {
      await api.cancelCrewFlightBooking(bookingId)
      changedRef.current = true
      onClosed(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed')
    } finally {
      setBusy(null)
    }
  }

  const close = () => onClosed(changedRef.current)

  // Positioning bookings open as a centered modal (simpler form, fewer
  // fields). Pairing-deadhead bookings keep the original right-anchored
  // drawer (richer form: fare cost, currency, attachments).
  const isCentered = !!positioning
  return (
    <div
      className={`fixed inset-0 z-50 flex bg-black/40 backdrop-blur-sm ${
        isCentered ? 'items-center justify-center' : 'items-center justify-end'
      }`}
      onClick={close}
    >
      <aside
        className={
          isCentered
            ? 'w-[920px] max-w-[92vw] max-h-[88vh] bg-hz-card border border-hz-border shadow-2xl rounded-xl flex flex-col overflow-hidden'
            : 'w-[680px] h-full bg-hz-card border-l border-hz-border shadow-2xl flex flex-col overflow-hidden'
        }
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="relative overflow-hidden border-b border-hz-border flex items-center justify-between"
          style={
            positioning
              ? {
                  height: 104,
                  paddingLeft: 20,
                  paddingRight: 20,
                  // Dark base, no bright fade. Subtle vertical glass tint
                  // so the header reads as a sealed strip, accent shows
                  // only via the SVG illustration on the right.
                  background: 'linear-gradient(180deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.10) 100%)',
                }
              : undefined
          }
        >
          {positioning && <PositioningHeroBackground direction={positioning.direction} />}
          <div className="relative flex items-center gap-3 z-10">
            <div className="w-1 h-7 rounded-full bg-module-accent" />
            <div>
              <h2 className="text-[15px] font-bold tracking-tight text-hz-text">
                {bookingId
                  ? 'Edit flight booking'
                  : positioning
                    ? `Assign positioning · ${positioning.direction === 'outbound' ? 'Outbound' : 'Return'}`
                    : 'New flight booking'}
              </h2>
              <p className="text-[13px] text-hz-text-secondary mt-0.5">
                {(leg?.pairingCode || existing?.pairingCode || '') as string}
                {leg?.pairingCode || existing?.pairingCode ? ' · ' : ''}
                {(leg?.depStation || existing?.depStation || positioning?.depStation) ?? '—'} →{' '}
                {(leg?.arrStation || existing?.arrStation || positioning?.arrStation) ?? '—'}
                {positioning ? ` · ${positioning.flightDate}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="relative z-10 h-8 w-8 rounded-lg flex items-center justify-center hover:bg-hz-border/30 transition-colors text-hz-text"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <Field label="Method">
            <div className="flex gap-1">
              <SegBtn active={method === 'gendec'} onClick={() => setMethod('gendec')}>
                Crew on jumpseat
              </SegBtn>
              <SegBtn active={method === 'ticket'} onClick={() => setMethod('ticket')}>
                Crew on passenger seat
              </SegBtn>
            </div>
          </Field>

          {positioning && !existing && (
            <FlightCandidatePanel
              loading={candidatesLoading}
              candidates={candidates}
              pickedId={pickedCandidateId}
              localOffsetHours={useCrewScheduleStore.getState().displayOffsetHours}
              onPick={(c) => {
                const opIata = useOperatorStore.getState().operator?.iataCode ?? ''
                setPickedCandidateId(c._id)
                setCarrierCode(opIata.toUpperCase())
                setFlightNumber(c.flightNumber)
                setDepStation(c.depCode)
                setArrStation(c.arrCode)
                setFlightDate(c.operatingDate)
                setStdUtcMs(c.stdUtcMs)
                setStaUtcMs(c.staUtcMs)
              }}
            />
          )}

          {positioning && carrierCode && (
            <CrossCarrierWarnings
              method={method}
              carrierCode={carrierCode}
              operatorIataCode={useOperatorStore.getState().operator?.iataCode ?? null}
            />
          )}

          {positioning?.conflicts && positioning.conflicts.length > 0 && (
            <DutyConflictWarning conflicts={positioning.conflicts} flightDate={positioning.flightDate} />
          )}

          {method === 'ticket' ? (
            <>
              <Row>
                <Field label="Carrier (IATA / ICAO)">
                  <CarrierCombobox
                    value={carrierCode}
                    onChange={setCarrierCode}
                    carriers={carriers}
                    placeholder="VJ"
                    invalid={!carrierOk}
                  />
                  {!carrierOk && (
                    <div className="text-[13px] text-[#FF3B3B] mt-1">
                      Carrier not in /admin/carrier-codes — required for ticket bookings.
                    </div>
                  )}
                </Field>
                <Field label="Flight #">
                  <input
                    type="text"
                    value={flightNumber}
                    onChange={(e) => setFlightNumber(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg text-[13px] text-hz-text bg-transparent"
                    style={{ border: '1px solid var(--color-hz-border)' }}
                  />
                </Field>
                <Field label="Date">
                  <input
                    type="date"
                    value={flightDate}
                    onChange={(e) => setFlightDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg text-[13px] text-hz-text bg-transparent"
                    style={{ border: '1px solid var(--color-hz-border)' }}
                  />
                </Field>
              </Row>

              <Row>
                <Field label="Dep">
                  <input
                    type="text"
                    value={depStation}
                    onChange={(e) => setDepStation(e.target.value.toUpperCase())}
                    className="w-full h-10 px-3 rounded-lg text-[13px] text-hz-text bg-transparent"
                    style={{ border: '1px solid var(--color-hz-border)' }}
                  />
                </Field>
                <Field label="Arr">
                  <input
                    type="text"
                    value={arrStation}
                    onChange={(e) => setArrStation(e.target.value.toUpperCase())}
                    className="w-full h-10 px-3 rounded-lg text-[13px] text-hz-text bg-transparent"
                    style={{ border: '1px solid var(--color-hz-border)' }}
                  />
                </Field>
                {!positioning && (
                  <Field label="Class">
                    <div className="flex gap-1 h-10">
                      {BOOKING_CLASSES.map((c) => (
                        <SegBtn
                          key={c}
                          active={bookingClass === c}
                          onClick={() => setBookingClass(bookingClass === c ? '' : c)}
                        >
                          {c}
                        </SegBtn>
                      ))}
                    </div>
                  </Field>
                )}
              </Row>

              <Field label="PNR">
                <input
                  type="text"
                  value={pnr}
                  onChange={(e) => setPnr(e.target.value.toUpperCase())}
                  className="w-full h-10 px-3 rounded-lg text-[13px] text-hz-text bg-transparent"
                  style={{ border: '1px solid var(--color-hz-border)' }}
                />
              </Field>

              {!positioning && (
                <Field label="Ticket numbers (comma-separated)">
                  <input
                    type="text"
                    value={ticketNumbers}
                    onChange={(e) => setTicketNumbers(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg text-[13px] text-hz-text bg-transparent"
                    style={{ border: '1px solid var(--color-hz-border)' }}
                  />
                </Field>
              )}

              {!positioning && (
                <Row>
                  <Field label="Fare cost">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={fareCost}
                      onChange={(e) => setFareCost(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg text-[13px] text-hz-text bg-transparent tabular-nums"
                      style={{ border: '1px solid var(--color-hz-border)' }}
                    />
                  </Field>
                  <Field label="Currency">
                    <select
                      value={fareCurrency}
                      onChange={(e) => setFareCurrency(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg text-[13px] text-hz-text bg-transparent"
                      style={{ border: '1px solid var(--color-hz-border)' }}
                    >
                      {['USD', 'VND', 'EUR', 'GBP', 'AUD', 'SGD'].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>
                </Row>
              )}

              {!positioning && (
                <Field label={`Attachments (image / PDF) ${bookingId ? '' : '— save first to enable upload'}`}>
                  <div className="space-y-2">
                    {attachments.length === 0 ? (
                      <div className="text-[13px] text-hz-text-tertiary">No attachments yet.</div>
                    ) : (
                      <div className="space-y-1">
                        {attachments.map((a) => (
                          <div
                            key={a._id}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-hz-border/15 border border-hz-border"
                          >
                            {a.mimeType?.startsWith('image/') ? (
                              <ImageIcon className="h-4 w-4 text-module-accent shrink-0" />
                            ) : (
                              <FileText className="h-4 w-4 text-module-accent shrink-0" />
                            )}
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 text-[13px] text-hz-text truncate hover:underline"
                            >
                              {a.name}
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteAttachment(a._id)}
                              className="h-7 w-7 rounded-md flex items-center justify-center text-[#FF3B3B] hover:bg-[#FF3B3B]/10"
                              aria-label="Delete attachment"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={!bookingId || busy === 'upload'}
                      onClick={() => fileInputRef.current?.click()}
                      className="h-9 px-3 rounded-lg text-[13px] font-semibold border border-hz-border bg-hz-card hover:bg-hz-border/30 disabled:opacity-50 transition-colors text-hz-text inline-flex items-center gap-1.5"
                    >
                      <Upload className="h-3.5 w-3.5" /> {busy === 'upload' ? 'Uploading…' : 'Upload file'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      className="hidden"
                      onChange={(e) => handleUpload(e.target.files)}
                    />
                  </div>
                </Field>
              )}
            </>
          ) : (
            <>
              <Field label="GENDEC position">
                <div className="grid grid-cols-3 gap-2">
                  {GENDEC_POSITIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setGendecPosition(p)}
                      className={`h-10 w-full rounded-lg text-[13px] font-semibold transition-colors border ${
                        gendecPosition === p
                          ? 'bg-module-accent/10 text-module-accent border-module-accent/30'
                          : 'bg-transparent text-hz-text-secondary border-hz-border hover:bg-hz-border/20'
                      }`}
                    >
                      {GENDEC_LABELS[p]}
                    </button>
                  ))}
                </div>
              </Field>

              <Row>
                <Field label="Carrier (optional)">
                  <CarrierCombobox
                    value={carrierCode}
                    onChange={setCarrierCode}
                    carriers={carriers}
                    placeholder="Defaults to operator IATA"
                  />
                </Field>
                <Field label="Flight #">
                  <input
                    type="text"
                    value={flightNumber}
                    onChange={(e) => setFlightNumber(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg text-[13px] text-hz-text bg-transparent"
                    style={{ border: '1px solid var(--color-hz-border)' }}
                  />
                </Field>
                <Field label="Date">
                  <input
                    type="date"
                    value={flightDate}
                    onChange={(e) => setFlightDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg text-[13px] text-hz-text bg-transparent"
                    style={{ border: '1px solid var(--color-hz-border)' }}
                  />
                </Field>
              </Row>
            </>
          )}

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-[13px] text-hz-text bg-transparent resize-y"
              style={{ border: '1px solid var(--color-hz-border)' }}
            />
          </Field>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-[#FF3B3B]/10 border border-[#FF3B3B]/25 text-[13px] text-[#FF3B3B]">
              {error}
            </div>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-hz-border bg-hz-border/15 flex items-center gap-2">
          <button
            type="button"
            onClick={close}
            className="h-9 px-3 rounded-lg text-[13px] font-semibold border border-hz-border bg-hz-card hover:bg-hz-border/30 transition-colors text-hz-text"
          >
            Close
          </button>
          {bookingId && existing?.status !== 'cancelled' && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={busy !== null}
              className="h-9 px-3 rounded-lg text-[13px] font-semibold border border-[#FF3B3B]/30 text-[#FF3B3B] hover:bg-[#FF3B3B]/10 disabled:opacity-50 transition-colors"
            >
              Cancel booking
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleSave}
            disabled={busy !== null || (method === 'ticket' && !carrierOk)}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-module-accent text-white hover:opacity-90 disabled:opacity-50 transition-opacity inline-flex items-center gap-1.5"
          >
            <Save className="h-3.5 w-3.5" /> {busy === 'save' ? 'Saving…' : 'Save'}
          </button>
        </footer>
      </aside>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[13px] font-medium text-hz-text mb-1.5">{label}</div>
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-3">{children}</div>
}

/** Lucide-style map-marker — clean teardrop (round head + pointed tip)
 *  with a hollow ring for the head. Tip sits at `(cx, baselineY)` so
 *  multiple pins line up on a shared horizontal baseline. Path mirrors
 *  Lucide's `MapPin` 24×24 viewBox so the silhouette is recognisable. */
function MapPinGlyph({ cx, baselineY }: { cx: number; baselineY: number }) {
  // Lucide MapPin: tip at (12, 22), head circle at (12, 10) r=8.
  // Pin total height ≈ 20 in lucide units; render at scale 1 so it sits
  // at ~20 px tall — large enough to read against the dark glass header.
  return (
    <g transform={`translate(${cx - 12} ${baselineY - 22})`}>
      {/* Soft ground shadow so the pin reads "planted" on the baseline */}
      <ellipse cx="12" cy="22.5" rx="6" ry="1.4" fill="rgba(0,0,0,0.45)" opacity="0.6" />
      {/* Outer teardrop fill */}
      <path d="M12 22s-7-6.5-7-12a7 7 0 1 1 14 0c0 5.5-7 12-7 12z" fill="var(--module-accent)" opacity="0.95" />
      {/* Light rim along the top half so the pin pops on dark backgrounds */}
      <path
        d="M12 22s-7-6.5-7-12a7 7 0 1 1 14 0c0 5.5-7 12-7 12z"
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="0.8"
      />
      {/* Hollow inner ring for the pin head */}
      <circle cx="12" cy="10" r="2.8" fill="rgba(0,0,0,0.55)" />
      <circle cx="12" cy="10" r="2.8" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.8" />
    </g>
  )
}

/** Inline SVG hero for the positioning dialog header. Mirrors the visual
 *  grammar of `admin/asm-ssm-transmission/section-heroes.tsx` (grid bg +
 *  radial glow + right-anchored aviation illustration) but compact —
 *  ~96 px header height instead of 180 px. Dashed great-circle arc
 *  between two waypoint dots with a plane glyph mid-arc. */
function PositioningHeroBackground({ direction }: { direction: 'outbound' | 'return' }) {
  // Mirror the SVG horizontally on return legs so the plane appears to
  // travel right→left back to home base.
  const flipX = direction === 'return' ? -1 : 1
  return (
    <>
      {/* Grid pattern fade-out toward center-left so it doesn't clash with
          the title. Uses module accent so the operator's chosen tenant
          colour leads the design instead of a hardcoded orange. */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.10]"
        aria-hidden
        style={{
          backgroundImage: `linear-gradient(var(--module-accent) 1px, transparent 1px), linear-gradient(90deg, var(--module-accent) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse at right, black 0%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at right, black 0%, transparent 75%)',
        }}
      />
      {/* Soft radial glow bottom-right tied to module accent. */}
      <div
        className="absolute pointer-events-none"
        aria-hidden
        style={{
          right: -40,
          bottom: -40,
          width: 200,
          height: 200,
          background: 'radial-gradient(circle, var(--module-accent) 0%, transparent 65%)',
          opacity: 0.18,
          filter: 'blur(20px)',
        }}
      />
      {/* Aviation illustration — dashed great-circle arc between two pins
          with a plane silhouette riding the arc. Anchored to the BOTTOM
          of the header so the pins sit on a baseline and the arc rises
          fully inside the visible band (was clipped at the top before). */}
      <svg
        className="absolute right-6 bottom-3 pointer-events-none"
        width="240"
        height="72"
        viewBox="0 0 240 72"
        aria-hidden
        style={{ transform: `scaleX(${flipX})` }}
      >
        {/* Origin pin — map-marker teardrop, anchored at baseline. */}
        <MapPinGlyph cx={20} baselineY={64} />
        {/* Destination pin */}
        <MapPinGlyph cx={220} baselineY={64} />
        {/* Dashed great-circle arc — peak at y=14, well inside viewBox.
            Sole connector between the two pins now that the plane is
            removed; breadcrumb dots fade in toward the apex to keep the
            arc visually anchored. */}
        <path
          d="M 20 64 Q 120 14 220 64"
          stroke="var(--module-accent)"
          strokeWidth="1.4"
          strokeDasharray="4 3"
          fill="none"
          opacity="0.6"
        />
        {/* Five breadcrumb dots evenly spaced along the arc, brighter at
            the apex. Computed once via Q-curve sampling; t=0.1..0.9. */}
        {[0.18, 0.34, 0.5, 0.66, 0.82].map((t, i) => {
          // Bezier point on Q(20,64)-(120,14)-(220,64).
          const x = (1 - t) * (1 - t) * 20 + 2 * (1 - t) * t * 120 + t * t * 220
          const y = (1 - t) * (1 - t) * 64 + 2 * (1 - t) * t * 14 + t * t * 64
          // Brightest near the apex (t=0.5), fade toward the pins.
          const apexDist = Math.abs(t - 0.5)
          const op = 0.85 - apexDist * 1.2
          return <circle key={i} cx={x} cy={y} r="1.6" fill="var(--module-accent)" opacity={Math.max(0.2, op)} />
        })}
      </svg>
    </>
  )
}

function FlightCandidatePanel({
  loading,
  candidates,
  pickedId,
  localOffsetHours,
  onPick,
}: {
  loading: boolean
  candidates: FlightSearchResult[]
  pickedId: string | null
  localOffsetHours: number
  onPick: (c: FlightSearchResult) => void
}) {
  if (loading) {
    return (
      <Field label="Company flights on this route">
        <div className="space-y-1.5">
          <div className="text-[13px] text-hz-text-tertiary">Searching…</div>
          {/* Indeterminate progress bar — accent-coloured slider sweeping
              across a muted track. Pure CSS keyframes via inline <style>
              so the drawer doesn't need a global animation registry. */}
          <div
            className="relative h-1 w-full rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.06)' }}
            role="progressbar"
            aria-busy="true"
            aria-label="Searching company flights"
          >
            <div
              className="absolute top-0 h-full rounded-full"
              style={{
                width: '40%',
                background: 'var(--module-accent)',
                animation: 'flightSearchSlide 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite',
              }}
            />
          </div>
          <style>
            {`@keyframes flightSearchSlide {
              0%   { left: -45%; }
              100% { left: 100%; }
            }`}
          </style>
        </div>
      </Field>
    )
  }
  if (candidates.length === 0) {
    return (
      <Field label="Company flights on this route">
        <div className="text-[13px] text-hz-text-tertiary">
          No company flights match — fill the carrier / flight # / dep / arr fields manually below, or pick another
          carrier from /admin/carrier-codes.
        </div>
      </Field>
    )
  }
  const fmtUtc = (ms: number) => new Date(ms).toISOString().slice(11, 16).replace(':', '') + 'Z'
  const fmtLocal = (ms: number) =>
    new Date(ms + localOffsetHours * 3_600_000).toISOString().slice(11, 16).replace(':', '') + 'L'
  // 9-column grid — every column centered including the plane icon.
  // Order: Flt | STD UTC | STA UTC | STD LT | STA LT | Dep | ✈ | Arr | Reg.
  const cols = 'grid-cols-[72px_80px_80px_80px_80px_72px_28px_72px_1fr]'
  const cellCls = 'text-center'
  return (
    <Field label={`Company flights on this route (${candidates.length})`}>
      <div className="rounded-lg border border-hz-border overflow-hidden">
        <div
          className={`grid ${cols} gap-3 px-3 py-2 bg-hz-border/20 text-[12px] font-semibold uppercase tracking-wider text-hz-text-tertiary`}
        >
          <span className={cellCls}>Flt</span>
          <span className={cellCls}>STD</span>
          <span className={cellCls}>STA</span>
          <span className={cellCls}>STD LT</span>
          <span className={cellCls}>STA LT</span>
          <span className={cellCls}>Dep</span>
          <span aria-hidden />
          <span className={cellCls}>Arr</span>
          <span className={cellCls}>Reg</span>
        </div>
        <div className="max-h-[220px] overflow-y-auto divide-y divide-hz-border">
          {candidates.map((c) => {
            const active = c._id === pickedId
            return (
              <button
                key={c._id}
                type="button"
                onClick={() => onPick(c)}
                className={`w-full grid ${cols} gap-3 items-center px-3 py-2 transition-colors ${
                  active ? 'bg-module-accent/15' : 'hover:bg-hz-border/20'
                }`}
              >
                <span
                  className={`text-[13px] font-bold tabular-nums ${cellCls} ${
                    active ? 'text-module-accent' : 'text-hz-text'
                  }`}
                >
                  {c.flightNumber}
                </span>
                <span className={`text-[13px] tabular-nums text-hz-text ${cellCls}`}>{fmtUtc(c.stdUtcMs)}</span>
                <span className={`text-[13px] tabular-nums text-hz-text ${cellCls}`}>{fmtUtc(c.staUtcMs)}</span>
                <span className={`text-[13px] tabular-nums text-hz-text-secondary ${cellCls}`}>
                  {fmtLocal(c.stdUtcMs)}
                </span>
                <span className={`text-[13px] tabular-nums text-hz-text-secondary ${cellCls}`}>
                  {fmtLocal(c.staUtcMs)}
                </span>
                <span className={`text-[13px] tabular-nums font-semibold text-hz-text ${cellCls}`}>{c.depCode}</span>
                <span className="flex items-center justify-center">
                  <PlaneTakeoff
                    className={`h-3.5 w-3.5 ${active ? 'text-module-accent' : 'text-hz-text-tertiary'}`}
                    aria-hidden
                  />
                </span>
                <span className={`text-[13px] tabular-nums font-semibold text-hz-text ${cellCls}`}>{c.arrCode}</span>
                <span className={`text-[13px] tabular-nums text-hz-text-tertiary truncate ${cellCls}`}>
                  {c.tail ?? '—'}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </Field>
  )
}

function DutyConflictWarning({
  conflicts,
  flightDate,
}: {
  conflicts: NonNullable<PositioningContext['conflicts']>
  flightDate: string
}) {
  return (
    <div
      className="rounded-lg p-3 text-[13px]"
      style={{ background: 'rgba(255,136,0,0.08)', border: '1px solid rgba(255,136,0,0.35)' }}
    >
      <div className="font-semibold mb-1" style={{ color: '#FF8800' }}>
        Crew already has duty on {flightDate}
      </div>
      <ul className="space-y-1 text-[12px] text-hz-text-secondary">
        {conflicts.map((c, i) => (
          <li key={`${c.kind}-${i}`}>
            · {c.kind === 'pairing' ? 'Pairing' : 'Activity'} <span className="font-mono">{c.label}</span>{' '}
            <span className="text-hz-text-tertiary">({c.window})</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 text-[12px] text-hz-text-tertiary">
        Save anyway only if the positioning leg fits around the existing duty (e.g. half-day training in the morning,
        evening positioning). Otherwise cancel the existing duty first.
      </div>
    </div>
  )
}

/** SkyHub-styled carrier combobox: themed input + portal-anchored
 *  dropdown listing carrier codes. Replaces the native HTML
 *  `<datalist>` which renders bright system-coloured. Filtering is
 *  prefix-style on either IATA or ICAO; selecting a row writes the
 *  IATA code and closes the panel. */
function CarrierCombobox({
  value,
  onChange,
  carriers,
  placeholder,
  invalid,
}: {
  value: string
  onChange: (v: string) => void
  carriers: CarrierCodeRef[]
  placeholder?: string
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const q = value.trim().toUpperCase()
  const filtered = useMemo(() => {
    if (!q) return carriers.slice(0, 50)
    return carriers
      .filter(
        (c) =>
          c.iataCode?.toUpperCase().startsWith(q) ||
          c.icaoCode?.toUpperCase().startsWith(q) ||
          c.name?.toUpperCase().includes(q),
      )
      .slice(0, 50)
  }, [q, carriers])

  // Click-outside / Esc closes the panel.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <div
        className="relative h-10 rounded-lg flex items-center"
        style={{ border: `1px solid ${invalid ? '#FF3B3B' : 'var(--color-hz-border)'}` }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value.toUpperCase())
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 min-w-0 h-full pl-3 pr-8 rounded-lg text-[13px] text-hz-text bg-transparent outline-none"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-hz-text-tertiary hover:text-hz-text hover:bg-hz-border/30 transition-colors"
          aria-label="Toggle carrier list"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div
          className="absolute left-0 right-0 mt-1 z-50 rounded-lg overflow-hidden bg-hz-card shadow-2xl"
          style={{
            border: '1px solid var(--color-hz-border)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)',
          }}
        >
          <div className="max-h-[240px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-[13px] text-hz-text-tertiary">No matching carriers.</div>
            ) : (
              filtered.map((c) => {
                const active = c.iataCode?.toUpperCase() === q || c.icaoCode?.toUpperCase() === q
                return (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => {
                      onChange((c.iataCode ?? c.icaoCode ?? '').toUpperCase())
                      setOpen(false)
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                      active ? 'bg-module-accent/15' : 'hover:bg-hz-border/30'
                    }`}
                  >
                    <span
                      className={`text-[13px] font-bold tabular-nums w-9 ${active ? 'text-module-accent' : 'text-hz-text'}`}
                    >
                      {c.iataCode ?? c.icaoCode ?? '—'}
                    </span>
                    <span className="text-[13px] text-hz-text-secondary truncate flex-1">{c.name}</span>
                    {c.icaoCode && c.iataCode && c.icaoCode !== c.iataCode && (
                      <span className="text-[11px] tabular-nums text-hz-text-tertiary">{c.icaoCode}</span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CrossCarrierWarnings({
  method,
  carrierCode,
  operatorIataCode,
}: {
  method: 'ticket' | 'gendec'
  carrierCode: string
  operatorIataCode: string | null
}) {
  const code = carrierCode.toUpperCase().trim()
  if (!code) return null
  const op = (operatorIataCode ?? '').toUpperCase()
  if (!op || code === op) return null
  // Cross-airline warning — does not block save. Soft signal so the
  // scheduler knows ICA / interline coordination is required.
  return (
    <div className="px-3 py-2 rounded-lg border border-[#FF8800]/30 bg-[#FF8800]/10 text-[13px] text-[#FF8800]">
      {method === 'gendec'
        ? 'Cross-airline jumpseat — verify ICA with HOTAC before relying on this booking.'
        : 'Booking on a non-operator carrier. Audit row will record the foreign carrier code.'}
    </div>
  )
}

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 h-10 rounded-lg text-[13px] font-semibold transition-colors border ${
        active
          ? 'bg-module-accent/10 text-module-accent border-module-accent/30'
          : 'bg-transparent text-hz-text-secondary border-hz-border hover:bg-hz-border/20'
      }`}
    >
      {children}
    </button>
  )
}
