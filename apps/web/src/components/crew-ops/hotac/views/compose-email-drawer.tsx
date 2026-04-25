'use client'

import { useEffect, useState } from 'react'
import { X, Save, Send } from 'lucide-react'
import { api, type HotelEmailRef } from '@skyhub/api'
import { useHotacEmailStore } from '@/stores/use-hotac-email-store'
import { useHotacStore } from '@/stores/use-hotac-store'
import { useHotacHotels } from '../use-hotac-hotels'
import { buildRoomingListTemplate } from '../data/rooming-list-template'

interface ComposeEmailDrawerProps {
  onClosed: () => void | Promise<void>
}

interface DraftState {
  hotelId: string | null
  hotelName: string
  bookingIds: string[]
  recipients: string[]
  subject: string
  body: string
}

const EMPTY: DraftState = {
  hotelId: null,
  hotelName: '',
  bookingIds: [],
  recipients: [],
  subject: '',
  body: '',
}

export function ComposeEmailDrawer({ onClosed }: ComposeEmailDrawerProps) {
  const composeId = useHotacEmailStore((s) => s.composeId)
  const closeCompose = useHotacEmailStore((s) => s.closeCompose)
  const { hotelsById } = useHotacHotels()
  const bookings = useHotacStore((s) => s.bookings)

  const [loaded, setLoaded] = useState(composeId === 'new')
  const [draft, setDraft] = useState<DraftState>(EMPTY)
  const [emailId, setEmailId] = useState<string | null>(null)
  const [busy, setBusy] = useState<null | 'save' | 'release'>(null)

  // Load existing email when editing.
  useEffect(() => {
    if (!composeId || composeId === 'new') {
      setLoaded(true)
      // Composing from scratch — pre-fill from selected booking if there is one.
      const selected = useHotacStore.getState().selectedBookingId
      if (selected) {
        const b = bookings.find((x) => x.id === selected)
        if (b) {
          const hotel = b.hotel?.id ? hotelsById.get(b.hotel.id) : null
          const recipients = (hotel?.emails ?? []).filter((e) => !!e.address).map((e) => e.address as string) ?? []
          const tmpl = buildRoomingListTemplate({ bookings: [b] })
          setDraft({
            hotelId: b.hotel?.id ?? null,
            hotelName: b.hotel?.name ?? '',
            bookingIds: [b.id],
            recipients,
            subject: tmpl.subject,
            body: tmpl.body,
          })
        }
      }
      return
    }

    let alive = true
    api
      .getHotelEmails({})
      .then((all) => {
        if (!alive) return
        const e = all.find((x) => x._id === composeId)
        if (!e) return
        setEmailId(e._id)
        setDraft({
          hotelId: e.hotelId,
          hotelName: e.hotelName,
          bookingIds: e.bookingIds,
          recipients: e.recipients,
          subject: e.subject,
          body: e.body,
        })
      })
      .catch((err) => console.warn('[hotac] failed to load email', err))
      .finally(() => {
        if (alive) setLoaded(true)
      })
    return () => {
      alive = false
    }
  }, [composeId, bookings, hotelsById])

  const handleClose = async () => {
    closeCompose()
    await onClosed()
  }

  const handleSave = async (release: boolean) => {
    setBusy(release ? 'release' : 'save')
    try {
      let saved: HotelEmailRef
      if (emailId) {
        saved = await api.patchHotelEmail(emailId, {
          subject: draft.subject,
          body: draft.body,
          recipients: draft.recipients,
          bookingIds: draft.bookingIds,
          hotelId: draft.hotelId,
          hotelName: draft.hotelName,
        })
      } else {
        saved = await api.createHotelEmail({
          subject: draft.subject,
          body: draft.body,
          recipients: draft.recipients,
          bookingIds: draft.bookingIds,
          hotelId: draft.hotelId,
          hotelName: draft.hotelName,
          status: 'held',
        })
        setEmailId(saved._id)
      }
      if (release) {
        await api.releaseHotelEmails([saved._id])
      }
      await handleClose()
    } catch (err) {
      console.warn('[hotac] save failed', err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm"
      onClick={handleClose}
    >
      <aside
        className="w-[640px] h-full bg-hz-card border-l border-hz-border shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-hz-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-7 rounded-full bg-module-accent" />
            <div>
              <h2 className="text-[15px] font-bold tracking-tight text-hz-text">
                {emailId ? 'Edit held email' : 'New rooming list'}
              </h2>
              <p className="text-[13px] text-hz-text-secondary mt-0.5">
                Save as held, then release when the night plan is final.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-hz-border/30 transition-colors text-hz-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {!loaded ? (
            <div className="text-[13px] text-hz-text-secondary">Loading…</div>
          ) : (
            <>
              <Field label="Hotel">
                <input
                  type="text"
                  value={draft.hotelName}
                  onChange={(e) => setDraft((d) => ({ ...d, hotelName: e.target.value }))}
                  placeholder="Hotel name"
                  className="w-full h-10 px-3 rounded-lg text-[13px] text-hz-text bg-transparent"
                  style={{ border: '1px solid var(--color-hz-border)' }}
                />
              </Field>

              <Field label="To (comma-separated)">
                <input
                  type="text"
                  value={draft.recipients.join(', ')}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      recipients: e.target.value
                        .split(/[,\s]+/)
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0),
                    }))
                  }
                  placeholder="reservations@hotel.com"
                  className="w-full h-10 px-3 rounded-lg text-[13px] text-hz-text bg-transparent"
                  style={{ border: '1px solid var(--color-hz-border)' }}
                />
              </Field>

              <Field label="Subject">
                <input
                  type="text"
                  value={draft.subject}
                  onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg text-[13px] text-hz-text bg-transparent"
                  style={{ border: '1px solid var(--color-hz-border)' }}
                />
              </Field>

              <Field label="Body">
                <textarea
                  value={draft.body}
                  onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                  rows={18}
                  className="w-full px-3 py-2 rounded-lg text-[13px] text-hz-text bg-transparent font-mono resize-y"
                  style={{ border: '1px solid var(--color-hz-border)' }}
                />
              </Field>

              {draft.bookingIds.length > 0 && (
                <Field label="Linked bookings">
                  <div className="flex flex-wrap gap-1.5">
                    {draft.bookingIds.map((id) => (
                      <span
                        key={id}
                        className="text-[13px] font-mono px-1.5 py-0.5 rounded bg-hz-border/40 text-hz-text"
                      >
                        {id.slice(0, 8)}
                      </span>
                    ))}
                  </div>
                </Field>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-hz-border bg-hz-border/15 flex items-center gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="h-9 px-3 rounded-lg text-[13px] font-semibold border border-hz-border bg-hz-card hover:bg-hz-border/30 transition-colors text-hz-text"
          >
            Cancel
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={busy !== null}
            className="h-9 px-3 rounded-lg text-[13px] font-semibold border border-hz-border bg-hz-card hover:bg-hz-border/30 disabled:opacity-50 transition-colors text-hz-text inline-flex items-center gap-1.5"
          >
            <Save className="h-3.5 w-3.5" /> {busy === 'save' ? 'Saving…' : 'Save as held'}
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={busy !== null || draft.recipients.length === 0}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-module-accent text-white hover:opacity-90 disabled:opacity-50 transition-opacity inline-flex items-center gap-1.5"
            title={draft.recipients.length === 0 ? 'Add at least one recipient' : 'Save and release immediately'}
          >
            <Send className="h-3.5 w-3.5" /> {busy === 'release' ? 'Releasing…' : 'Save & Release'}
          </button>
        </div>
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
