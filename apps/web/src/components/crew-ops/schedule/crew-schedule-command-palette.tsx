'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Activity,
  ArrowLeftRight,
  BookUser,
  CalendarCheck,
  CalendarRange,
  Clipboard,
  Download,
  GitCompare,
  Upload,
  Eye,
  EyeOff,
  HelpCircle,
  LayoutGrid,
  Maximize2,
  Minimize2,
  PanelRight,
  PanelRightClose,
  Printer,
  RefreshCw,
  Scale,
  Search,
  Tag,
  Binary,
  Route as RouteIcon,
  Trash2,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { copyScheduleImageToClipboard, downloadScheduleImage, printSchedule } from '@/lib/crew-schedule/export'

interface Props {
  open: boolean
  onClose: () => void
  onFullscreen: () => void
  isFullscreen: boolean
  onOpenCheatsheet: () => void
  onRefresh: () => void
}

/**
 * `Ctrl+K` command palette. Replaces AIMS's 40+ undiscoverable
 * Alt-letter shortcuts with a single fuzzy-searchable list of every
 * action in the schedule. Each entry shows its keyboard shortcut (if
 * any) right-aligned so the user learns them organically.
 *
 * Entries are generated from the current store state — selection,
 * zoom, inspector open/closed, etc. — so the palette reflects what
 * is actionable *right now*.
 */
