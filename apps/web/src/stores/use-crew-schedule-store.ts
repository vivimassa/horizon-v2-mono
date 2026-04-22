'use client'

import { create } from 'zustand'
import {
  api,
  type ActivityCodeGroupRef,
  type ActivityCodeRef,
  type CrewActivityRef,
  type CrewAssignmentRef,
  type CrewMemberListItemRef,
  type CrewLegalityIssueRef,
  type CrewMemoRef,
  type CrewPositionRef,
  type CrewSchedulePublicationRef,
  type PairingRef,
  type UncrewedPairingRef,
} from '@skyhub/api'
import type { BarLabelMode, CrewScheduleZoom } from '@/lib/crew-schedule/layout'
import { sortCrewRoster } from '@/lib/crew-schedule/layout'
import { useOperatorStore } from '@/stores/use-operator-store'

/**
 * Store for 4.1.6 Crew Schedule. Mirrors `useGanttStore` shape:
 *
 *   • Committed view state (period, filters) drives data fetches.
 *   • Draft state lives inside the FilterPanel — it pushes drafts into the
 *     store on Go, then triggers `commitPeriod()`. The canvas NEVER reacts
 *     to filter changes until Go is clicked.
 *   • Raw data (pairings, crew, assignments, positions, uncrewed) lives in
 *     the store after a successful fetch. Shell/canvas read from here.
 */

interface Filters {
  baseIds: string[]
  positionIds: string[]
  acTypeIcaos: string[]
}

export interface UncrewedFilterState {
  /** Seat codes to require as missing on uncrewed pairings.
   *  Pairings are kept if they are missing AT LEAST ONE of these seats.
   *  Empty = no seat filter (all pass). */
  seatCodes: string[]
  /** Only pairings based at this airport code. null = any. */
  baseAirport: string | null
  /** Only pairings with this aircraft type ICAO. null = any. */
  aircraftTypeIcao: string | null
  /** Minimum total missing seat count (sum of `missing[].count`). */
  minMissingCount: number
}

const EMPTY_UNCREWED_FILTER: UncrewedFilterState = {
  seatCodes: [],
  baseAirport: null,
  aircraftTypeIcao: null,
  minMissingCount: 1,
}

/** Planner-defined temporary base assignment (server-backed, per-tenant).
 *  Covers [fromIso, toIso] (inclusive, UTC dates) for a single crew;
 *  used to visually mark the period on the Gantt and to suppress
 *  `base_mismatch` when the pairing operates out of the temp-base
 *  airport. */
export interface TempBaseAssignment {
  _id: string
  crewId: string
  fromIso: string
  toIso: string
  airportCode: string
}

export type CrewGroupingKind = 'activity' | 'base' | 'seat'
export interface CrewGroupingState {
  kind: CrewGroupingKind
  dateIso: string
}

interface SmartFilterState {
  hasRuleViolation: boolean
  hasExpiryAlert: boolean
  hasAnyDuty: boolean
  hasNoDuties: boolean
  activityCodeIds: string[]
  acTypes: string[]
  languages: string[]
  mode: 'show-only' | 'highlight' | 'exclude'
  combinator: 'any' | 'all'
}

const EMPTY_SMART_FILTER: SmartFilterState = {
  hasRuleViolation: false,
  hasExpiryAlert: false,
  hasAnyDuty: false,
  hasNoDuties: false,
  activityCodeIds: [],
  acTypes: [],
  languages: [],
  mode: 'show-only',
  combinator: 'any',
}

interface Data {
  pairings: PairingRef[]
  crew: CrewMemberListItemRef[]
  assignments: CrewAssignmentRef[]
  positions: CrewPositionRef[]
  uncrewed: UncrewedPairingRef[]
  activities: CrewActivityRef[]
  activityCodes: ActivityCodeRef[]
  activityGroups: ActivityCodeGroupRef[]
  memos: CrewMemoRef[]
  fdtl: {
    briefMinutes: number
    debriefMinutes: number
    restRules: { homeBaseMinMinutes: number; awayMinMinutes: number }
  }
  /** Full serialized FDTL rule set — drives the 4.1.6 FDTL-aware validator. */
  ruleSet: unknown | null
  /** Roster-level FDTL issues for the visible window. */
  crewIssues: CrewLegalityIssueRef[]
  aircraftTypes: Array<{ icaoType: string; family: string | null }>
}

interface ContextRefs {
  bases: Array<{ _id: string; iataCode: string | null; name: string }>
  acTypes: string[]
  loaded: boolean
}

interface State extends Data {
  // ── Committed view state (drives fetch) ──
  periodFromIso: string
  periodToIso: string
  filters: Filters

  // ── View state ──
  zoom: CrewScheduleZoom
  barLabelMode: BarLabelMode
  rowHeightLevel: number // 0..3
  /** Auto-refresh cadence in minutes. 5..59; 15 by default. Pages that
   *  don't wire an interval loop still expose this via the Format popover. */
  refreshIntervalMins: number

  // ── Selection / hover ──
  selectedCrewId: string | null
  selectedPairingId: string | null
  selectedAssignmentId: string | null
  selectedActivityId: string | null
  /** Local date (YYYY-MM-DD, UTC) set by a double-click on an empty cell.
   *  Opens the Assign tab's activity picker. Cleared when a pairing is
   *  selected or the user assigns an activity. */
  selectedDateIso: string | null
  /** When set, the Assign tab is in replace-mode: picking a code deletes
   *  this activity before creating the new one. Cleared after submit or
   *  when the Assign tab closes. */
  replaceActivityId: string | null
  /** Visual mode for the selected date cell.
   *  'view'   = single click, accent-color border (just showing focus).
   *  'assign' = double click / Assign action armed, red border. */
  cellSelectMode: 'view' | 'assign' | null
  hoveredAssignmentId: string | null
  hoveredActivityId: string | null

