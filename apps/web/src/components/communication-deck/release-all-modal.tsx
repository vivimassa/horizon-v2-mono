'use client'

/**
 * Release All confirmation modal. Lists every Held/Pending outbound
 * message currently loaded on the page and, on confirm, dispatches a
 * single bulk release/transmit for all of them.
 */

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Send, X, Loader2 } from 'lucide-react'
import type { MovementMessageRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  held: { bg: 'rgba(255,136,0,0.14)', fg: '#FF8800' },
  pending: { bg: 'rgba(253,221,72,0.18)', fg: '#C99400' },
  failed: { bg: 'rgba(255,59,59,0.14)', fg: '#FF3B3B' },
}

interface Props {
  open: boolean
  messages: MovementMessageRef[]
  accentColor: string
  pending: boolean
  onClose: () => void
  onConfirm: () => void
}

export function ReleaseAllModal({ open, messages, accentColor, pending, onClose, onConfirm }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, pending, onClose])

  if (!open) return null

  const panelBg = isDark ? 'rgba(25,25,33,0.96)' : 'rgba(255,255,255,0.98)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const softBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const rowBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'

  const count = messages.length

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={() => !pending && onClose()}
    >
      <div
        className="flex flex-col rounded-2xl overflow-hidden"
        style={{
          width: 640,
          maxHeight: '80vh',
          background: panelBg,
          border: `1px solid ${panelBorder}`,
          backdropFilter: 'blur(24px)',
          boxShadow: isDark ? '0 24px 64px rgba(0,0,0,0.55)' : '0 24px 64px rgba(0,0,0,0.22)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 h-14 shrink-0 border-b" style={{ borderColor: softBorder }}>
          <div className="w-[3px] h-6 rounded-full" style={{ background: accentColor }} />
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold text-hz-text leading-none">
              Release and transmit {count} message{count === 1 ? '' : 's'}
            </span>
            <span className="text-[13px] text-hz-text-tertiary mt-0.5">
              Every Held or Pending message in the current view will be sent to its recipients.
            </span>
          </div>
          <div className="flex-1" />
          <button
            onClick={onClose}
            disabled={pending}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-hz-text-secondary hover:bg-hz-surface-hover disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar p-3">
          {count === 0 ? (
            <div className="h-32 flex items-center justify-center text-[13px] text-hz-text-tertiary">
              No Held or Pending messages in the current view.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {messages.map((m) => {
                const clr = STATUS_COLORS[m.status] ?? { bg: 'rgba(96,97,112,0.12)', fg: '#606170' }
                return (
                  <div
                    key={m._id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg"
                    style={{ background: rowBg, border: `1px solid ${softBorder}` }}
                  >
                    <span
                      className="inline-flex px-2 py-0.5 rounded-md text-[13px] font-semibold capitalize shrink-0"
                      style={{ background: clr.bg, color: clr.fg }}
                    >
                      {m.status}
                    </span>
                    <span
                      className="inline-flex px-2 py-0.5 rounded-md text-[13px] font-semibold shrink-0"
                      style={{ background: `${accentColor}1A`, color: accentColor }}
                    >
                      {m.messageType} · {m.actionCode}
                    </span>
                    <span className="text-[13px] font-semibold text-hz-text shrink-0">{m.flightNumber ?? '—'}</span>
                    <span className="text-[13px] font-mono text-hz-text-secondary shrink-0">
                      {m.depStation && m.arrStation
                        ? `${m.depStation}-${m.arrStation}`
                        : (m.depStation ?? m.arrStation ?? '')}
                    </span>
                    <span className="text-[13px] text-hz-text-tertiary truncate flex-1 min-w-0">{m.summary ?? ''}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 h-14 shrink-0 border-t" style={{ borderColor: softBorder }}>
          <div className="flex-1 text-[13px] text-hz-text-tertiary">{count > 0 && 'This action cannot be undone.'}</div>
          <button
            onClick={onClose}
            disabled={pending}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold text-hz-text-secondary hover:bg-hz-surface-hover disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={count === 0 || pending}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition-opacity"
            style={{
              background: accentColor,
              color: '#fff',
              opacity: count === 0 || pending ? 0.4 : 1,
            }}
          >
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Release &amp; transmit ({count})
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
