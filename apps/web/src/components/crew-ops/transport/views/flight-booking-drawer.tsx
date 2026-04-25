'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Save, X, Upload, Trash2, FileText, Image as ImageIcon } from 'lucide-react'
import {
  api,
  type CarrierCodeRef,
  type CrewFlightAttachmentRef,
  type CrewFlightBookingClass,
  type CrewFlightBookingRef,
  type CrewFlightGendecPosition,
} from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'

interface DraftLeg {
  pairingId: string
  legId: string
  pairingCode: string
  flightDate: string | null
  depStation: string | null
  arrStation: string | null
  crewIds: string[]
}

interface Props {
  /** When `existing` is provided we edit; otherwise we create against `leg`. */
  existing: CrewFlightBookingRef | null
  leg: DraftLeg | null
  onClosed: (changed: boolean) => void
}

const BOOKING_CLASSES: CrewFlightBookingClass[] = ['Y', 'J', 'F', 'C', 'W']
const GENDEC_POSITIONS: CrewFlightGendecPosition[] = ['cockpit-jumpseat', 'cabin-jumpseat', 'pax-seat']

const GENDEC_LABELS: Record<CrewFlightGendecPosition, string> = {
  'cockpit-jumpseat': 'Cockpit jumpseat',
  'cabin-jumpseat': 'Cabin jumpseat',
  'pax-seat': 'Pax seat',
}

