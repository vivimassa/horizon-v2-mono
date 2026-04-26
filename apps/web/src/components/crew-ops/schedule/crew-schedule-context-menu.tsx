'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Activity,
  BookUser,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Copy,
  CopyPlus,
  Eye,
  EyeOff,
  FileText,
  Filter,
  GitCompare,
  Info,
  Loader2,
  MapPin,
  Move,
  Phone,
  RefreshCw,
  Repeat,
  Scale,
  Sigma,
  StickyNote,
  Trash2,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { useDateFormat } from '@/hooks/use-date-format'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'

interface Props {
  onAfterMutate: () => void
}

/**
 * Target-dispatched context menu for the 4.1.6 Crew Schedule.
 *
 * Each `menu.kind` (pairing / activity / empty-cell / crew-name /
 * date-header / block) renders its own items per the AIMS §4.2-4.6
 * mapping captured in the 4.1.6 plan. Items show their keyboard
 * shortcut right-aligned (Gmail-style). Items that require work
 * not yet shipped are disabled with a "Phase N" hint.
 */
export function CrewScheduleContextMenu({ onAfterMutate }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const menu = useCrewScheduleStore((s) => s.contextMenu)
  const closeContextMenu = useCrewScheduleStore((s) => s.closeContextMenu)
  const selectAssignment = useCrewScheduleStore((s) => s.selectAssignment)
  const selectActivity = useCrewScheduleStore((s) => s.selectActivity)
  const selectCrew = useCrewScheduleStore((s) => s.selectCrew)
  const selectDateCell = useCrewScheduleStore((s) => s.selectDateCell)
  const setInspectorTab = useCrewScheduleStore((s) => s.setInspectorTab)
  const setRightPanelOpen = useCrewScheduleStore((s) => s.setRightPanelOpen)
  const excludeCrew = useCrewScheduleStore((s) => s.excludeCrew)
  const clearRangeSelection = useCrewScheduleStore((s) => s.clearRangeSelection)
  const setSwapPicker = useCrewScheduleStore((s) => s.setSwapPicker)
  const setTargetPickerMode = useCrewScheduleStore((s) => s.setTargetPickerMode)
  const openCrewOnPairingDialog = useCrewScheduleStore((s) => s.openCrewOnPairingDialog)
  const openPairingDetailsDialog = useCrewScheduleStore((s) => s.openPairingDetailsDialog)
  const openDateTotalsDialog = useCrewScheduleStore((s) => s.openDateTotalsDialog)
  const openLegalityReportDialog = useCrewScheduleStore((s) => s.openLegalityReportDialog)
  const openMemoOverlay = useCrewScheduleStore((s) => s.openMemoOverlay)
  const openFlightScheduleChangesDialog = useCrewScheduleStore((s) => s.openFlightScheduleChangesDialog)
  const openCrewExtraInfoDialog = useCrewScheduleStore((s) => s.openCrewExtraInfoDialog)
  const patchCrewScheduleVisibility = useCrewScheduleStore((s) => s.patchCrewScheduleVisibility)
  const reconcilePeriod = useCrewScheduleStore((s) => s.reconcilePeriod)

  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [menu, closeContextMenu])

  const items = useMemo<Section[] | null>(() => {
    if (!menu) return null

    const openInspectorOnTab = (t: 'duty' | 'assign' | 'bio' | 'expiry') => {
      setRightPanelOpen(true)
      setInspectorTab(t)
    }

    const buildEmptyCellSections = (crewId: string, dateIso: string): Section[] => [
      [
        {
          icon: Activity,
          label: 'Assign activity…',
          shortcut: 'A',
          onClick: () => {
            selectDateCell(crewId, dateIso)
            openInspectorOnTab('assign')
          },
        },
        {
          icon: ClipboardList,
          label: 'Assign pairing…',
          shortcut: 'P',
          onClick: () => {
            useCrewScheduleStore.getState().openDialogFor({ kind: 'assign-pairing', crewId, dateIso })
          },
        },
        {
          icon: Copy,
          label: 'Copy previous day',
          onClick: async () => {
            setBusy(true)
            try {
              const store = useCrewScheduleStore.getState()
              const prev = new Date(new Date(dateIso + 'T00:00:00Z').getTime() - 86_400_000).toISOString().slice(0, 10)
              const source = store.activities.find(
                (a) =>
                  a.crewId === crewId &&
                  ((a.dateIso && a.dateIso === prev) || (!a.dateIso && a.startUtcIso.slice(0, 10) === prev)),
              )
              if (!source) {
                console.warn('Copy previous day: no activity found for', crewId, prev)
                return
              }
              await api.createCrewActivity({
                crewId,
                activityCodeId: source.activityCodeId,
                dateIso,
                notes: source.notes ?? null,
              })
              await store.reconcilePeriod()
              onAfterMutate()
            } finally {
              setBusy(false)
              closeContextMenu()
            }
          },
        },
        {
          icon: CalendarRange,
          label: 'Assign series of duties…',
          onClick: () => {
            useCrewScheduleStore.getState().openDialogFor({
              kind: 'assign-series',
              fromIso: dateIso,
              toIso: dateIso,
              crewId,
            })
          },
        },
      ],
      [
        {
          icon: StickyNote,
          label: 'View / edit day memo',
          shortcut: 'M',
          onClick: () => {
            openMemoOverlay({ scope: 'day', crewId, dateIso })
            closeContextMenu()
          },
        },
        {
          icon: Scale,
          label: 'Legality Check',
          shortcut: 'L',
          onClick: () => {
            useCrewScheduleStore.getState().openLegalityCheck({ kind: 'crew', crewId })
          },
        },
      ],
    ]

    switch (menu.kind) {
      case 'pairing':
        return [
          [
            {
              icon: Info,
              label: 'Pairing details',
              shortcut: 'Enter',
              onClick: () => {
                // Resolve the pairingId from the assignment the user clicked
                // on. The full 4.1.5.2 Pairing Details dialog is keyed by
                // pairing — the assignment is just our path to it.
                const pairingId = useCrewScheduleStore
                  .getState()
                  .assignments.find((a) => a._id === menu.targetId)?.pairingId
                if (!pairingId) return
                openPairingDetailsDialog({ pairingId })
              },
            },
            {
              icon: Scale,
              label: 'Legality Check',
              shortcut: 'L',
              onClick: () => {
                const pairingId = useCrewScheduleStore
                  .getState()
                  .assignments.find((a) => a._id === menu.targetId)?.pairingId
                if (!pairingId) return
                useCrewScheduleStore
                  .getState()
                  .openLegalityCheck({ kind: 'assignment', pairingId, crewId: menu.crewId || null })
              },
            },
            {
              icon: Users,
              label: 'Crew on same pairing',
              shortcut: 'C',
              onClick: () => {
                const pairingId = useCrewScheduleStore
                  .getState()
                  .assignments.find((a) => a._id === menu.targetId)?.pairingId
                if (!pairingId) return
                openCrewOnPairingDialog({ pairingId })
                closeContextMenu()
              },
            },
            {
              icon: StickyNote,
              label: 'View / edit memo',
              shortcut: 'M',
              onClick: () => {
                // For a pairing bar, load the pairing id from the assignment.
                const pairingId = useCrewScheduleStore
                  .getState()
                  .assignments.find((a) => a._id === menu.targetId)?.pairingId
                if (!pairingId) return
                openMemoOverlay({ scope: 'pairing', targetId: pairingId })
                closeContextMenu()
              },
            },
            {
              icon: GitCompare,
              label: 'Flight schedule changes',
              onClick: () => {
                const pairingId = useCrewScheduleStore
                  .getState()
                  .assignments.find((a) => a._id === menu.targetId)?.pairingId
                if (!pairingId) return
                openFlightScheduleChangesDialog({ pairingId })
                closeContextMenu()
              },
            },
          ],
          [
            {
              icon: Repeat,
              label: 'Swap with…',
              shortcut: 'S',
              onClick: () => {
                const pairing = useCrewScheduleStore
                  .getState()
                  .pairings.find(
                    (p) =>
                      p._id ===
                      useCrewScheduleStore.getState().assignments.find((a) => a._id === menu.targetId)?.pairingId,
                  )
                setSwapPicker({
                  sourceAssignmentId: menu.targetId,
                  sourceCrewId: menu.crewId,
                  sourcePairingCode: pairing?.pairingCode ?? '?',
                  targetAssignmentId: null,
                })
                closeContextMenu()
              },
            },
          ],
          [
            {
              icon: Trash2,
              label: 'Unassign crew',
              shortcut: 'Del',
              destructive: true,
              onClick: async () => {
                // Optimistic IDs are client-only — would 404 on DELETE.
                // Just clear the selection and let the next reconcile
                // replace the bar with its real server-backed version.
                if (menu.targetId.startsWith('__optimistic_')) {
                  selectAssignment(null)
                  closeContextMenu()
                  return
                }
                setBusy(true)
                let serverGone = true
                try {
                  await api.deleteCrewAssignment(menu.targetId)
                } catch (err) {
                  const status = (err as { status?: number })?.status
                  if (status !== 404) {
                    serverGone = false
                    console.error('Failed to unassign crew:', err)
                  }
                }
                if (serverGone) {
                  // Optimistic local strip — see crew-schedule-shell.tsx
                  // delete handler for full rationale.
                  useCrewScheduleStore.setState((st) => ({
                    assignments: st.assignments.filter((a) => a._id !== menu.targetId),
                  }))
                }
                selectAssignment(null)
                onAfterMutate()
                setBusy(false)
                closeContextMenu()
              },
            },
          ],
        ]

      case 'activity':
        return [
          [
            {
              icon: Info,
              label: 'Activity details',
              shortcut: 'Enter',
              onClick: () => {
                selectActivity(menu.targetId)
                openInspectorOnTab('duty')
              },
            },
            {
              icon: FileText,
              label: 'Edit times / notes',
              onClick: () => {
                useCrewScheduleStore.getState().openDialogFor({ kind: 'activity-edit', activityId: menu.targetId })
              },
            },
            {
              icon: Activity,
              label: 'Change code…',
              onClick: () => {
                useCrewScheduleStore
                  .getState()
                  .openDialogFor({ kind: 'activity-change-code', activityId: menu.targetId })
              },
            },
            {
              icon: CopyPlus,
              label: 'Duplicate across dates…',
              shortcut: 'D',
              onClick: () => {
                useCrewScheduleStore.getState().openDialogFor({ kind: 'activity-duplicate', activityId: menu.targetId })
              },
            },
          ],
          [
            {
              icon: Trash2,
              label: 'Delete activity',
              shortcut: 'Del',
              destructive: true,
              onClick: async () => {
                setBusy(true)
                try {
                  await api.deleteCrewActivity(menu.targetId)
                  selectActivity(null)
                  onAfterMutate()
                } finally {
                  setBusy(false)
                  closeContextMenu()
                }
              },
            },
          ],
        ]

      case 'empty-cell':
        return buildEmptyCellSections(menu.crewId, menu.dateIso)

      case 'crew-name':
        return [
          [
            {
              icon: BookUser,
              label: 'Crew bio',
              shortcut: 'B',
              onClick: () => {
                selectCrew(menu.crewId)
                openInspectorOnTab('bio')
              },
            },
            {
              icon: CalendarCheck,
              label: 'Expiry dates',
              shortcut: 'E',
              onClick: () => {
                selectCrew(menu.crewId)
                openInspectorOnTab('expiry')
              },
            },
            {
              icon: Scale,
              label: 'Legality Check',
              shortcut: 'L',
              onClick: () => {
                useCrewScheduleStore.getState().openLegalityCheck({ kind: 'crew', crewId: menu.crewId })
              },
            },
            {
              icon: StickyNote,
              label: 'Crew memo',
              shortcut: 'M',
              onClick: () => {
                openMemoOverlay({ scope: 'crew', targetId: menu.crewId })
                closeContextMenu()
              },
            },
          ],
          [
            (() => {
              const crewMember = useCrewScheduleStore.getState().crew.find((c) => c._id === menu.crewId)
              // `isScheduleVisible` defaults to true server-side, so
              // treat `undefined` (older docs) as visible.
              const isVisible = crewMember?.isScheduleVisible !== false
              return {
                icon: isVisible ? Eye : EyeOff,
                label: isVisible ? 'Hide from crew mobile' : 'Publish to crew mobile',
                shortcut: 'P',
                onClick: async () => {
                  setBusy(true)
                  const next = !isVisible
                  // Optimistic update so the label flips right away.
                  patchCrewScheduleVisibility(menu.crewId, next)
                  try {
                    await api.updateCrewMember(menu.crewId, { isScheduleVisible: next })
                    await reconcilePeriod()
                    onAfterMutate()
                  } catch (e) {
                    // Revert on failure.
                    patchCrewScheduleVisibility(menu.crewId, isVisible)
                    console.error('Toggle published schedule failed', e)
                  } finally {
                    setBusy(false)
                    closeContextMenu()
                  }
                },
              }
            })(),
            {
              icon: Info,
              label: 'Crew extra info',
              onClick: () => {
                openCrewExtraInfoDialog({ crewId: menu.crewId })
                closeContextMenu()
              },
            },
            {
              icon: RefreshCw,
              label: 'Refresh this crew',
              shortcut: 'R',
              onClick: () => {
                onAfterMutate()
                closeContextMenu()
              },
            },
            { icon: Phone, label: 'Call crew member', phase: 'Deferred' },
          ],
          [
            {
              icon: EyeOff,
              label: 'Exclude from view',
              shortcut: 'H',
              onClick: () => {
                excludeCrew(menu.crewId)
                closeContextMenu()
              },
            },
          ],
        ]

      case 'date-header':
        return [
          [
            {
              icon: Users,
              label: 'Uncrewed duties for this date',
              onClick: () => {
                // Uncrewed tray is always visible; just ensure the inspector
                // isn't covering it. In a future pass we'll scroll the tray
                // to chips that start on this date.
                setRightPanelOpen(false)
                closeContextMenu()
              },
            },
            {
              icon: Filter,
              label: 'Uncrewed-duty customization',
              onClick: () => {
                useCrewScheduleStore.getState().setUncrewedFilterSheetOpen(true)
                closeContextMenu()
              },
            },
            {
              icon: Filter,
              label: 'Group crew together…',
              shortcut: 'G',
              onClick: () => {
                useCrewScheduleStore.getState().openDialogFor({ kind: 'group-crew', dateIso: menu.dateIso })
              },
            },
            {
              icon: Sigma,
              label: 'Flight / Duty time totals',
              shortcut: 'T',
              onClick: () => {
                openDateTotalsDialog({ dateIso: menu.dateIso })
                closeContextMenu()
              },
            },
          ],
          [
            {
              icon: Scale,
              label: 'Legality Check',
              shortcut: 'L',
              onClick: () => {
                useCrewScheduleStore.getState().openLegalityCheck({ kind: 'date', dateIso: menu.dateIso })
              },
            },
          ],
        ]

      case 'temp-base': {
        const tb = useCrewScheduleStore.getState().tempBases.find((t) => t._id === menu.tempBaseId)
        if (!tb) return null
        const base = buildEmptyCellSections(menu.crewId, menu.dateIso)
        return [
          ...base,
          [
            {
              icon: MapPin,
              label: 'Modify Temp Assignment…',
              onClick: () => {
                useCrewScheduleStore.getState().openTempBaseDialog({
                  crewIds: [tb.crewId],
                  fromIso: tb.fromIso,
                  toIso: tb.toIso,
                  editingId: tb._id,
                })
              },
            },
          ],
        ]
      }

      case 'block': {
        // Resolve the activities + assignments across every crew in the
        // range so Delete can wipe them in one pass. Single-crew blocks
        // keep AIMS §4.6 semantics (copy/move/swap); multi-crew hides
        // those items since they don't map to a single source.
        const store = useCrewScheduleStore.getState()
        const crewIdSet = new Set(menu.crewIds)
        const inRangeActivities = store.activities.filter(
          (a) =>
            crewIdSet.has(a.crewId) &&
            a.startUtcIso.slice(0, 10) <= menu.toIso &&
            a.endUtcIso.slice(0, 10) >= menu.fromIso,
        )
        const inRangeAssignments = store.assignments.filter(
          (a) =>
            crewIdSet.has(a.crewId) &&
            a.startUtcIso.slice(0, 10) <= menu.toIso &&
            a.endUtcIso.slice(0, 10) >= menu.fromIso,
        )
        const deleteCount = inRangeActivities.length + inRangeAssignments.length
        const singleCrewId = menu.crewIds.length === 1 ? menu.crewIds[0] : null
        const topItems: MenuItem[] = [
          {
            icon: CalendarRange,
            label: 'Assign series of duties…',
            shortcut: 'A',
            onClick: () => {
              // Series dialog is single-crew today; open for the first
              // crew in the range. Multi-crew assign-series is a future
              // extension of the dialog.
              useCrewScheduleStore.getState().openDialogFor({
                kind: 'assign-series',
                fromIso: menu.fromIso,
                toIso: menu.toIso,
                crewId: menu.crewIds[0],
              })
            },
          },
        ]
        if (singleCrewId) {
          topItems.push(
            {
              icon: Copy,
              label: 'Copy block',
              shortcut: 'C',
              onClick: () => {
                setTargetPickerMode({
                  kind: 'copy-block',
                  sourceCrewId: singleCrewId,
                  fromIso: menu.fromIso,
                  toIso: menu.toIso,
                })
                closeContextMenu()
              },
            },
            {
              icon: Move,
              label: 'Move block',
              shortcut: 'X',
              onClick: () => {
                setTargetPickerMode({
                  kind: 'move-block',
                  sourceCrewId: singleCrewId,
                  fromIso: menu.fromIso,
                  toIso: menu.toIso,
                })
                closeContextMenu()
              },
            },
            {
              icon: Repeat,
              label: 'Swap block with crew…',
              shortcut: 'S',
              onClick: () => {
                setTargetPickerMode({
                  kind: 'swap-block',
                  sourceCrewId: singleCrewId,
                  fromIso: menu.fromIso,
                  toIso: menu.toIso,
                })
                closeContextMenu()
              },
            },
          )
        }
        topItems.push({
          icon: MapPin,
          label: 'Temporary Base Assignment…',
          onClick: () => {
            useCrewScheduleStore.getState().openTempBaseDialog({
              crewIds: menu.crewIds,
              fromIso: menu.fromIso,
              toIso: menu.toIso,
            })
          },
        })
        topItems.push({
          icon: Scale,
          label: 'Legality Check',
          shortcut: 'L',
          onClick: () => {
            useCrewScheduleStore.getState().openLegalityCheck({
              kind: 'block',
              crewIds: menu.crewIds,
              fromIso: menu.fromIso,
              toIso: menu.toIso,
            })
            closeContextMenu()
          },
        })
        return [
          topItems,
          [
            {
              icon: Trash2,
              label: deleteCount > 0 ? `Delete ${deleteCount} dut${deleteCount === 1 ? 'y' : 'ies'}` : 'Delete block',
              shortcut: 'Del',
              destructive: true,
              onClick:
                deleteCount === 0
                  ? undefined
                  : async () => {
                      setBusy(true)
                      try {
                        // allSettled so one failed delete doesn't abort the
                        // batch — user sees the remaining rows disappear on
                        // refresh, failures get logged for diagnosis.
                        const results = await Promise.allSettled([
                          ...inRangeActivities.map((a) => api.deleteCrewActivity(a._id)),
                          ...inRangeAssignments.map((a) => api.deleteCrewAssignment(a._id)),
                        ])
                        const failures = results.filter((r) => r.status === 'rejected')
                        if (failures.length > 0) {
                          console.error('Block delete: %d/%d failed', failures.length, results.length, failures)
                        }
                        clearRangeSelection()
                        onAfterMutate()
                      } finally {
                        setBusy(false)
                        closeContextMenu()
                      }
                    },
            },
          ],
        ]
      }
    }
  }, [
    menu,
    closeContextMenu,
    excludeCrew,
    onAfterMutate,
    selectActivity,
    selectAssignment,
    selectCrew,
    selectDateCell,
    setInspectorTab,
    setRightPanelOpen,
    clearRangeSelection,
    setSwapPicker,
    setTargetPickerMode,
    openCrewOnPairingDialog,
    openPairingDetailsDialog,
    openDateTotalsDialog,
    openLegalityReportDialog,
    openMemoOverlay,
    openFlightScheduleChangesDialog,
    openCrewExtraInfoDialog,
    patchCrewScheduleVisibility,
    reconcilePeriod,
  ])

  if (!menu || !items) return null

  const panelBg = isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.98)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  const W = 260
  const totalItems = items.reduce((n, s) => n + s.length, 0)
  const H = totalItems * 36 + items.length * 2 + 8
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900
  const left = Math.min(menu.pageX, vw - W - 8)
  const top = Math.min(menu.pageY, vh - H - 8)

  // Dismiss via a transparent backdrop rather than a document `mousedown`
  // listener: the listener-based approach was preventing menu-item clicks
  // from firing (some menus were dismissed before `click` got a chance to
  // reach the button). The backdrop + stopPropagation pair is race-free.
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[9999]"
        onMouseDown={closeContextMenu}
        onContextMenu={(e) => {
          e.preventDefault()
          closeContextMenu()
        }}
      />
      <div
        ref={ref}
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        className="fixed z-[10000] rounded-xl overflow-hidden select-none py-1"
        style={{
          top,
          left,
          width: W,
          background: panelBg,
          border: `1px solid ${panelBorder}`,
          backdropFilter: 'blur(24px)',
          boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(96,97,112,0.14)',
        }}
      >
        <MenuHeader menu={menu} />
        {items.map((section, i) => (
          <div key={i}>
            {i > 0 && <div className="h-px mx-2 my-1" style={{ background: panelBorder }} />}
            {section.map((it) => (
              <MenuItemRow key={it.label} item={it} busy={busy && !!it.destructive} />
            ))}
          </div>
        ))}
      </div>
    </>,
    document.body,
  )
}