  /** Target-dispatched right-click menu state. Each kind drives a
   *  different menu contents (see `crew-schedule-context-menu.tsx`).
   *  Maps to AIMS §4.2-4.6. */
  contextMenu:
    | { kind: 'pairing'; targetId: string; crewId: string; pageX: number; pageY: number }
    | { kind: 'activity'; targetId: string; crewId: string; pageX: number; pageY: number }
    | { kind: 'empty-cell'; crewId: string; dateIso: string; pageX: number; pageY: number }
    | { kind: 'crew-name'; crewId: string; pageX: number; pageY: number }
    | { kind: 'date-header'; dateIso: string; pageX: number; pageY: number }
    | { kind: 'block'; crewIds: string[]; fromIso: string; toIso: string; pageX: number; pageY: number }
    | {
        kind: 'temp-base'
        tempBaseId: string
        crewId: string
        dateIso: string
        pageX: number
        pageY: number
      }
    | null

  /** Which inspector tab is active. Lifted to the store so context-menu
   *  items can jump straight to the right tab (e.g. "Bio" → 'bio'). */
  inspectorTab: 'duty' | 'assign' | 'bio' | 'expiry'

  /** Crew members excluded from the current view (AIMS §4.5 "Exclude
   *  selected crew"). Reset on refresh or via action. */
  excludedCrewIds: Set<string>

  /** Multi-day range selection on a single crew row (AIMS §4.6 block).
   *  Created by shift-drag; drives the block context menu. */
  rangeSelection: { crewIds: string[]; fromIso: string; toIso: string } | null

  /** Smart filter (AIMS §3 + §6.4) — client-side filter/highlight over
   *  the already-loaded crew.
   *
   *  `smartFilter` is the *committed* state — what the canvas/layout
   *  actually reads. `smartFilterDraft` is what the Smart Filter sheet
   *  is editing. The user must click the "Filter" CTA inside the sheet
   *  to copy draft → committed (mirrors the left FilterPanel Go button).
   */
  smartFilter: SmartFilterState
  smartFilterDraft: SmartFilterState

  /** Published snapshot loaded for the current period (AIMS F10). Null
   *  until the user toggles the overlay on — fetched lazily. */
  publishedOverlay: CrewSchedulePublicationRef | null
  /** Whether the canvas should render the overlay. Toggled independently
   *  of data load so flipping off doesn't discard the fetched snapshot. */
  publishedOverlayVisible: boolean

  /** Canvas DOM ref — registered by the canvas on mount so the Export
   *  action (P4.3) can serialise it to PNG without prop-drilling. */
  exportCanvasRef: HTMLCanvasElement | null

  /** Friendly capacity-exceeded dialog — surfaced when a Ctrl-drag Copy
   *  targets a pairing whose seat is already filled to capacity. Cleared
   *  by the dialog's OK button. */
  capacityError: {
    seatCode: string
    capacity: number
    attemptedIndex: number
    pairingCode: string | null
  } | null

  /** Brief toast shown when a drag-drop is silently aborted due to a
   *  rule violation. Gives the planner immediate feedback that the drop
   *  did NOT take effect (preferred over a blocking dialog per user
   *  preference: drag-time panel shows why, toast confirms the reject). */
  dropRejection: {
    reason: string
    at: number
  } | null

  /** Pending assignment that hit one or more planner-overridable rule
   *  violations (base mismatch today; FDP / rest / rank later). The
   *  `AssignmentOverrideDialog` reads this and — on Confirm — calls
   *  `proceed()` to fire the API with the violations as overrides. */
  assignmentOverridePending: {
    violations: import('@/lib/crew-schedule/violations').AssignmentViolation[]
    /** Description of the action for the confirm button — fires the
     *  real assignment POST when called. Receives planner-supplied
     *  reason text + commander-discretion flag for the audit row. */
    proceed: (ack?: { reason: string; commanderDiscretion: boolean }) => Promise<void>
  } | null

  /** Pending assignment blocked by one or more hard-block violations
   *  (e.g. crew not qualified on aircraft type). Dialog shows an OK-only
   *  acknowledgement — there is no "Assign anyway". No API call fires. */
  assignmentBlocked: {
    violations: import('@/lib/crew-schedule/violations').AssignmentViolation[]
  } | null

  /** Legality Check dialog state. Scope decides which issues to surface
   *  — 'all' from the toolbar, the others from context-menu items. */
  legalityCheck:
    | { kind: 'all' }
    | { kind: 'assignment'; pairingId: string; crewId: string | null }
    | { kind: 'crew'; crewId: string }
    | { kind: 'date'; dateIso: string }
    | { kind: 'block'; crewIds: string[]; fromIso: string; toIso: string }
    | null

  /** Temp base dialog — opened from the block context menu or from
   *  right-click on an existing band (then `editingId` is set and the
   *  dialog switches to Modify mode). */
  tempBaseDialog: { crewIds: string[]; fromIso: string; toIso: string; editingId?: string } | null

  /** Server-loaded list of temp-base assignments that overlap the
   *  visible period. Reads as suppression input for `base_mismatch` and
   *  paints a highlight band on the Gantt. */
  tempBases: TempBaseAssignment[]

  /** Memo overlay state — opens a small modal with a memo composer/list
   *  scoped to the right target. Set by the context-menu memo items and
   *  by Alt+M on a selected bar/crew/cell. */
  memoOverlay:
    | { scope: 'pairing'; targetId: string }
    | { scope: 'day'; crewId: string; dateIso: string }
    | { scope: 'crew'; targetId: string }
    | null

  /** Modal dialog state for Phase 2 activity/assignment editing flows.
   *  Discriminated union so only one dialog is open at a time. Mounted
   *  in the shell and opened from the context menu items. */
  openDialog:
    | { kind: 'activity-edit'; activityId: string }
    | { kind: 'activity-change-code'; activityId: string }
    | { kind: 'activity-duplicate'; activityId: string }
    | { kind: 'assign-pairing'; crewId: string; dateIso: string }
    | { kind: 'assign-series'; fromIso: string; toIso: string; crewId: string | null }
    | { kind: 'group-crew'; dateIso: string }
    | null

