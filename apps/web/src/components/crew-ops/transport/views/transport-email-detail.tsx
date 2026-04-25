'use client'

import { useState } from 'react'
import { Pencil, Send, X, AlertTriangle, Clock } from 'lucide-react'
import { api, type TransportEmailRef } from '@skyhub/api'
import { useTransportEmailStore } from '@/stores/use-transport-email-store'
import { TransportEmailStatusChip } from './transport-email-status-chip'

interface Props {
  email: TransportEmailRef
  onChanged: () => void
}

export function TransportEmailDetail({ email, onChanged }: Props) {
  const openCompose = useTransportEmailStore((s) => s.openCompose)
  const [busy, setBusy] = useState<null | 'release' | 'discard'>(null)

  const editable = email.status === 'held' || email.status === 'draft'

  const handleRelease = async () => {
    setBusy('release')
    try {
      await api.releaseTransportEmails([email._id])
      await onChanged()
    } catch (err) {
      console.warn('[transport] release failed', err)
    } finally {
      setBusy(null)
    }
  }

  const handleDiscard = async () => {
    setBusy('discard')
    try {
      await api.discardTransportEmails([email._id])
      await onChanged()
    } catch (err) {
      console.warn('[transport] discard failed', err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-5 py-4 border-b border-hz-border flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-[15px] font-bold text-hz-text truncate">{email.subject || '(no subject)'}</h2>
            <TransportEmailStatusChip status={email.status} />
          </div>
          <div className="text-[13px] text-hz-text-secondary truncate">
            {email.direction === 'outbound' ? 'To' : 'From'}: {email.recipients.join(', ') || '—'}
            {email.vendorName ? ` · ${email.vendorName}` : ''}
          </div>
        </div>
      </div>

      {email.status === 'held' && (
        <div className="mx-5 mt-3 px-3 py-2.5 rounded-xl bg-[#FF8800]/10 border border-[#FF8800]/25 flex items-start gap-2">
          <Clock className="h-4 w-4 text-[#FF8800] shrink-0 mt-0.5" />
          <div className="text-[13px] text-hz-text leading-snug">
            This dispatch sheet has not been sent. Amend before <span className="font-semibold">Release</span>.
          </div>
        </div>
      )}

      {(email.status === 'failed' || email.status === 'partial') && (
        <div className="mx-5 mt-3 px-3 py-2.5 rounded-xl bg-[#FF3B3B]/10 border border-[#FF3B3B]/25 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-[#FF3B3B] shrink-0 mt-0.5" />
          <div className="text-[13px] text-hz-text leading-snug">
            {email.status === 'failed' ? 'Delivery failed for all recipients.' : 'Delivery partially failed.'}
            {email.deliveries.some((d) => d.errorDetail)
              ? ` Last error: ${email.deliveries.find((d) => d.errorDetail)?.errorDetail}`
              : ''}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div className="rounded-xl bg-hz-border/15 border border-hz-border p-4 text-[13px] text-hz-text whitespace-pre-wrap font-mono leading-[18px]">
          {email.body || '(empty)'}
        </div>

        {email.tripIds.length > 0 && (
          <div>
            <div className="text-[13px] uppercase tracking-wider font-semibold text-hz-text-secondary mb-2">
              Linked trips
            </div>
            <div className="flex flex-wrap gap-1.5">
              {email.tripIds.map((id) => (
                <span key={id} className="text-[13px] font-mono px-1.5 py-0.5 rounded bg-hz-border/40 text-hz-text">
                  {id.slice(0, 8)}
                </span>
              ))}
            </div>
          </div>
        )}

        {email.deliveries.length > 0 && (
          <div>
            <div className="text-[13px] uppercase tracking-wider font-semibold text-hz-text-secondary mb-2">
              Delivery audit
            </div>
            <div className="rounded-xl bg-hz-border/15 border border-hz-border overflow-hidden">
              {email.deliveries.map((d, i) => (
                <div
                  key={d.recipient + i}
                  className="px-3 py-2 border-b border-hz-border/40 last:border-b-0 flex items-center justify-between gap-3"
                >
                  <span className="text-[13px] text-hz-text font-mono truncate">{d.recipient}</span>
                  <span className="text-[13px] text-hz-text-secondary">
                    {d.status === 'delivered'
                      ? '✓ delivered'
                      : d.status === 'failed'
                        ? `✗ ${d.errorDetail ?? 'failed'}`
                        : d.status}
                    {d.attemptCount > 0 && ` · ${d.attemptCount}×`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {editable && (
        <div className="px-5 py-3 border-t border-hz-border bg-hz-border/15 flex items-center gap-2">
          <button
            type="button"
            onClick={() => openCompose(email._id)}
            className="h-9 px-3 rounded-lg text-[13px] font-semibold border border-hz-border bg-hz-card hover:bg-hz-border/30 transition-colors text-hz-text inline-flex items-center gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={handleDiscard}
            disabled={busy !== null}
            className="h-9 px-3 rounded-lg text-[13px] font-semibold border border-[#FF3B3B]/30 text-[#FF3B3B] hover:bg-[#FF3B3B]/10 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
          >
            <X className="h-3.5 w-3.5" /> Discard
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleRelease}
            disabled={busy !== null || email.recipients.length === 0}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-module-accent text-white hover:opacity-90 disabled:opacity-50 transition-opacity inline-flex items-center gap-1.5"
            title={
              email.recipients.length === 0 ? 'Add at least one recipient before releasing' : 'Release to SMTP queue'
            }
          >
            <Send className="h-3.5 w-3.5" /> Release
          </button>
        </div>
      )}
    </div>
  )
}