/* ─────────────────────────────────────────────────────────────── */

type MenuItem = {
  icon: LucideIcon
  label: string
  shortcut?: string
  onClick?: () => void | Promise<void>
  destructive?: boolean
  /** When set, the item is disabled and a small phase badge is shown. */
  phase?: string
}
type Section = MenuItem[]

function MenuItemRow({ item, busy }: { item: MenuItem; busy: boolean }) {
  const disabled = !!item.phase || !item.onClick
  return (
    <button
      onClick={item.onClick}
      disabled={disabled || busy}
      className="w-full flex items-center gap-2.5 h-9 px-3 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-hz-border/20 disabled:hover:bg-transparent"
      style={item.destructive && !disabled ? { color: '#E63535' } : undefined}
    >
      {busy ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        <item.icon
          className="w-4 h-4 shrink-0"
          style={item.destructive && !disabled ? { color: '#E63535' } : undefined}
        />
      )}
      <span className="text-[13px] font-medium truncate flex-1">{item.label}</span>
      {item.phase ? (
        <span
          className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded shrink-0"
          style={{
            backgroundColor: 'rgba(154,155,168,0.15)',
            color: 'var(--hz-text-tertiary, #9A9BA8)',
          }}
        >
          {item.phase}
        </span>
      ) : item.shortcut ? (
        <span className="text-[11px] text-hz-text-tertiary tabular-nums shrink-0">{item.shortcut}</span>
      ) : null}
    </button>
  )
}

