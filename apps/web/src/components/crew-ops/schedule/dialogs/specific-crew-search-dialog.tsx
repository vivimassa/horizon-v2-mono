'use client'

import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react'
import { Trash2, Users } from 'lucide-react'
import { DialogShell, DialogCancelButton, DialogPrimaryButton } from './dialog-shell'
import { SpecificCrewSearchHero } from './dialog-heroes'

interface Props {
  /** Tokens already saved on the filter (so re-opening shows them). */
  initial: string[]
  onClose: () => void
  /** Persist the new token list. Caller is responsible for clearing
   *  the other left-panel filters when this returns a non-empty list. */
  onSave: (tokens: string[]) => void
}

/**
 * 4.1.6.2 Crew Schedule — Specific Crew Search dialog.
 *
 * Excel-friendly bulk lookup. The textarea splits on newlines, commas,
 * tabs, and semicolons so the planner can paste straight from a column
 * selection. The chip strip below shows the parsed token set with a
 * one-click remove. Saving overrides every other left-panel filter.
 */
export function SpecificCrewSearchDialog({ initial, onClose, onSave }: Props) {
  const [raw, setRaw] = useState(initial.join('\n'))
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setTimeout(() => taRef.current?.focus(), 50)
  }, [])

  const tokens = useMemo(() => parseTokens(raw), [raw])

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    // Excel cells are tab- or newline-separated. Default paste already
    // preserves them, so we only normalise to one-per-line — easier to
    // visually verify a 200-row paste.
    const text = e.clipboardData.getData('text')
    if (!text) return
    e.preventDefault()
    const merged = parseTokens(`${raw}\n${text}`).join('\n')
    setRaw(merged)
    requestAnimationFrame(() => {
      const el = taRef.current
      if (el) {
        el.scrollTop = el.scrollHeight
        el.setSelectionRange(el.value.length, el.value.length)
      }
    })
  }

  function removeToken(idx: number) {
    const next = tokens.slice(0, idx).concat(tokens.slice(idx + 1))
    setRaw(next.join('\n'))
  }

  function clearAll() {
    setRaw('')
    requestAnimationFrame(() => taRef.current?.focus())
  }

  function handleSave() {
    onSave(tokens)
    onClose()
  }

  return (
    <DialogShell
      title="Specific Crew Search"
      heroEyebrow="Bulk lookup"
      heroSubtitle="Paste crew IDs or names — overrides every other filter"
      heroSvg={<SpecificCrewSearchHero />}
      onClose={onClose}
      width={560}
      footer={
        <>
          {tokens.length > 0 && (
            <button
              onClick={clearAll}
              className="mr-auto h-9 px-3 rounded-lg text-[13px] font-medium flex items-center gap-1.5 hover:bg-white/10"
              style={{ color: '#E63535' }}
            >
              <Trash2 className="w-4 h-4" />
              Clear all
            </button>
          )}
          <DialogCancelButton onClick={onClose} />
          <DialogPrimaryButton onClick={handleSave} label="Save" />
        </>
      }
    >
      <div className="space-y-3">
        <div className="text-[13px] text-hz-text-tertiary">
          Enter or paste crew IDs (e.g. <span className="font-mono">10178</span>) or names — one per line. Tabs, commas
          and semicolons also work, so you can paste a column selection straight from Excel. Saving will replace any
          Base / Position / A/C Type / Crew Group filters with this list.
        </div>

        <label className="block">
          <div className="text-[12px] font-medium text-hz-text-secondary mb-1">Crew IDs or names</div>
          <textarea
            ref={taRef}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onPaste={handlePaste}
            placeholder={'10178\n12123\nNGUYEN VAN A\n…'}
            rows={8}
            className="w-full rounded-lg text-[14px] outline-none p-3 font-mono leading-snug resize-y"
            style={{
              background: 'rgba(142,142,160,0.12)',
              border: '1px solid rgba(142,142,160,0.3)',
              minHeight: 160,
            }}
            spellCheck={false}
          />
        </label>

        <div className="flex items-center justify-between">
          <div className="text-[12px] text-hz-text-tertiary flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {tokens.length === 0 ? 'No entries yet' : `${tokens.length} ${tokens.length === 1 ? 'entry' : 'entries'}`}
          </div>
          {tokens.length > 0 && <div className="text-[11px] text-hz-text-tertiary">Click a chip to remove it</div>}
        </div>

        {tokens.length > 0 && (
          <div
            className="rounded-lg p-2 max-h-44 overflow-y-auto flex flex-wrap gap-1.5"
            style={{ border: '1px solid rgba(142,142,160,0.25)' }}
          >
            {tokens.map((t, i) => (
              <button
                key={`${t}-${i}`}
                onClick={() => removeToken(i)}
                className="h-7 px-2.5 rounded-md text-[12px] font-mono font-medium flex items-center gap-1.5 transition-colors"
                style={{
                  background: 'rgba(62,123,250,0.10)',
                  border: '1px solid var(--module-accent)',
                  color: 'var(--module-accent)',
                }}
                title={`Remove “${t}”`}
              >
                {t}
                <span className="opacity-60 hover:opacity-100">×</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </DialogShell>
  )
}

/** Split on any common cell delimiter (newlines, tabs, commas,
 *  semicolons), trim, drop empties, and dedupe (case-insensitive,
 *  first-seen wins so the planner's order is preserved). */
function parseTokens(input: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of input.split(/[\r\n\t,;]+/)) {
    const v = part.trim()
    if (!v) continue
    const key = v.toUpperCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}
