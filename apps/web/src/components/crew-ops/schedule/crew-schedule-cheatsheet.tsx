'use client'

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X, Keyboard } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * Keyboard shortcut cheatsheet overlay. Triggered by `?` (Shift+/) from
 * the shell. Groups shortcuts by workflow category so a new planner can
 * skim it once and know where everything lives.
 *
 * Intentionally hand-authored — a central "command registry" pattern
 * is overkill for the current action surface. When the palette lands
 * (P3.1) both will share the same list.
 */
export function CrewScheduleCheatsheet({ open, onClose }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[720px] max-w-[92vw] max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,0.99)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 pt-5 pb-4"
          style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
        >
          <div className="flex items-center gap-2.5">
            <Keyboard className="w-5 h-5" style={{ color: 'var(--module-accent)' }} />
            <h2 className="text-[17px] font-bold">Keyboard shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-hz-border/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 grid grid-cols-2 gap-x-8 gap-y-6">
          <Section title="Navigation">
            <Row keys={['?']} label="Open this cheatsheet" />
            <Row keys={['Ctrl', 'K']} label="Command palette" />
            <Row keys={['Esc']} label="Cancel the current action" />
            <Row keys={['T']} label="Jump to today" />
          </Section>

          <Section title="Selection">
            <Row mouse="Click bar" label="Select pairing or activity" />
            <Row mouse="Click empty cell" label="Clear selection" />
            <Row keys={['Shift', '+ Drag']} label="Select a date range" />
            <Row keys={['Esc']} label="Clear range selection" />
          </Section>

          <Section title="Right-click menus (§4.2–4.6)">
            <Row mouse="Right-click bar" label="Pairing / activity actions" />
            <Row mouse="Right-click empty cell" label="Assign activity · pairing · memo" />
            <Row mouse="Right-click date header" label="Uncrewed · totals · legality" />
            <Row mouse="Right-click crew name" label="Bio · expiry · exclude · refresh" />
            <Row mouse="Right-click range" label="Copy · move · swap · delete block" />
          </Section>

          <Section title="Assign &amp; Edit">
            <Row mouse="Double-click cell" label="Pick an activity code" />
            <Row mouse="Drag bar → row" label="Move pairing to another crew" />
            <Row keys={['Ctrl', '+ Drag']} label="Copy pairing to another crew" />
            <Row keys={['Delete']} label="Delete selected bar or range" />
          </Section>

          <Section title="Scheduling">
            <Row mouse="Shift-drag range → right-click" label='"Assign series of duties"' />
            <Row mouse="Right-click bar → Swap with…" label="Swap duties between crew" />
          </Section>

          <Section title="Display">
            <Row mouse="Format button" label="Row height · Range · Refresh" />
            <Row mouse="Bar label button" label="Pairing / Sector / Flight" />
          </Section>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-3 text-[11px] text-hz-text-tertiary flex items-center justify-between"
          style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
        >
          <span>
            Tip: every menu action also shows its shortcut. Full list also searchable via{' '}
            <KeyBadge small>Ctrl</KeyBadge>
            <KeyBadge small>K</KeyBadge>.
          </span>
          <span>
            Press <KeyBadge small>Esc</KeyBadge> to close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-[3px] h-3.5 rounded-sm" style={{ backgroundColor: 'var(--module-accent)' }} />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-hz-text-secondary">{title}</h3>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function Row({ keys, mouse, label }: { keys?: string[]; mouse?: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="flex items-center gap-1 shrink-0 min-w-[140px]">
        {keys?.map((k) => (
          <KeyBadge key={k}>{k}</KeyBadge>
        ))}
        {mouse && <MouseHint>{mouse}</MouseHint>}
      </span>
      <span className="text-hz-text-secondary">{label}</span>
    </div>
  )
}

function KeyBadge({ children, small }: { children: ReactNode; small?: boolean }) {
  return (
    <kbd
      className={`inline-flex items-center justify-center font-mono font-semibold rounded ${small ? 'h-4 min-w-[18px] px-1 text-[10px] mx-[1px]' : 'h-6 min-w-[24px] px-1.5 text-[11px]'}`}
      style={{
        background: 'rgba(125,125,140,0.15)',
        border: '1px solid rgba(125,125,140,0.25)',
        color: 'var(--hz-text, inherit)',
      }}
    >
      {children}
    </kbd>
  )
}

function MouseHint({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center justify-center h-6 px-2 rounded text-[11px] font-medium"
      style={{
        background: 'rgba(62,123,250,0.10)',
        color: 'var(--module-accent)',
        border: '1px solid rgba(62,123,250,0.20)',
      }}
    >
      {children}
    </span>
  )
}
