'use client'

import { useEffect, useMemo } from 'react'
import { Inbox, Send, Pause, Mail, RefreshCw } from 'lucide-react'
import { api, type HotelEmailRef } from '@skyhub/api'
import { useHotacEmailStore, type EmailFolder } from '@/stores/use-hotac-email-store'
import { StatusChip } from './email-status-chip'
import { ComposeEmailDrawer } from './compose-email-drawer'
import { EmailDetailPane } from './email-detail-pane'

/** Communication tab — held / outgoing / incoming email queues, master-detail. */
export function CommunicationView() {
  const folder = useHotacEmailStore((s) => s.folder)
  const setFolder = useHotacEmailStore((s) => s.setFolder)
  const emails = useHotacEmailStore((s) => s.emails)
  const setEmails = useHotacEmailStore((s) => s.setEmails)
  const loading = useHotacEmailStore((s) => s.loading)
  const setLoading = useHotacEmailStore((s) => s.setLoading)
  const selectedId = useHotacEmailStore((s) => s.selectedId)
  const setSelectedId = useHotacEmailStore((s) => s.setSelectedId)
  const selectedIds = useHotacEmailStore((s) => s.selectedIds)
  const toggleSelected = useHotacEmailStore((s) => s.toggleSelected)
  const composeId = useHotacEmailStore((s) => s.composeId)

  const refresh = useMemo(
    () => async () => {
      setLoading(true)
      try {
        let docs: HotelEmailRef[]
        if (folder === 'held') {
          docs = await api.getHeldHotelEmails()
        } else if (folder === 'outgoing') {
          docs = await api.getHotelEmails({ direction: 'outbound' })
          docs = docs.filter((d) => d.status !== 'held' && d.status !== 'discarded')
        } else {
          docs = await api.getHotelEmails({ direction: 'inbound' })
        }
        setEmails(docs)
      } catch (err) {
        console.warn('[hotac] failed to load emails', err)
      } finally {
        setLoading(false)
      }
    },
    [folder, setEmails, setLoading],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Counts per folder — fetched as a side-effect of the active folder; the
  // sidebar shows the active folder's count plus a placeholder for the others.
  const counts = useMemo(() => {
    const total = emails.length
    return {
      [folder]: total,
    } as Partial<Record<EmailFolder, number>>
  }, [emails, folder])

  const selected = useMemo(() => emails.find((e) => e._id === selectedId) ?? null, [emails, selectedId])

  return (
    <div className="flex-1 grid grid-cols-[260px_360px_1fr] overflow-hidden">
      {/* Left — folder list */}
      <aside className="border-r border-hz-border flex flex-col">
        <div className="px-4 py-3 border-b border-hz-border flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-module-accent" />
          <span className="text-[13px] font-bold text-hz-text">Hotel Mail</span>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="ml-auto h-7 w-7 rounded-md flex items-center justify-center hover:bg-hz-border/30 disabled:opacity-40 transition-colors text-hz-text"
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          <FolderRow
            icon={Pause}
            label="Held"
            folder="held"
            count={folder === 'held' ? counts.held : null}
            active={folder === 'held'}
            onClick={() => setFolder('held')}
          />
          <FolderRow
            icon={Send}
            label="Outgoing"
            folder="outgoing"
            count={folder === 'outgoing' ? counts.outgoing : null}
            active={folder === 'outgoing'}
            onClick={() => setFolder('outgoing')}
          />
          <FolderRow
            icon={Inbox}
            label="Incoming"
            folder="incoming"
            count={folder === 'incoming' ? counts.incoming : null}
            active={folder === 'incoming'}
            onClick={() => setFolder('incoming')}
          />
        </nav>
      </aside>

      {/* Middle — email list */}
      <section className="border-r border-hz-border flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-hz-border flex items-center justify-between">
          <span className="text-[13px] font-semibold text-hz-text capitalize">{folder}</span>
          <span className="text-[13px] text-hz-text-secondary">
            {emails.length} message{emails.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && emails.length === 0 ? (
            <div className="p-6 text-center text-[13px] text-hz-text-secondary">Loading…</div>
          ) : emails.length === 0 ? (
            <div className="p-6 text-center text-[13px] text-hz-text-secondary">No messages.</div>
          ) : (
            emails.map((e) => {
              const checked = selectedIds.has(e._id)
              const active = selectedId === e._id
              return (
                <div
                  key={e._id}
                  className={`flex items-start gap-2 px-4 py-3 border-b border-hz-border/60 cursor-pointer transition-colors ${
                    active ? 'bg-module-accent/[0.08]' : 'hover:bg-hz-border/20'
                  }`}
                  onClick={() => setSelectedId(e._id)}
                >
                  {folder === 'held' && (
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(ev) => {
                        ev.stopPropagation()
                        toggleSelected(e._id)
                      }}
                      onClick={(ev) => ev.stopPropagation()}
                      className="mt-1 accent-module-accent shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-hz-text truncate flex-1">
                        {e.subject || '(no subject)'}
                      </span>
                      <StatusChip status={e.status} />
                    </div>
                    <div className="text-[13px] text-hz-text-secondary mt-0.5 truncate">
                      {e.hotelName || e.recipients.join(', ') || '—'}
                    </div>
                    <div className="text-[13px] text-hz-text-tertiary mt-0.5">{fmtRelative(e.updatedAtUtcMs)}</div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* Right — detail */}
      <section className="flex flex-col overflow-hidden">
        {selected ? (
          <EmailDetailPane email={selected} onChanged={refresh} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-[13px] text-hz-text-secondary text-center px-12">
            <div>
              <Mail className="h-8 w-8 text-module-accent mx-auto mb-2" strokeWidth={1.6} />
              Select a message on the left to view it.
            </div>
          </div>
        )}
      </section>

      {composeId !== null && <ComposeEmailDrawer onClosed={refresh} />}
    </div>
  )
}

interface FolderRowProps {
  icon: typeof Inbox
  label: string
  folder: EmailFolder
  count: number | null | undefined
  active: boolean
  onClick: () => void
}

function FolderRow({ icon: Icon, label, count, active, onClick }: FolderRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border-l-[3px] transition-colors ${
        active ? 'bg-module-accent/8 border-l-module-accent' : 'border-l-transparent hover:bg-hz-border/30'
      }`}
    >
      <div
        className={`h-8 w-8 rounded-lg flex items-center justify-center ${
          active ? 'bg-module-accent/15 text-module-accent' : 'bg-hz-border/40 text-hz-text-secondary'
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[13px] ${active ? 'font-semibold text-hz-text' : 'font-medium text-hz-text'}`}>
          {label}
        </div>
        {count != null && (
          <div className="text-[13px] text-hz-text-secondary mt-0.5">
            {count} message{count === 1 ? '' : 's'}
          </div>
        )}
      </div>
    </button>
  )
}

function fmtRelative(ms: number): string {
  const diff = Date.now() - ms
  const sec = Math.round(diff / 1000)
  if (sec < 60) return 'just now'
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`
  if (sec < 86_400) return `${Math.round(sec / 3600)} h ago`
  const days = Math.round(sec / 86_400)
  if (days < 30) return `${days} d ago`
  return new Date(ms).toISOString().slice(0, 10)
}