export function FlightBookingDrawer({ existing, leg, onClosed }: Props) {
  const [method, setMethod] = useState<'ticket' | 'gendec'>(existing?.method ?? 'ticket')
  const [carrierCode, setCarrierCode] = useState(existing?.carrierCode ?? '')
  const [flightNumber, setFlightNumber] = useState(existing?.flightNumber ?? leg?.pairingCode ?? '')
  const [flightDate, setFlightDate] = useState(existing?.flightDate ?? leg?.flightDate ?? '')
  const [depStation, setDepStation] = useState(existing?.depStation ?? leg?.depStation ?? '')
  const [arrStation, setArrStation] = useState(existing?.arrStation ?? leg?.arrStation ?? '')
  const [bookingClass, setBookingClass] = useState<CrewFlightBookingClass | ''>(existing?.bookingClass ?? '')
  const [pnr, setPnr] = useState(existing?.pnr ?? '')
  const [ticketNumbers, setTicketNumbers] = useState((existing?.ticketNumbers ?? []).join(', '))
  const [fareCost, setFareCost] = useState<string>(existing?.fareCost != null ? String(existing.fareCost) : '')
  const [fareCurrency, setFareCurrency] = useState(existing?.fareCurrency ?? 'USD')
  const [gendecPosition, setGendecPosition] = useState<CrewFlightGendecPosition>(existing?.gendecPosition ?? 'pax-seat')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [attachments, setAttachments] = useState<CrewFlightAttachmentRef[]>(existing?.attachments ?? [])
  const [bookingId, setBookingId] = useState<string | null>(existing?._id ?? null)
  const [busy, setBusy] = useState<null | 'save' | 'cancel' | 'upload'>(null)
  const [error, setError] = useState<string | null>(null)
  const [carriers, setCarriers] = useState<CarrierCodeRef[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const changedRef = useRef(false)

  useEffect(() => {
    api
      .getCarrierCodes(getOperatorId())
      .then(setCarriers)
      .catch((err) => console.warn('[transport] failed to load carriers', err))
  }, [])

  const carrierOk = useMemo(() => {
    if (method !== 'ticket' && !carrierCode) return true
    const code = carrierCode.toUpperCase()
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
        if (!leg) throw new Error('No leg to book against')
        if (method === 'ticket') {
          saved = await api.createCrewFlightBooking({
            method: 'ticket',
            pairingId: leg.pairingId,
            legId: leg.legId,
            pairingCode: leg.pairingCode,
            crewIds: leg.crewIds,
            carrierCode: carrierCode.toUpperCase(),
            flightNumber: flightNumber || null,
            flightDate: flightDate || null,
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
            method: 'gendec',
            pairingId: leg.pairingId,
            legId: leg.legId,
            pairingCode: leg.pairingCode,
            crewIds: leg.crewIds,
            gendecPosition,
            carrierCode: carrierCode ? carrierCode.toUpperCase() : null,
            flightNumber: flightNumber || null,
            flightDate: flightDate || null,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm" onClick={close}>
      <aside
        className="w-[680px] h-full bg-hz-card border-l border-hz-border shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-hz-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-7 rounded-full bg-module-accent" />
            <div>
              <h2 className="text-[15px] font-bold tracking-tight text-hz-text">
                {bookingId ? 'Edit flight booking' : 'New flight booking'}
              </h2>
              <p className="text-[13px] text-hz-text-secondary mt-0.5">
                {leg?.pairingCode || existing?.pairingCode || ''}
                {' · '}
                {(leg?.depStation || existing?.depStation) ?? '—'} → {(leg?.arrStation || existing?.arrStation) ?? '—'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-hz-border/30 transition-colors text-hz-text"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <Field label="Method">
            <div className="flex gap-1">
              <SegBtn active={method === 'ticket'} onClick={() => setMethod('ticket')}>
                Ticket
              </SegBtn>
              <SegBtn active={method === 'gendec'} onClick={() => setMethod('gendec')}>
                GENDEC supernumerary
              </SegBtn>
            </div>
          </Field>

          {method === 'ticket' ? (
            <>
              <Row>
                <Field label="Carrier (IATA / ICAO)">
                  <input
                    list="flight-booking-carriers"
                    type="text"
                    value={carrierCode}
                    onChange={(e) => setCarrierCode(e.target.value.toUpperCase())}
                    placeholder="VJ"
                    className={`w-full h-10 px-3 rounded-lg text-[13px] text-hz-text bg-transparent ${carrierOk ? '' : 'border-[#FF3B3B]'}`}
                    style={{ border: `1px solid ${carrierOk ? 'var(--color-hz-border)' : '#FF3B3B'}` }}
                  />
                  <datalist id="flight-booking-carriers">
                    {carriers.map((c) => (
                      <option key={c._id} value={c.iataCode}>
                        {c.iataCode} · {c.name}
                      </option>
                    ))}
                  </datalist>
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

              <Field label="Ticket numbers (comma-separated)">
                <input
                  type="text"
                  value={ticketNumbers}
                  onChange={(e) => setTicketNumbers(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg text-[13px] text-hz-text bg-transparent"
                  style={{ border: '1px solid var(--color-hz-border)' }}
                />
              </Field>

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
            </>
          ) : (
            <>
              <Field label="GENDEC position">
                <div className="flex gap-1">
                  {GENDEC_POSITIONS.map((p) => (
                    <SegBtn key={p} active={gendecPosition === p} onClick={() => setGendecPosition(p)}>
                      {GENDEC_LABELS[p]}
                    </SegBtn>
                  ))}
                </div>
              </Field>

              <Row>
                <Field label="Carrier (optional)">
                  <input
                    list="flight-booking-carriers"
                    type="text"
                    value={carrierCode}
                    onChange={(e) => setCarrierCode(e.target.value.toUpperCase())}
                    placeholder="Defaults to operator IATA"
                    className="w-full h-10 px-3 rounded-lg text-[13px] text-hz-text bg-transparent"
                    style={{ border: '1px solid var(--color-hz-border)' }}
                  />
                  <datalist id="flight-booking-carriers">
                    {carriers.map((c) => (
                      <option key={c._id} value={c.iataCode}>
                        {c.iataCode} · {c.name}
                      </option>
                    ))}
                  </datalist>
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
            <Save className="h-3.5 w-3.5" /> {busy === 'save' ? 'Saving…' : bookingId ? 'Save changes' : 'Save booking'}
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

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 h-10 rounded-lg text-[13px] font-semibold transition-colors ${
        active ? 'bg-module-accent text-white' : 'bg-hz-border/30 text-hz-text hover:bg-hz-border/50'
      }`}
    >
      {children}
    </button>
  )
}
