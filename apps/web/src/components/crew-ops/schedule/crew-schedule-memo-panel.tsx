'use client'

import { useMemo, useState } from 'react'
import { Pin, PinOff, StickyNote, Trash2 } from 'lucide-react'
import { api, type CrewMemoRef, type CrewMemoScope } from '@skyhub/api'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'

interface Props {
  scope: CrewMemoScope
  targetId: string
  dateIso?: string | null
  onAfterMutate: () => void
}

/**
 * Compact memo list-and-compose panel. Drops into any inspector tab for
 * its scope. Shows existing memos (sorted pinned-first, then newest),
 * plus an inline composer at the bottom. Pinning and delete are on each
 * card. No modal — memos are quick notes; planners write and move on.
 */
export function CrewScheduleMemoPanel({ scope, targetId, dateIso, onAfterMutate }: Props) {
  const memos = useCrewScheduleStore((s) => s.memos)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const relevant = useMemo(() => {
    return memos
      .filter((m) => {
        if (m.scope !== scope) return false
        if (m.targetId !== targetId) return false
        if (scope === 'day' && m.dateIso !== dateIso) return false
        return true
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return b.updatedAt.localeCompare(a.updatedAt)
      })
  }, [memos, scope, targetId, dateIso])

  const submit = async () => {
    if (!draft.trim()) return
    setBusy(true)
    setError(null)
    try {
      await api.createCrewMemo({
        scope,
        targetId,
        dateIso: scope === 'day' ? (dateIso ?? null) : null,
        text: draft.trim(),
      })
      setDraft('')
      onAfterMutate()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const togglePin = async (memo: CrewMemoRef) => {
    try {
      await api.patchCrewMemo(memo._id, { pinned: !memo.pinned })
      onAfterMutate()
    } catch (e) {
      console.error('Failed to pin memo:', e)
    }
  }

  const remove = async (memo: CrewMemoRef) => {
    try {
      await api.deleteCrewMemo(memo._id)
      onAfterMutate()
    } catch (e) {
      console.error('Failed to delete memo:', e)
    }
  }

  return (
    <div className="space-y-2">
      {relevant.length === 0 && (
        <div className="text-[12px] text-hz-text-tertiary italic flex items-center gap-1.5">
          <StickyNote className="w-3 h-3" /> No memos yet.
        </div>
      )}
      {relevant.map((memo) => (
        <div
          key={memo._id}
          className="rounded-lg border border-hz-border/20 p-2.5 space-y-1.5"
          style={{ background: memo.pinned ? 'rgba(249,180,41,0.08)' : undefined }}
        >
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0 text-[13px] whitespace-pre-wrap">{memo.text}</div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => togglePin(memo)}
                className="w-6 h-6 rounded flex items-center justify-center hover:bg-hz-border/20"
                title={memo.pinned ? 'Unpin' : 'Pin'}
              >
                {memo.pinned ? (
                  <Pin className="w-3.5 h-3.5 text-[#F9B429]" />
                ) : (
                  <PinOff className="w-3.5 h-3.5 text-hz-text-tertiary" />
                )}
              </button>
              <button
                onClick={() => remove(memo)}
                className="w-6 h-6 rounded flex items-center justify-center hover:bg-[rgba(230,53,53,0.12)]"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5 text-[#E63535]" />
              </button>
            </div>
          </div>
          <div className="text-[10px] text-hz-text-tertiary tabular-nums">
            {memo.updatedAt.slice(0, 10)} {memo.updatedAt.slice(11, 16)}Z
          </div>
        </div>
      ))}

      {/* Composer */}
      <div className="space-y-1.5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Add a memo… (Ctrl+Enter to save)"
          className="w-full min-h-[56px] rounded-lg border border-hz-border/30 bg-transparent px-2 py-1.5 text-[12px] outline-none focus:border-[var(--module-accent)] resize-y"
        />
        {error && (
          <div
            className="p-1.5 rounded text-[11px]"
            style={{ backgroundColor: 'rgba(255,59,59,0.12)', color: '#FF3B3B' }}
          >
            {error}
          </div>
        )}
        <button
          onClick={submit}
          disabled={busy || !draft.trim()}
          className="h-8 px-3 rounded-md text-[12px] font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--module-accent)' }}
        >
          {busy ? 'Saving…' : 'Add memo'}
        </button>
      </div>
    </div>
  )
}