  /** Uncrewed-duties tray filter (AIMS §4.4). Applied client-side over
   *  the raw `uncrewed` list before lane layout. Persisted to localStorage. */
  uncrewedFilter: UncrewedFilterState
  /** Whether the uncrewed-filter bottom sheet is currently open. */
  uncrewedFilterSheetOpen: boolean
  /** Uncrewed tray height in pixels. Resizable via the drag handle
   *  between the main canvas and the tray (mirrors 4.1.5.2's pairing-zone
   *  resizer). Persists to localStorage. */
  uncrewedTrayHeight: number
  /** Whether the uncrewed tray is mounted at all. Hidden on first load
   *  (the page doesn't need to show the tray until the user asks for it
   *  via the ribbon toggle). Persists to localStorage. */
  uncrewedTrayVisible: boolean
  /** Date-scoped crew grouping (AIMS §4.4 "Group crew together"). When
   *  set, the layout's crew sort is replaced by the grouping algorithm. */
  crewGrouping: CrewGroupingState | null

  /** Swap-picker mode. When the user clicks "Swap with…" in a pairing
   *  context menu, the canvas enters this mode: the cursor hints at a
   *  swap target, and the next bar-click fills `targetAssignmentId`,
   *  which in turn opens the confirm dialog. Esc cancels. */
  swapPicker: {
    sourceAssignmentId: string
    sourceCrewId: string
    sourcePairingCode: string
    targetAssignmentId: string | null
  } | null

  /** Target-crew-row picker mode. Shared by:
   *   - 'copy-pairing' — Duplicate one pairing to another crew
   *   - 'copy-block'   — Copy a whole range of pairings to another crew
   *   - 'move-block'   — Reassign a whole range to another crew
   *   - 'swap-block'   — Atomic swap of a whole range between two crews
   *
   *  While set, the canvas + left panel intercept row clicks and
   *  dispatch the mode's handler instead of normal selection. Esc or
   *  an explicit Cancel clears it. A banner at the top of the canvas
   *  area explains the mode. */
  targetPickerMode:
    | {
        kind: 'copy-pairing'
        sourceAssignmentId: string
        sourceCrewId: string
        sourcePairingCode: string
      }
    | {
        kind: 'copy-block' | 'move-block' | 'swap-block'
        sourceCrewId: string
        fromIso: string
        toIso: string
      }
    | null

  /** Stand-alone dialogs opened from §4.2 / §4.4 / §4.6 context menus.
   *  Each null when closed; at most one is shown at a time thanks to
   *  the natural top-level modal stacking. */
  crewOnPairingDialog: { pairingId: string } | null
  /** Full pairing-details read-only modal (re-used from 4.1.5.2). */
  pairingDetailsDialog: { pairingId: string } | null
  dateTotalsDialog: { dateIso: string } | null
  legalityReportDialog:
    | { scope: 'date-all-crew'; dateIso: string }
    | { scope: 'block'; crewIds: string[]; fromIso: string; toIso: string }
    | null
  /** Phase 4 — right-click pairing → "Flight schedule changes". Shows
   *  STD/STA deltas between the pairing's frozen leg times and the
   *  current `flightInstances` docs. */
  flightScheduleChangesDialog: { pairingId: string } | null
  /** Phase 4 — right-click crew name → "Crew extra info". Metadata panel
   *  sourced from the Crew Master Data module. Read-only. */
  crewExtraInfoDialog: { crewId: string } | null

  /** Active drag-to-reassign state (AIMS §5.3 / P2.3). Canvas paints a
   *  row highlight + ghost bar while this is set. Modifier keys decide
   *  Move vs Copy on drop. */
  dragState: {
    /** Null when the drag was sourced from the uncrewed tray (no
     *  pre-existing assignment). Set for Move / Copy of an existing bar. */
    sourceAssignmentId: string | null
    /** Null when sourced from the uncrewed tray. */
    sourceCrewId: string | null
    pairingId: string
    /** Fill colour + bar label cloned from the source so the ghost
     *  matches the bar visually without needing a layout lookup. */
    ghostLabel: string
    /** Current cursor position in viewport pixels — updated on every
     *  mousemove so we don't re-render the store for cursor moves, only
     *  when the drop target changes. */
    cursorX: number
    cursorY: number
    /** Row under the cursor (or null if off-grid). */
    dropCrewId: string | null
    /** 'legal' | 'warning' | 'violation' | null — drives row tint. */
    dropLegality: 'legal' | 'warning' | 'violation' | null
    dropReason: string
    /** Failing FDTL / rule checks at the current drop target. Only
     *  populated when `dropLegality === 'warning' | 'violation'`;
     *  drives the inline Legality Check mini-panel beside the ghost.
     *  Empty array is valid (e.g. a non-FDTL block like overlap). */
    dropChecks?: Array<{
      label: string
      actual: string
      limit: string
      status: 'warning' | 'violation'
    }>
    /** True when violation is FDTL (overridable). Drop handler proceeds
     *  to create the assignment; server records an override audit row. */
    dropOverridable?: boolean
    /** Move = reassign; Copy = duplicate; assign-uncrewed = tray → row. */
    mode: 'move' | 'copy' | 'assign-uncrewed'
    /** Only present when mode === 'assign-uncrewed'. Drives the legality
     *  check and seat-pick algorithm on the canvas drop handler. */
    sourceMissingSeats?: Array<{ seatPositionId: string; seatCode: string; count: number }>
  } | null

  // ── Scroll / container ──
  containerWidth: number
  scrollLeft: number
  scrollTop: number
  scrollTargetMs: number | null

  // ── UI ──
  rightPanelOpen: boolean

  // ── Fetch state ──
  periodCommitted: boolean
  loading: boolean
  error: string | null

  // ── Context (loaded once) ──
  context: ContextRefs