export function CrewScheduleCommandPalette({
  open,
  onClose,
  onFullscreen,
  isFullscreen,
  onOpenCheatsheet,
  onRefresh,
}: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const store = useCrewScheduleStore()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      // Focus after the portal mounts.
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const commands = useMemo<CommandItem[]>(() => {
    const cmds: CommandItem[] = []

    // ── Navigation ──────────────────────────────────────
    cmds.push({
      id: 'nav.today',
      section: 'Navigation',
      icon: CalendarCheck,
      label: 'Go to today',
      shortcut: 'T',
      keywords: 'now current',
      run: () => store.goToToday(),
    })
    cmds.push({
      id: 'nav.refresh',
      section: 'Navigation',
      icon: RefreshCw,
      label: 'Refresh schedule',
      shortcut: 'R',
      keywords: 'reload fetch',
      run: () => onRefresh(),
    })
    cmds.push({
      id: 'nav.fullscreen',
      section: 'Navigation',
      icon: isFullscreen ? Minimize2 : Maximize2,
      label: isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen',
      shortcut: 'F',
      keywords: 'maximize minimize',
      run: () => onFullscreen(),
    })

    // ── Display ─────────────────────────────────────────
    const labelIconMap: Record<typeof store.barLabelMode, LucideIcon> = {
      pairing: Tag,
      sector: RouteIcon,
      flight: Binary,
    }
    cmds.push({
      id: 'display.label.cycle',
      section: 'Display',
      icon: labelIconMap[store.barLabelMode],
      label: `Cycle bar label (current: ${capitalize(store.barLabelMode)})`,
      keywords: 'label pairing sector flight',
      run: () => store.cycleLabelMode(),
    })
    ;(['pairing', 'sector', 'flight'] as const).forEach((mode) => {
      if (mode === store.barLabelMode) return
      cmds.push({
        id: `display.label.${mode}`,
        section: 'Display',
        icon: labelIconMap[mode],
        label: `Set bar label → ${capitalize(mode)}`,
        keywords: `label ${mode}`,
        run: () => store.setLabelMode(mode),
      })
    })
    cmds.push({
      id: 'display.inspector',
      section: 'Display',
      icon: store.rightPanelOpen ? PanelRightClose : PanelRight,
      label: store.rightPanelOpen ? 'Hide inspector' : 'Show inspector',
      keywords: 'right panel details',
      run: () => store.setRightPanelOpen(!store.rightPanelOpen),
    })
    cmds.push({
      id: 'display.row-taller',
      section: 'Display',
      icon: LayoutGrid,
      label: 'Row height — bigger',
      keywords: 'zoom row larger',
      run: () => store.zoomRowIn(),
    })
    cmds.push({
      id: 'display.row-shorter',
      section: 'Display',
      icon: LayoutGrid,
      label: 'Row height — smaller',
      keywords: 'zoom row smaller compact',
      run: () => store.zoomRowOut(),
    })
    ;(['7D', '14D', '28D', 'M'] as const).forEach((z) => {
      if (z === store.zoom) return
      cmds.push({
        id: `display.zoom.${z}`,
        section: 'Display',
        icon: LayoutGrid,
        label: `Zoom → ${z}`,
        keywords: `range zoom ${z}`,
        run: () => store.setZoom(z),
      })
    })

    // ── Selection actions (gated on current selection) ──
    if (store.selectedAssignmentId) {
      cmds.push({
        id: 'sel.unassign',
        section: 'Selected pairing',
        icon: Trash2,
        label: 'Unassign crew',
        shortcut: 'Del',
        destructive: true,
        keywords: 'delete remove',
        run: async () => {
          await api.deleteCrewAssignment(store.selectedAssignmentId!)
          store.selectAssignment(null)
          onRefresh()
        },
      })
      cmds.push({
        id: 'sel.pairing.details',
        section: 'Selected pairing',
        icon: Tag,
        label: 'Open pairing details',
        keywords: 'duty info',
        run: () => {
          store.setInspectorTab('duty')
          store.setRightPanelOpen(true)
        },
      })
      cmds.push({
        id: 'sel.pairing.legality',
        section: 'Selected pairing',
        icon: Scale,
        label: 'Show legality',
        shortcut: 'L',
        keywords: 'violation check fdtl',
        run: () => {
          store.setInspectorTab('duty')
          store.setRightPanelOpen(true)
        },
      })
    }
    if (store.selectedActivityId) {
      cmds.push({
        id: 'sel.activity.delete',
        section: 'Selected activity',
        icon: Trash2,
        label: 'Delete activity',
        shortcut: 'Del',
        destructive: true,
        keywords: 'remove',
        run: async () => {
          await api.deleteCrewActivity(store.selectedActivityId!)
          store.selectActivity(null)
          onRefresh()
        },
      })
    }

    // ── Crew selection ──────────────────────────────────
    if (store.selectedCrewId) {
      const current = store.crew.find((c) => c._id === store.selectedCrewId)
      const who = current ? `${current.lastName} ${current.firstName}` : 'selected crew'
      cmds.push({
        id: 'crew.bio',
        section: 'Selected crew',
        icon: BookUser,
        label: `Crew bio — ${who}`,
        shortcut: 'B',
        keywords: 'profile',
        run: () => {
          store.setInspectorTab('bio')
          store.setRightPanelOpen(true)
        },
      })
      cmds.push({
        id: 'crew.expiry',
        section: 'Selected crew',
        icon: CalendarCheck,
        label: `Expiry dates — ${who}`,
        shortcut: 'E',
        keywords: 'license training',
        run: () => {
          store.setInspectorTab('expiry')
          store.setRightPanelOpen(true)
        },
      })
      cmds.push({
        id: 'crew.exclude',
        section: 'Selected crew',
        icon: EyeOff,
        label: `Exclude from view — ${who}`,
        shortcut: 'H',
        keywords: 'hide',
        run: () => store.excludeCrew(store.selectedCrewId!),
      })
    }
    if (store.excludedCrewIds.size > 0) {
      cmds.push({
        id: 'crew.unhide-all',
        section: 'Crew list',
        icon: Eye,
        label: `Restore ${store.excludedCrewIds.size} excluded crew`,
        keywords: 'show unhide',
        run: () => store.clearExcludedCrew(),
      })
    }

    // ── Range selection ─────────────────────────────────
    if (store.rangeSelection) {
      cmds.push({
        id: 'range.clear',
        section: 'Range selection',
        icon: EyeOff,
        label: 'Clear range selection',
        shortcut: 'Esc',
        keywords: 'cancel',
        run: () => store.clearRangeSelection(),
      })
      cmds.push({
        id: 'range.assign-series',
        section: 'Range selection',
        icon: CalendarRange,
        label: 'Assign series of duties…',
        keywords: 'series activity code multi',
        run: () => {
          store.setInspectorTab('assign')
          store.setRightPanelOpen(true)
        },
      })
    }

    // ── Publication ─────────────────────────────────────
    cmds.push({
      id: 'publish.compare',
      section: 'Publication',
      icon: GitCompare,
      label: store.publishedOverlayVisible ? 'Hide published overlay' : 'Compare to published',
      shortcut: 'Ctrl+Shift+P',
      keywords: 'publish overlay diff snapshot f10',
      run: () => {
        void store.togglePublishedOverlay()
      },
    })
    cmds.push({
      id: 'publish.now',
      section: 'Publication',
      icon: Upload,
      label: 'Publish current schedule',
      keywords: 'baseline snapshot finalize',
      run: async () => {
        await api.publishCrewSchedule({
          periodFromIso: store.periodFromIso,
          periodToIso: store.periodToIso,
        })
        onRefresh()
      },
    })

    // ── Export ──────────────────────────────────────────
    cmds.push({
      id: 'export.png',
      section: 'Export',
      icon: Download,
      label: 'Download as PNG',
      keywords: 'export image save screenshot',
      run: () => {
        downloadScheduleImage(store.exportCanvasRef, store.periodFromIso, store.periodToIso)
      },
    })
    cmds.push({
      id: 'export.copy',
      section: 'Export',
      icon: Clipboard,
      label: 'Copy as image to clipboard',
      keywords: 'copy paste image',
      run: () => {
        void copyScheduleImageToClipboard(store.exportCanvasRef)
      },
    })
    cmds.push({
      id: 'export.print',
      section: 'Export',
      icon: Printer,
      label: 'Print… / Save as PDF',
      keywords: 'print pdf',
      run: () => printSchedule(),
    })

    // ── Help ────────────────────────────────────────────
    cmds.push({
      id: 'help.cheatsheet',
      section: 'Help',
      icon: HelpCircle,
      label: 'Keyboard shortcuts',
      shortcut: '?',
      keywords: 'shortcuts help cheatsheet',
      run: () => onOpenCheatsheet(),
    })
    cmds.push({
      id: 'help.uncrewed',
      section: 'Help',
      icon: Users,
      label: 'Show uncrewed duties',
      keywords: 'unfilled open seat',
      run: () => {
        // The uncrewed tray is always rendered; this closes the inspector
        // to make sure it's visible.
        store.setRightPanelOpen(false)
      },
    })
    cmds.push({
      id: 'help.swap-hint',
      section: 'Help',
      icon: ArrowLeftRight,
      label: 'How to swap duties',
      keywords: 'swap help',
      run: () => onOpenCheatsheet(),
    })
    cmds.push({
      id: 'help.legality-hint',
      section: 'Help',
      icon: Activity,
      label: 'About legality checks',
      keywords: 'fdtl legal violation',
      run: () => onOpenCheatsheet(),
    })

    return cmds
  }, [store, isFullscreen, onFullscreen, onOpenCheatsheet, onRefresh])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => {
      const hay = `${c.label} ${c.keywords ?? ''} ${c.section}`.toLowerCase()
      return q.split(/\s+/).every((tok) => hay.includes(tok))
    })
  }, [commands, query])

  // Reset active index when filter narrows; keep it in-bounds.
  useEffect(() => {
    setActiveIdx((i) => Math.min(i, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  const run = (cmd: CommandItem) => {
    onClose()
    // Defer so the modal close animation doesn't fight with, say, an
    // inspector opening underneath.
    setTimeout(() => {
      void cmd.run()
    }, 0)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => Math.min(filtered.length - 1, i + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => Math.max(0, i - 1))
      } else if (e.key === 'Enter') {
        const cmd = filtered[activeIdx]
        if (cmd) {
          e.preventDefault()
          run(cmd)
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, filtered, activeIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the active item scrolled into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLButtonElement>(`[data-cmd-idx="${activeIdx}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  if (!open) return null

  // Group filtered items by section for the rendered list.
  const grouped: Array<[string, CommandItem[]]> = []
  for (const cmd of filtered) {
    const last = grouped[grouped.length - 1]
    if (last && last[0] === cmd.section) last[1].push(cmd)
    else grouped.push([cmd.section, [cmd]])
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10002] flex items-start justify-center pt-[12vh]"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[640px] max-w-[92vw] max-h-[70vh] rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,0.99)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        }}
      >
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
        >
          <Search className="w-4 h-4 text-hz-text-tertiary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search actions — swap, bio, zoom, 14d…"
            className="flex-1 h-8 bg-transparent outline-none text-[14px] placeholder:text-hz-text-tertiary"
          />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-hz-text-tertiary">
            {filtered.length}
          </span>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto py-1">
          {grouped.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-hz-text-tertiary">No matches</div>
          ) : (
            grouped.map(([section, items]) => (
              <div key={section}>
                <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-hz-text-tertiary">
                  {section}
                </div>
                {items.map((cmd) => {
                  const idx = filtered.indexOf(cmd)
                  const active = idx === activeIdx
                  return (
                    <button
                      key={cmd.id}
                      data-cmd-idx={idx}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => run(cmd)}
                      className="w-full flex items-center gap-2.5 h-9 px-4 text-left transition-colors"
                      style={{
                        background: active
                          ? isDark
                            ? 'rgba(62,123,250,0.15)'
                            : 'rgba(62,123,250,0.10)'
                          : 'transparent',
                        color: cmd.destructive ? '#E63535' : undefined,
                      }}
                    >
                      <cmd.icon className="w-4 h-4 shrink-0" />
                      <span className="text-[13px] font-medium flex-1 truncate">{cmd.label}</span>
                      {cmd.shortcut && <ShortcutBadge>{cmd.shortcut}</ShortcutBadge>}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div
          className="px-4 py-2 flex items-center justify-between text-[11px] text-hz-text-tertiary"
          style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
        >
          <span className="flex items-center gap-1">
            <kbd className="px-1 h-4 rounded text-[10px] font-mono bg-hz-border/30">↑</kbd>
            <kbd className="px-1 h-4 rounded text-[10px] font-mono bg-hz-border/30">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 h-4 rounded text-[10px] font-mono bg-hz-border/30">Enter</kbd>
            run
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 h-4 rounded text-[10px] font-mono bg-hz-border/30">Esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ──────────────────────────────────────────────────────────── */

interface CommandItem {
  id: string
  section: string
  icon: LucideIcon
  label: string
  shortcut?: string
  keywords?: string
  destructive?: boolean
  run: () => void | Promise<void>
}

function ShortcutBadge({ children }: { children: ReactNode }) {
  return (
    <kbd
      className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 font-mono font-semibold rounded text-[10px] shrink-0"
      style={{
        background: 'rgba(125,125,140,0.15)',
        border: '1px solid rgba(125,125,140,0.25)',
        color: 'var(--hz-text-secondary, inherit)',
      }}
    >
      {children}
    </kbd>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