function MenuHeader({ menu }: { menu: NonNullable<ReturnType<typeof useCrewScheduleStore.getState>['contextMenu']> }) {
  const fmt = useDateFormat()
  // Lightweight caption so the user can see what they right-clicked on.
  let label: ReactNode
  switch (menu.kind) {
    case 'pairing':
      label = 'Pairing'
      break
    case 'activity':
      label = 'Activity'
      break
    case 'empty-cell':
      label = fmt(menu.dateIso)
      break
    case 'crew-name':
      label = 'Crew'
      break
    case 'date-header':
      label = (
        <span className="flex items-center gap-1.5">
          <CalendarDays className="w-3 h-3" />
          {fmt(menu.dateIso)}
        </span>
      )
      break
    case 'block': {
      const nCrew = menu.crewIds.length
      const suffix = nCrew > 1 ? ` · ${nCrew} crew` : ''
      label = `${fmt(menu.fromIso)} → ${fmt(menu.toIso)}${suffix}`
      break
    }
    case 'temp-base': {
      const tb = useCrewScheduleStore.getState().tempBases.find((t) => t._id === menu.tempBaseId)
      label = (
        <span className="flex items-center gap-1.5">
          <CalendarDays className="w-3 h-3" />
          {fmt(menu.dateIso)}
          {tb ? ` · TEMP BASE ${tb.airportCode}` : ''}
        </span>
      )
      break
    }
  }
  return (
    <div className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-hz-text-tertiary">
      {label}
    </div>
  )
}