  // ── Actions: committed-period + fetch ──
  setPeriod: (from: string, to: string) => void
  setFilters: (filters: Filters) => void
  commitPeriod: () => Promise<void>
  /** Silent background reconcile — re-fetches without toggling the
   *  global `loading` flag. Used after optimistic mutations so the
   *  runway overlay doesn't flash after a drop. */
  reconcilePeriod: () => Promise<void>
  loadContext: () => Promise<void>

  // ── Actions: view ──
  setZoom: (z: CrewScheduleZoom) => void
  cycleLabelMode: () => void
  setLabelMode: (m: BarLabelMode) => void
  setRowHeightLevel: (level: number) => void
  zoomRowIn: () => void
  zoomRowOut: () => void
  setRefreshIntervalMins: (mins: number) => void

  // ── Actions: selection / hover ──
  selectCrew: (id: string | null) => void
  selectPairing: (id: string | null) => void
  selectAssignment: (id: string | null) => void
  selectActivity: (id: string | null) => void
  /** Opens the activity picker. Clears pairing/activity selection so the
   *  right panel knows the user wants to assign (not inspect). */
  selectDateCell: (crewId: string, dateIso: string, mode?: 'view' | 'assign') => void
  clearDateCell: () => void
  /** Arms the Assign tab to replace an existing activity on the crew/date
   *  pair. The next pick deletes this activity first. */
  startReplaceActivity: (args: { activityId: string; crewId: string; dateIso: string }) => void
  clearReplaceActivity: () => void
  setHover: (id: string | null) => void
  setActivityHover: (id: string | null) => void
  openContextMenu: (menu: NonNullable<State['contextMenu']>) => void
  closeContextMenu: () => void
  setInspectorTab: (tab: State['inspectorTab']) => void
  excludeCrew: (id: string) => void
  includeCrew: (id: string) => void
  clearExcludedCrew: () => void
  setRangeSelection: (r: State['rangeSelection']) => void
  clearRangeSelection: () => void
  setDragState: (d: State['dragState']) => void
  clearDragState: () => void
  /** Optimistic local patch — bar jumps immediately on drop while the
   *  API round-trip + `commitPeriod()` reconcile in the background.
   *  `move` reassigns an existing row; `copy` appends a synthetic row
   *  (replaced by the real server doc on refresh). */
  applyOptimisticReassign: (
    op: { kind: 'move'; assignmentId: string; targetCrewId: string } | { kind: 'copy'; synthetic: CrewAssignmentRef },
  ) => void
  /** Optimistic assign from the Uncrewed tray: pushes a synthetic
   *  CrewAssignment so the bar appears instantly, AND decrements the
   *  matching missing-seat counter on the uncrewed entry (drops the
   *  entry when count=0, drops the pairing when missing is empty). */
  applyOptimisticAssignFromUncrewed: (op: {
    pairingId: string
    seatPositionId: string
    synthetic: CrewAssignmentRef
  }) => void
  setSwapPicker: (s: State['swapPicker']) => void
  clearSwapPicker: () => void
  setTargetPickerMode: (m: State['targetPickerMode']) => void
  clearTargetPickerMode: () => void
  openCrewOnPairingDialog: (d: NonNullable<State['crewOnPairingDialog']>) => void
  closeCrewOnPairingDialog: () => void
  openPairingDetailsDialog: (d: NonNullable<State['pairingDetailsDialog']>) => void
  closePairingDetailsDialog: () => void
  openDateTotalsDialog: (d: NonNullable<State['dateTotalsDialog']>) => void
  closeDateTotalsDialog: () => void
  openLegalityReportDialog: (d: NonNullable<State['legalityReportDialog']>) => void
  closeLegalityReportDialog: () => void
  openFlightScheduleChangesDialog: (d: NonNullable<State['flightScheduleChangesDialog']>) => void
  closeFlightScheduleChangesDialog: () => void
  openCrewExtraInfoDialog: (d: NonNullable<State['crewExtraInfoDialog']>) => void
  closeCrewExtraInfoDialog: () => void
  /** Optimistic patch of a crew member's `isScheduleVisible` flag. Used
   *  by the "Toggle published schedule" menu item so the label flips
   *  immediately on click; a silent `reconcilePeriod()` reconciles. */
  patchCrewScheduleVisibility: (crewId: string, isScheduleVisible: boolean) => void
  openDialogFor: (d: NonNullable<State['openDialog']>) => void
  closeDialog: () => void
  setUncrewedFilter: (patch: Partial<UncrewedFilterState>) => void
  resetUncrewedFilter: () => void
  setUncrewedFilterSheetOpen: (open: boolean) => void
  setUncrewedTrayHeight: (heightPx: number) => void
  toggleUncrewedTrayVisible: () => void
  setUncrewedTrayVisible: (visible: boolean) => void
  setCrewGrouping: (g: CrewGroupingState | null) => void
  openMemoOverlay: (o: NonNullable<State['memoOverlay']>) => void
  closeMemoOverlay: () => void
  openTempBaseDialog: (d: NonNullable<State['tempBaseDialog']>) => void
  closeTempBaseDialog: () => void
  setExportCanvasRef: (el: HTMLCanvasElement | null) => void
  setCapacityError: (e: State['capacityError']) => void
  clearCapacityError: () => void
  setDropRejection: (reason: string) => void
  clearDropRejection: () => void
  setAssignmentOverridePending: (p: State['assignmentOverridePending']) => void
  clearAssignmentOverridePending: () => void
  setAssignmentBlocked: (p: State['assignmentBlocked']) => void
  clearAssignmentBlocked: () => void
  openLegalityCheck: (scope: NonNullable<State['legalityCheck']>) => void
  closeLegalityCheck: () => void
  /** Fetch the latest publication for the current period and show it. */
  togglePublishedOverlay: () => Promise<void>
  /** Patches the *draft* smart-filter state. Canvas/layout are not
   *  affected until `commitSmartFilter()` is called. */
  setSmartFilterDraft: (patch: Partial<SmartFilterState>) => void
  /** Copies draft → committed. Called by the Smart Filter sheet's
   *  "Filter" button. */
  commitSmartFilter: () => void
  /** Initialises draft from committed — called when the sheet opens so
   *  edits start from what the user currently sees on the canvas. */
  initSmartFilterDraft: () => void
  /** Clears BOTH draft and committed so the canvas restores instantly. */
  resetSmartFilter: () => void

  // ── Actions: container / scroll ──
  setContainerWidth: (w: number) => void
  setScroll: (left: number, top: number) => void
  setScrollTarget: (ms: number | null) => void
  goToToday: () => void

  // ── Actions: UI ──
  setRightPanelOpen: (open: boolean) => void

  // ── Post-write refresh ──
  refresh: () => Promise<void>
}

const LABEL_MODES: BarLabelMode[] = ['pairing', 'sector', 'flight']

const LS_UNCREWED_FILTER = 'horizon.crewSchedule.uncrewedFilter'
const LS_GROUPING = 'horizon.crewSchedule.grouping'

function hydrateUncrewedTrayVisible(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('horizon.crewSchedule.uncrewedTrayVisible') === '1'
  } catch {
    return false
  }
}

function hydrateUncrewedTrayHeight(): number {
  const DEFAULT = 120
  if (typeof window === 'undefined') return DEFAULT
  try {
    const raw = window.localStorage.getItem('horizon.crewSchedule.uncrewedTrayHeight')
    const n = raw == null ? DEFAULT : parseInt(raw, 10)
    if (!Number.isFinite(n)) return DEFAULT
    return Math.max(48, Math.min(800, n))
  } catch {
    return DEFAULT
  }
}

function hydrateUncrewedFilter(): UncrewedFilterState {
  if (typeof window === 'undefined') return { ...EMPTY_UNCREWED_FILTER }
  try {
    const raw = window.localStorage.getItem(LS_UNCREWED_FILTER)
    if (!raw) return { ...EMPTY_UNCREWED_FILTER }
    const parsed = JSON.parse(raw) as Partial<UncrewedFilterState>
    return {
      seatCodes: Array.isArray(parsed.seatCodes) ? parsed.seatCodes.map(String) : [],
      baseAirport: typeof parsed.baseAirport === 'string' ? parsed.baseAirport : null,
      aircraftTypeIcao: typeof parsed.aircraftTypeIcao === 'string' ? parsed.aircraftTypeIcao : null,
      minMissingCount:
        typeof parsed.minMissingCount === 'number' && parsed.minMissingCount >= 1
          ? Math.min(10, Math.floor(parsed.minMissingCount))
          : 1,
    }
  } catch {
    return { ...EMPTY_UNCREWED_FILTER }
  }
}

function persistUncrewedFilter(f: UncrewedFilterState) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_UNCREWED_FILTER, JSON.stringify(f))
  } catch {
    // swallow — filter state is not critical
  }
}

function hydrateGrouping(): CrewGroupingState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_GROUPING)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CrewGroupingState>
    if (
      (parsed.kind === 'activity' || parsed.kind === 'base' || parsed.kind === 'seat') &&
      typeof parsed.dateIso === 'string'
    ) {
      return { kind: parsed.kind, dateIso: parsed.dateIso }
    }
    return null
  } catch {
    return null
  }
}

function persistGrouping(g: CrewGroupingState | null) {
  if (typeof window === 'undefined') return
  try {
    if (g) window.localStorage.setItem(LS_GROUPING, JSON.stringify(g))
    else window.localStorage.removeItem(LS_GROUPING)
  } catch {
    // swallow
  }
}

function defaultPeriod(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 6))
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export const useCrewScheduleStore = create<State>((set, get) => {
  const { from, to } = defaultPeriod()
  return {
    // Data
    pairings: [],
    crew: [],
    assignments: [],
    positions: [],
    uncrewed: [],
    activities: [],
    activityCodes: [],
    activityGroups: [],
    memos: [],
    // Fallback 0/0 — when FDTL scheme isn't loaded, duty windows collapse
    // to STD/STA. That's a single, obvious failure mode for troubleshooting.
    fdtl: {
      briefMinutes: 0,
      debriefMinutes: 0,
      restRules: { homeBaseMinMinutes: 0, awayMinMinutes: 0 },
    },
    ruleSet: null,
    crewIssues: [],
    aircraftTypes: [],

    // Committed view state
    periodFromIso: from,
    periodToIso: to,
    filters: { baseIds: [], positionIds: [], acTypeIcaos: [] },

    // View state
    zoom: '7D',
    barLabelMode: 'pairing',
    rowHeightLevel: 1,
    refreshIntervalMins: 15,

    // Selection / hover
    selectedCrewId: null,
    selectedPairingId: null,
    selectedAssignmentId: null,
    selectedActivityId: null,
    selectedDateIso: null,
    replaceActivityId: null,
    cellSelectMode: null,
    hoveredAssignmentId: null,
    hoveredActivityId: null,
    contextMenu: null,
    inspectorTab: 'duty',
    excludedCrewIds: new Set<string>(),
    rangeSelection: null,
    dragState: null,
    swapPicker: null,
    targetPickerMode: null,
    crewOnPairingDialog: null,
    pairingDetailsDialog: null,
    dateTotalsDialog: null,
    legalityReportDialog: null,
    flightScheduleChangesDialog: null,
    crewExtraInfoDialog: null,
    openDialog: null,
    memoOverlay: null,
    publishedOverlay: null,
    publishedOverlayVisible: false,
    exportCanvasRef: null,
    capacityError: null,
    dropRejection: null,
    assignmentOverridePending: null,
    assignmentBlocked: null,
    legalityCheck: null,
    smartFilter: { ...EMPTY_SMART_FILTER },
    smartFilterDraft: { ...EMPTY_SMART_FILTER },
    uncrewedFilter: hydrateUncrewedFilter(),
    uncrewedFilterSheetOpen: false,
    uncrewedTrayHeight: hydrateUncrewedTrayHeight(),
    uncrewedTrayVisible: hydrateUncrewedTrayVisible(),
    crewGrouping: hydrateGrouping(),
    tempBaseDialog: null,
    tempBases: [],

    // Scroll / container
    containerWidth: 0,
    scrollLeft: 0,
    scrollTop: 0,
    scrollTargetMs: null,

    // UI
    rightPanelOpen: true,

    // Fetch state
    periodCommitted: false,
    loading: false,
    error: null,

    // Context
    context: { bases: [], acTypes: [], loaded: false },

    // ── Committed period + fetch ──
    setPeriod: (from, to) => set({ periodFromIso: from, periodToIso: to }),
    setFilters: (filters) => set({ filters }),

    commitPeriod: async () => {
      const s = get()
      set({ loading: true, error: null })
      try {
        const res = await api.getCrewSchedule({
          from: s.periodFromIso,
          to: s.periodToIso,
          base: s.filters.baseIds.length === 1 ? s.filters.baseIds[0] : undefined,
          position: s.filters.positionIds.length === 1 ? s.filters.positionIds[0] : undefined,
          acType: s.filters.acTypeIcaos.length === 1 ? s.filters.acTypeIcaos[0] : undefined,
        })
        const sortedCrew = sortCrewRoster({
          crew: res.crew,
          assignments: res.assignments,
          activities: res.activities,
          pairings: res.pairings,
          positions: res.positions,
          grouping: get().crewGrouping,
        })
        set({
          pairings: res.pairings,
          crew: sortedCrew,
          assignments: res.assignments,
          positions: res.positions,
          uncrewed: res.uncrewed,
          activities: res.activities,
          activityCodes: res.activityCodes,
          activityGroups: res.activityGroups,
          memos: res.memos,
          fdtl: res.fdtl,
          ruleSet: res.ruleSet ?? null,
          crewIssues: res.crewIssues ?? [],
          aircraftTypes: res.aircraftTypes ?? [],
          tempBases: res.tempBases ?? [],
          periodCommitted: true,
          loading: false,
          error: null,
        })
      } catch (e) {
        set({
          loading: false,
          error: (e as Error).message,
        })
      }
    },

    reconcilePeriod: async () => {
      const s = get()
      try {
        const res = await api.getCrewSchedule({
          from: s.periodFromIso,
          to: s.periodToIso,
          base: s.filters.baseIds.length === 1 ? s.filters.baseIds[0] : undefined,
          position: s.filters.positionIds.length === 1 ? s.filters.positionIds[0] : undefined,
          acType: s.filters.acTypeIcaos.length === 1 ? s.filters.acTypeIcaos[0] : undefined,
        })
        // Preserve the row order of the last commit so optimistic
        // mutations (assign / delete / swap) never reshuffle the Gantt.
        // Existing crew keep their index; newly-surfaced crew append to
        // the end; removed crew fall out. A fresh sort only happens on
        // an explicit `commitPeriod` (Go, period change, filter change).
        const prevIndex = new Map(s.crew.map((c, i) => [c._id, i]))
        const nextCrew = [...res.crew].sort((a, b) => {
          const ia = prevIndex.has(a._id) ? (prevIndex.get(a._id) as number) : Number.POSITIVE_INFINITY
          const ib = prevIndex.has(b._id) ? (prevIndex.get(b._id) as number) : Number.POSITIVE_INFINITY
          if (ia !== ib) return ia - ib
          return 0
        })
        set({
          pairings: res.pairings,
          crew: nextCrew,
          assignments: res.assignments,
          positions: res.positions,
          uncrewed: res.uncrewed,
          activities: res.activities,
          activityCodes: res.activityCodes,
          activityGroups: res.activityGroups,
          memos: res.memos,
          fdtl: res.fdtl,
          ruleSet: res.ruleSet ?? null,
          crewIssues: res.crewIssues ?? [],
          aircraftTypes: res.aircraftTypes ?? [],
          tempBases: res.tempBases ?? [],
        })
        // Fire-and-forget roster re-evaluation. Any assignment / activity
        // mutation upstream (assign / swap / delete) can invalidate FDTL
        // findings, so we always sweep in the background. The next
        // reconcile picks up the refreshed issues.
        if (res.ruleSet) {
          const opId = useOperatorStore.getState().operator?._id
          if (opId) {
            void api
              .reevaluateCrewRoster({ operatorId: opId, from: s.periodFromIso, to: s.periodToIso })
              .then(async () => {
                const fresh = await api.getCrewSchedule({
                  from: s.periodFromIso,
                  to: s.periodToIso,
                  base: s.filters.baseIds.length === 1 ? s.filters.baseIds[0] : undefined,
                  position: s.filters.positionIds.length === 1 ? s.filters.positionIds[0] : undefined,
                  acType: s.filters.acTypeIcaos.length === 1 ? s.filters.acTypeIcaos[0] : undefined,
                })
                set({ crewIssues: fresh.crewIssues ?? [] })
              })
              .catch(() => {
                // Silent — stale crewIssues are self-healing on next fetch.
              })
          }
        }
      } catch {
        // Silent — caller already painted optimistic state. Next natural
        // refresh (period change, Go, etc.) will re-sync.
      }
    },

    loadContext: async () => {
      if (get().context.loaded) return
      try {
        const [airports, types, positions] = await Promise.all([
          api.getAirports({ crewBase: true }),
          api.getAircraftTypes(),
          api.getCrewPositions(),
        ])
        // Seed `positions` so the Position filter is selectable before the
        // first Go. The crew-schedule aggregator will overwrite this list
        // with the same rows on commitPeriod.
        const prevPositions = get().positions
        set({
          context: {
            bases: airports.map((a) => ({ _id: a._id, iataCode: a.iataCode, name: a.name })),
            acTypes: [...new Set(types.map((t) => t.icaoType))].sort(),
            loaded: true,
          },
          positions: prevPositions.length > 0 ? prevPositions : positions,
        })
      } catch {
        // non-fatal — filter dropdowns will remain empty
        set({ context: { bases: [], acTypes: [], loaded: true } })
      }
    },

    // ── View actions ──
    setZoom: (zoom) => set({ zoom }),
    cycleLabelMode: () => {
      const idx = LABEL_MODES.indexOf(get().barLabelMode)
      set({ barLabelMode: LABEL_MODES[(idx + 1) % LABEL_MODES.length] })
    },
    setLabelMode: (m) => set({ barLabelMode: m }),
    setRowHeightLevel: (level) => {
      const clamped = Math.max(0, Math.min(3, level))
      set({ rowHeightLevel: clamped })
    },
    zoomRowIn: () => set({ rowHeightLevel: Math.min(3, get().rowHeightLevel + 1) }),
    zoomRowOut: () => set({ rowHeightLevel: Math.max(0, get().rowHeightLevel - 1) }),
    setRefreshIntervalMins: (mins) => set({ refreshIntervalMins: Math.max(5, Math.min(59, mins)) }),

    // ── Selection / hover ──
    selectCrew: (id) => set({ selectedCrewId: id }),
    selectPairing: (id) => {
      // Picking a pairing clears any pending date-cell selection so the
      // right panel shows pairing details instead of the activity picker.
      set({ selectedPairingId: id, selectedDateIso: id ? null : get().selectedDateIso })
    },
    selectAssignment: (id) => set({ selectedAssignmentId: id }),
    selectActivity: (id) => set({ selectedActivityId: id }),
    selectDateCell: (crewId, dateIso, mode = 'view') =>
      set({
        selectedCrewId: crewId,
        selectedDateIso: dateIso,
        selectedPairingId: null,
        selectedAssignmentId: null,
        replaceActivityId: null,
        cellSelectMode: mode,
      }),
    clearDateCell: () => set({ selectedDateIso: null, replaceActivityId: null, cellSelectMode: null }),
    startReplaceActivity: ({ activityId, crewId, dateIso }) =>
      set({
        selectedCrewId: crewId,
        selectedDateIso: dateIso,
        replaceActivityId: activityId,
        selectedPairingId: null,
        selectedAssignmentId: null,
        selectedActivityId: null,
        cellSelectMode: 'assign',
      }),
    clearReplaceActivity: () => set({ replaceActivityId: null }),
    setHover: (id) => {
      if (get().hoveredAssignmentId === id) return
      set({ hoveredAssignmentId: id })
    },
    setActivityHover: (id) => {
      if (get().hoveredActivityId === id) return
      set({ hoveredActivityId: id })
    },
    openContextMenu: (menu) => set({ contextMenu: menu }),
    closeContextMenu: () => set({ contextMenu: null }),
    setInspectorTab: (tab) => set({ inspectorTab: tab }),
    excludeCrew: (id) => {
      const next = new Set(get().excludedCrewIds)
      next.add(id)
      set({ excludedCrewIds: next })
    },
    includeCrew: (id) => {
      const next = new Set(get().excludedCrewIds)
      next.delete(id)
      set({ excludedCrewIds: next })
    },
    clearExcludedCrew: () => set({ excludedCrewIds: new Set<string>() }),
    setRangeSelection: (r) => set({ rangeSelection: r }),
    clearRangeSelection: () => set({ rangeSelection: null }),
    setDragState: (d) => set({ dragState: d }),
    clearDragState: () => set({ dragState: null }),
    applyOptimisticReassign: (op) => {
      const list = get().assignments
      if (op.kind === 'move') {
        set({
          assignments: list.map((a) => (a._id === op.assignmentId ? { ...a, crewId: op.targetCrewId } : a)),
        })
      } else {
        set({ assignments: [...list, op.synthetic] })
      }
    },
    applyOptimisticAssignFromUncrewed: (op) => {
      const { assignments, uncrewed } = get()
      const nextUncrewed: typeof uncrewed = []
      for (const u of uncrewed) {
        if (u.pairingId !== op.pairingId) {
          nextUncrewed.push(u)
          continue
        }
        // Decrement the matching missing-seat entry. If count hits 0,
        // drop the entry. If missing is empty afterwards, drop the
        // whole pairing.
        const nextMissing: typeof u.missing = []
        for (const m of u.missing) {
          if (m.seatPositionId !== op.seatPositionId) {
            nextMissing.push(m)
            continue
          }
          const remaining = m.count - 1
          if (remaining > 0) nextMissing.push({ ...m, count: remaining })
        }
        if (nextMissing.length > 0) nextUncrewed.push({ ...u, missing: nextMissing })
      }
      set({
        assignments: [...assignments, op.synthetic],
        uncrewed: nextUncrewed,
      })
    },
    setSwapPicker: (s) => set({ swapPicker: s }),
    clearSwapPicker: () => set({ swapPicker: null }),
    setTargetPickerMode: (m) => set({ targetPickerMode: m }),
    clearTargetPickerMode: () => set({ targetPickerMode: null }),
    openCrewOnPairingDialog: (d) => set({ crewOnPairingDialog: d }),
    closeCrewOnPairingDialog: () => set({ crewOnPairingDialog: null }),
    openPairingDetailsDialog: (d) => set({ pairingDetailsDialog: d, contextMenu: null }),
    closePairingDetailsDialog: () => set({ pairingDetailsDialog: null }),
    openDateTotalsDialog: (d) => set({ dateTotalsDialog: d }),
    closeDateTotalsDialog: () => set({ dateTotalsDialog: null }),
    openLegalityReportDialog: (d) => set({ legalityReportDialog: d }),
    closeLegalityReportDialog: () => set({ legalityReportDialog: null }),
    openFlightScheduleChangesDialog: (d) => set({ flightScheduleChangesDialog: d, contextMenu: null }),
    closeFlightScheduleChangesDialog: () => set({ flightScheduleChangesDialog: null }),
    openCrewExtraInfoDialog: (d) => set({ crewExtraInfoDialog: d, contextMenu: null }),
    closeCrewExtraInfoDialog: () => set({ crewExtraInfoDialog: null }),
    patchCrewScheduleVisibility: (crewId, isScheduleVisible) =>
      set({
        crew: get().crew.map((c) => (c._id === crewId ? { ...c, isScheduleVisible } : c)),
      }),
    openDialogFor: (d) => set({ openDialog: d, contextMenu: null }),
    closeDialog: () => set({ openDialog: null }),
    setUncrewedFilter: (patch) => {
      const next = { ...get().uncrewedFilter, ...patch }
      persistUncrewedFilter(next)
      set({ uncrewedFilter: next })
    },
    resetUncrewedFilter: () => {
      const next = { ...EMPTY_UNCREWED_FILTER }
      persistUncrewedFilter(next)
      set({ uncrewedFilter: next })
    },
    setUncrewedFilterSheetOpen: (open) => set({ uncrewedFilterSheetOpen: open }),
    setUncrewedTrayHeight: (heightPx) => {
      const clamped = Math.max(48, Math.min(800, Math.round(heightPx)))
      set({ uncrewedTrayHeight: clamped })
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('horizon.crewSchedule.uncrewedTrayHeight', String(clamped))
        } catch {
          // Private mode / quota — fine, tray height just won't persist.
        }
      }
    },
    toggleUncrewedTrayVisible: () => {
      const next = !get().uncrewedTrayVisible
      set({ uncrewedTrayVisible: next })
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('horizon.crewSchedule.uncrewedTrayVisible', next ? '1' : '0')
        } catch {
          // ignore
        }
      }
      // Opening the tray: pull the latest pairings/assignments so
      // Network / Pairing-edit changes (4.1.5.1 / 4.1.5.2) are reflected
      // without waiting for the 15-min auto-refresh.
      if (next) {
        void get().reconcilePeriod()
      }
    },
    setUncrewedTrayVisible: (visible) => {
      set({ uncrewedTrayVisible: visible })
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('horizon.crewSchedule.uncrewedTrayVisible', visible ? '1' : '0')
        } catch {
          // ignore
        }
      }
      if (visible) {
        void get().reconcilePeriod()
      }
    },
    setCrewGrouping: (g) => {
      persistGrouping(g)
      const s = get()
      const sortedCrew = sortCrewRoster({
        crew: s.crew,
        assignments: s.assignments,
        activities: s.activities,
        pairings: s.pairings,
        positions: s.positions,
        grouping: g,
      })
      set({ crewGrouping: g, crew: sortedCrew })
    },
    openMemoOverlay: (o) => set({ memoOverlay: o }),
    closeMemoOverlay: () => set({ memoOverlay: null }),
    openTempBaseDialog: (d) => set({ tempBaseDialog: d, contextMenu: null }),
    closeTempBaseDialog: () => set({ tempBaseDialog: null }),
    setExportCanvasRef: (el) => set({ exportCanvasRef: el }),
    setCapacityError: (e) => set({ capacityError: e }),
    clearCapacityError: () => set({ capacityError: null }),
    setDropRejection: (reason) => set({ dropRejection: { reason, at: Date.now() } }),
    clearDropRejection: () => set({ dropRejection: null }),
    setAssignmentOverridePending: (p) => set({ assignmentOverridePending: p }),
    clearAssignmentOverridePending: () => set({ assignmentOverridePending: null }),
    setAssignmentBlocked: (p) => set({ assignmentBlocked: p }),
    clearAssignmentBlocked: () => set({ assignmentBlocked: null }),
    openLegalityCheck: (scope) => set({ legalityCheck: scope, contextMenu: null }),
    closeLegalityCheck: () => set({ legalityCheck: null }),

    togglePublishedOverlay: async () => {
      const s = get()
      if (s.publishedOverlayVisible) {
        set({ publishedOverlayVisible: false })
        return
      }
      // If we already loaded an overlay for this period, reuse it.
      if (
        s.publishedOverlay &&
        s.publishedOverlay.periodFromIso === s.periodFromIso &&
        s.publishedOverlay.periodToIso === s.periodToIso
      ) {
        set({ publishedOverlayVisible: true })
        return
      }
      try {
        const pub = await api.getLatestCrewSchedulePublication(s.periodFromIso, s.periodToIso)
        set({ publishedOverlay: pub, publishedOverlayVisible: true })
      } catch (e) {
        // 404 = no publication covers this period; leave overlay empty
        // but flip the flag so the user sees the banner explaining why.
        set({ publishedOverlay: null, publishedOverlayVisible: true, error: (e as Error).message })
      }
    },
    setSmartFilterDraft: (patch) => set({ smartFilterDraft: { ...get().smartFilterDraft, ...patch } }),
    commitSmartFilter: () => set({ smartFilter: { ...get().smartFilterDraft } }),
    initSmartFilterDraft: () => set({ smartFilterDraft: { ...get().smartFilter } }),
    resetSmartFilter: () =>
      set({
        smartFilter: { ...EMPTY_SMART_FILTER },
        smartFilterDraft: { ...EMPTY_SMART_FILTER },
      }),

    // ── Scroll / container ──
    setContainerWidth: (w) => {
      if (w === get().containerWidth) return
      set({ containerWidth: w })
    },
    setScroll: (left, top) => set({ scrollLeft: left, scrollTop: top }),
    setScrollTarget: (ms) => set({ scrollTargetMs: ms }),
    goToToday: () => set({ scrollTargetMs: Date.now() }),

    // ── UI ──
    setRightPanelOpen: (open) => set({ rightPanelOpen: open }),

    // ── Post-write refresh ──
    refresh: async () => {
      await get().commitPeriod()
    },
  }
})

// Dev-mode diagnostic hook — exposes the store on `window` so planners
// can inspect live state from the browser console (e.g. pairings, legs,
// reportTime) when debugging FDTL issues. No-op in production builds.
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  ;(window as unknown as { useCrewScheduleStore: typeof useCrewScheduleStore }).useCrewScheduleStore =
    useCrewScheduleStore
}
