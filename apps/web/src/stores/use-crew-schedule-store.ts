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
  type OperatorSchedulingConfig,
  type PairingRef,
  type UncrewedPairingRef,
} from '@skyhub/api'
import { checkSoftRules, type SoftRuleViolation } from '@skyhub/logic'
import type { BarLabelMode, CrewScheduleZoom } from '@/lib/crew-schedule/layout'
import { sortCrewRoster } from '@/lib/crew-schedule/layout'
import { useOperatorStore } from '@/stores/use-operator-store'
import { buildScheduleDuties, validateCrewAssignment, categorizeActivityFlags, type ScheduleDuty } from '@skyhub/logic'

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
  crewGroupIds: string[]
  /** Bulk crew lookup: each token is matched (case-insensitive) against
   *  `employeeId` exact OR substring of `firstName`/`lastName`/full name.
   *  When non-empty, all other left-panel filters are ignored — the
   *  Specific Crew Search dialog is the single source of truth for which
   *  crew load on the next Go. */
  specificCrewTokens: string[]
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
  aircraftTypes: Array<{ icaoType: string; family: string | null; color: string | null }>
  /** Operator-base UTC offset (hours). Drives canvas timezone display so
   *  the day grid reads in operator-local time instead of UTC. Default 0. */
  displayOffsetHours: number
  /** Operator scheduling soft-rule config (4.1.6.3). Loaded once per commitPeriod. */
  schedulingConfig: OperatorSchedulingConfig | null
  /** Soft-rule violations keyed by crewId. Amber warnings in Gantt row headers. */
  softViolations: Record<string, SoftRuleViolation[]>
}

interface ContextRefs {
  bases: Array<{ _id: string; iataCode: string | null; name: string }>
  acTypes: string[]
  crewGroups: Array<{ _id: string; name: string }>
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
    | {
        kind: 'positioning-chip'
        tempBaseId: string
        direction: 'outbound' | 'return'
        crewId: string
        airportCode: string
        flightDate: string
        depStation: string
        arrStation: string
        bookingId: string | null
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

  /** Crew flight bookings (deadhead + temp-base positioning) for the
   *  visible window. Loaded alongside the schedule and after every
   *  positioning save. Used to paint POS chips on the flanking days of
   *  a temp base band and to drive the bidirectional binding with
   *  /crew-ops/control/hotac/transport-management. */
  flightBookings: import('@skyhub/api').CrewFlightBookingRef[]

  /** Open positioning drawer state — set when the user clicks a
   *  flanking-day "+" or an existing POS chip on the canvas. The shell
   *  mounts the FlightBookingDrawer when this is non-null. */
  positioningDrawer: {
    tempBaseId: string
    direction: 'outbound' | 'return'
    /** Existing booking when editing; null when creating. */
    bookingId: string | null
    crewId: string
    /** YYYY-MM-DD — the flanking day this drawer is for. */
    flightDate: string
    /** Origin/destination prefilled from the temp base + crew home base. */
    depStation: string
    arrStation: string
  } | null

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
  /** True while the lazy /crew-schedule/uncrewed fetch is in flight.
   *  Drives the tray's loading skeleton — the main Gantt remains
   *  interactive throughout. */
  uncrewedLoading: boolean
  /** Total uncrewed pairings the server has for the current scope.
   *  `uncrewed.length` is the loaded slice; `uncrewedTotal` is what's
   *  available so the tray can render "X of Y · Load more". */
  uncrewedTotal: number
  /** Page size used for /crew-schedule/uncrewed paging. */
  uncrewedPageSize: number
  /** Date-scoped crew grouping (AIMS §4.4 "Group crew together"). When
   *  set, the layout's crew sort is replaced by the grouping algorithm. */
  crewGrouping: CrewGroupingState | null

  /** Gantt-scoped activity clipboard (separate from the OS clipboard).
   *  Set by Ctrl+C / Ctrl+X / right-click → Copy/Cut on a selected
   *  activity bar. Read by Ctrl+V / right-click → Paste on an empty
   *  cell or a shift-drag block. Times are stored as operator-local
   *  HH:MM so a REST 22:00-08:00 anchored on Apr 03 pastes as
   *  22:00-08:00 on Apr 17. Source activity may span midnight; the
   *  paste rebuilds end-side to next local day when endHHMM <= startHHMM.
   *
   *  When `mode === 'cut'`, `sourceActivityId` references the activity
   *  that should be deleted after the FIRST successful paste (matches
   *  OS Cut semantics — the source moves to the destination once, not
   *  every paste). Esc cancels the cut without touching the source. */
  clipboardActivity: {
    activityCodeId: string
    /** Display label like "OFF", "SBY" — shown in the toolbar pill. */
    codeLabel: string
    startHHMM: string
    endHHMM: string
    notes: string | null
    mode: 'copy' | 'cut'
    sourceActivityId: string | null
  } | null
  /** Ephemeral feedback for paste outcomes. Auto-clears after 3s.
   *  Drives a small accent-bordered toast near the canvas top. */
  pasteFlash: { kind: 'success' | 'warning' | 'error'; text: string; ts: number } | null
  /** Multi-day block delete confirmation. Set by the Delete handlers
   *  when the planner targets >1 cell. Drives a small confirm dialog;
   *  shell consumes by reading the activity/assignment id arrays and
   *  dispatching the actual deletes when the user confirms. Cleared
   *  on either outcome. */
  pendingBlockDelete: {
    activityIds: string[]
    assignmentIds: string[]
    crewCount: number
    dayCount: number
  } | null
  /** Pre-paste FDTL pre-check tripped the validator. Holds the
   *  surviving target set + the per-crew issue summary so the shell
   *  can render a confirm dialog ("Pasting will create FDTL issues —
   *  proceed anyway?"). User confirms → the buffered targets POST as
   *  normal; cancels → state clears, no DB write. */
  pendingPasteConfirm: {
    fresh: Array<{ crewId: string; dateIso: string; startUtcIso: string; endUtcIso: string }>
    skipped: number
    illegal: number
    issues: Array<{
      crewId: string
      dateIso: string
      crewLabel: string
      severity: 'warning' | 'violation'
      title: string
      message: string
    }>
  } | null

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
  /** Crew row currently requested by Search to be scrolled vertically
   *  into view. Cleared by the canvas via `consumeScrollTargetCrew`. */
  scrollTargetCrewId: string | null
  /** Monotonic counter — bumped every time `scrollToCrew` is called so
   *  the canvas effect re-fires even when the same crewId is targeted
   *  twice in a row (eg. Next/Prev landing back on the same match). */
  scrollTargetCrewTick: number

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
  /** Narrow background reconcile scoped to one or more crew. Sends
   *  `crewSearch=<id>` so the server returns ONLY that crew's
   *  pairings/assignments/activities — ~50ms vs ~50s on a 500-crew
   *  M0 cluster. Merges into the local store without wiping unrelated
   *  rows. Use this after every mutation whose blast radius is known
   *  to be a small set of crew (single-crew assign, drag-copy, etc.). */
  reconcileCrew: (crewIds: string[]) => Promise<void>
  loadContext: () => Promise<void>

  // ── Actions: view ──
  setZoom: (z: CrewScheduleZoom) => void
  cycleLabelMode: () => void
  setLabelMode: (m: BarLabelMode) => void
  setRowHeightLevel: (level: number) => void
  zoomRowIn: () => void
  zoomRowOut: () => void
  setRefreshIntervalMins: (mins: number) => void

  // ── Actions: clipboard ──
  /** Read a selected activity into the in-memory Gantt clipboard. */
  copyActivityToClipboard: (activityId: string) => void
  /** Same as `copyActivityToClipboard` but flags the buffer as a Cut.
   *  The source activity is deleted on the first successful paste. */
  cutActivityToClipboard: (activityId: string) => void
  /** Drop the clipboard contents — clears the toolbar pill. Cut: leaves
   *  the source bar in place (cancels the move). */
  clearClipboard: () => void
  /** Paste the buffered activity onto each (crewId × dateIso) target.
   *  Cells that already contain an activity for that date are skipped.
   *  Returns the outcome counts so the caller can render a toast.
   *  Optimistic merge + narrow reconcile on the touched crew set. */
  pasteClipboardToCells: (
    targets: Array<{ crewId: string; dateIso: string }>,
  ) => Promise<{ pasted: number; skipped: number; failed: number }>
  /** Programmatically show / clear the paste-feedback toast. */
  setPasteFlash: (flash: NonNullable<State['pasteFlash']> | null) => void
  /** Continue the paste held by the FDTL confirm dialog. */
  confirmPendingPaste: () => Promise<void>
  /** Drop the pending paste — neither the bulk POST nor the source
   *  delete (cut) fires. */
  cancelPendingPaste: () => void

  // ── Actions: optimistic local-merge ──
  /** Merge new/updated activities into the local store by `_id`. Used
   *  by mutation handlers so the UI reflects the change immediately
   *  without waiting for the 30-50s reconcile fetch. */
  mergeActivities: (docs: Array<{ _id: string } & Record<string, unknown>>) => void
  /** Same shape as `mergeActivities` but for assignments. */
  mergeAssignments: (docs: Array<{ _id: string } & Record<string, unknown>>) => void

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
  /** Lazy fetch of /crew-schedule/uncrewed — populates the Uncrewed
   *  Duties tray + appends uncrewed pairings into the pairings store. */
  loadUncrewed: () => Promise<void>
  /** Append the next page of uncrewed pairings (page size = `uncrewedPageSize`).
   *  No-op when nothing more is available. */
  loadMoreUncrewed: () => Promise<void>
  setCrewGrouping: (g: CrewGroupingState | null) => void
  openMemoOverlay: (o: NonNullable<State['memoOverlay']>) => void
  closeMemoOverlay: () => void
  openTempBaseDialog: (d: NonNullable<State['tempBaseDialog']>) => void
  closeTempBaseDialog: () => void
  /** Load `crewFlightBookings` for the visible window. Called from
   *  commitPeriod / reconcilePeriod and after a positioning save. */
  loadFlightBookings: () => Promise<void>
  openPositioningDrawer: (d: NonNullable<State['positioningDrawer']>) => void
  closePositioningDrawer: () => void
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
  /** Crew row to scroll into vertical view. Bumps `scrollTargetCrewTick`
   *  so repeated requests (Next/Prev in search) re-trigger the scroll
   *  even when the same crewId is asked for twice. */
  scrollToCrew: (crewId: string) => void
  consumeScrollTargetCrew: () => void

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
    return window.localStorage.getItem('horizon.crewSchedule.uncrewedTrayVisible.v2') === '1'
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
  // Open on the calendar month that contains today (UTC). Month view is the
  // broadest built-in zoom — gives planners the full cycle on first load.
  const now = new Date()
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

/** Compute UTC offset in hours from an IANA timezone string (e.g. "Asia/Ho_Chi_Minh" → 7). */
function resolveUtcOffsetHours(timezone: string): number {
  try {
    const now = new Date()
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    }).formatToParts(now)
    const tzName = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
    const match = tzName.match(/GMT([+-])(\d+)(?::(\d+))?/)
    if (!match) return 0
    const sign = match[1] === '+' ? 1 : -1
    const h = parseInt(match[2], 10)
    const m = parseInt(match[3] ?? '0', 10)
    return sign * (h + m / 60)
  } catch {
    return 0
  }
}

/** Build pairingsById map for soft-rule destination checks. */
function buildPairingsById(
  pairings: PairingRef[],
): Map<string, { layoverStations: string[]; layoverCountryCodes: string[] }> {
  const map = new Map<string, { layoverStations: string[]; layoverCountryCodes: string[] }>()
  for (const p of pairings) {
    if (!p.legs?.length) {
      map.set(p._id, { layoverStations: [], layoverCountryCodes: [] })
      continue
    }
    const maxDutyDay = Math.max(...p.legs.map((l) => l.dutyDay))
    const layoverStations: string[] = []
    for (let day = 1; day < maxDutyDay; day++) {
      const dayLegs = p.legs.filter((l) => l.dutyDay === day)
      if (!dayLegs.length) continue
      const last = dayLegs.reduce((a, b) => (a.legOrder > b.legOrder ? a : b))
      layoverStations.push(last.arrStation)
    }
    // Country code derivation is left empty here; destination rules with scope='country'
    // require airport→country mapping not available in the store. Airline users typically
    // configure scope='airport' rules. Country-scope is computed server-side in the solver.
    map.set(p._id, { layoverStations, layoverCountryCodes: [] })
  }
  return map
}

async function loadSchedulingConfigAndViolations(
  get: () => State,
  set: (partial: Partial<State>) => void,
  periodFromIso: string,
  periodToIso: string,
) {
  const opId = useOperatorStore.getState().operator?._id
  const operatorTimezone = useOperatorStore.getState().operator?.timezone ?? 'UTC'
  if (!opId) return

  try {
    const cfg = await api.getOperatorSchedulingConfig(opId)
    if (!cfg) {
      set({ schedulingConfig: null, softViolations: {} })
      return
    }

    const { crew, assignments, pairings } = get()
    const utcOffset = resolveUtcOffsetHours(operatorTimezone)
    const pairingsById = buildPairingsById(pairings)

    const softViolations: Record<string, SoftRuleViolation[]> = {}
    for (const member of crew) {
      const memberAssignments = assignments
        .filter((a) => a.crewId === member._id && a.status !== 'cancelled')
        .map((a) => ({ pairingId: a.pairingId, startUtcIso: a.startUtcIso, endUtcIso: a.endUtcIso }))
      const violations = checkSoftRules(memberAssignments, pairingsById, cfg, periodFromIso, periodToIso, utcOffset)
      if (violations.length > 0) softViolations[member._id] = violations
    }

    set({ schedulingConfig: cfg, softViolations })
  } catch {
    // Silent — soft violations are best-effort; stale state is self-healing on next commitPeriod.
  }
}

/**
 * Generation counter for `loadUncrewed`. Module-scoped (not in store
 * state) so reading/writing it doesn't trigger React re-renders. Each
 * call increments it; only the call whose value still matches at
 * resolve-time is allowed to commit its response. Prevents stale tray
 * data when the user re-clicks Go or changes filters mid-flight.
 */
let uncrewedFetchGen = 0

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
    displayOffsetHours: 0,
    schedulingConfig: null,
    softViolations: {},

    // Committed view state
    periodFromIso: from,
    periodToIso: to,
    filters: { baseIds: [], positionIds: [], acTypeIcaos: [], crewGroupIds: [], specificCrewTokens: [] },

    // View state
    zoom: 'M',
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
    uncrewedLoading: false,
    uncrewedTotal: 0,
    uncrewedPageSize: 100,
    uncrewedTrayVisible: hydrateUncrewedTrayVisible(),
    crewGrouping: hydrateGrouping(),
    clipboardActivity: null,
    pasteFlash: null,
    pendingPasteConfirm: null,
    pendingBlockDelete: null,
    tempBaseDialog: null,
    tempBases: [],
    flightBookings: [],
    positioningDrawer: null,

    // Scroll / container
    containerWidth: 0,
    scrollLeft: 0,
    scrollTop: 0,
    scrollTargetMs: null,
    scrollTargetCrewId: null,
    scrollTargetCrewTick: 0,

    // UI
    rightPanelOpen: true,

    // Fetch state
    periodCommitted: false,
    loading: false,
    error: null,

    // Context
    context: { bases: [], acTypes: [], crewGroups: [], loaded: false },

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
          crewGroup: s.filters.crewGroupIds.length === 1 ? s.filters.crewGroupIds[0] : undefined,
          crewSearch: s.filters.specificCrewTokens.length > 0 ? s.filters.specificCrewTokens : undefined,
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
          displayOffsetHours: (res as { displayOffsetHours?: number }).displayOffsetHours ?? 0,
          periodCommitted: true,
          loading: false,
          error: null,
          // Tray always starts collapsed on a fresh Go — planner opens
          // it on demand. Prevents an "open empty tray" flash on narrow
          // filters (eg. Specific Crew Search returning 0 uncrewed).
          uncrewedTrayVisible: false,
        })
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem('horizon.crewSchedule.uncrewedTrayVisible.v2', '0')
          } catch {
            /* localStorage unavailable — non-fatal */
          }
        }
        // Load scheduling config + compute soft violations in background.
        void loadSchedulingConfigAndViolations(get, set, s.periodFromIso, s.periodToIso)
        // Pull positioning + deadhead bookings for the visible window so the
        // canvas can paint POS chips on temp-base flanking days. Cheap call;
        // failures are silent (stored as []).
        void get().loadFlightBookings()
        // Background prefetch — runs after the main aggregator resolves
        // so the tray is warm by the time the planner clicks. Generation
        // guard inside `loadUncrewed` discards results if Go is clicked
        // again before this finishes. Tray itself stays hidden on every
        // commit (forced below) — prefetch is data-only.
        void get().loadUncrewed()
        // Roster-FDTL sweep is now on-demand — triggered by the Legality
        // Check dialog, not by page load. Avoids mid-view flicker from a
        // late response updating `crewIssues` while the planner is
        // interacting with the Gantt.
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
          crewGroup: s.filters.crewGroupIds.length === 1 ? s.filters.crewGroupIds[0] : undefined,
          crewSearch: s.filters.specificCrewTokens.length > 0 ? s.filters.specificCrewTokens : undefined,
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
          displayOffsetHours: (res as { displayOffsetHours?: number }).displayOffsetHours ?? 0,
        })
        void get().loadFlightBookings()
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
                  crewSearch: s.filters.specificCrewTokens.length > 0 ? s.filters.specificCrewTokens : undefined,
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

    reconcileCrew: async (crewIds) => {
      if (!crewIds.length) return
      const s = get()
      try {
        // crewSearch tokens accept _id (server's resolver matches
        // employeeId exact OR regex on names — _id passes through the
        // employeeId-exact branch as a no-op miss, but we add an
        // additional clause via the regex over `_id` is unnecessary; we
        // already added _id matching by widening the resolver below).
        const res = await api.getCrewSchedule({
          from: s.periodFromIso,
          to: s.periodToIso,
          crewSearch: crewIds,
        })
        // Targeted merge — only touch the rows for the crew we asked
        // for. Wiping the full activities/assignments arrays here would
        // blow away every OTHER crew's bars (the server returned only
        // the narrow set), so we splice by `crewId` instead.
        const touched = new Set(crewIds)
        const mergeById = <T extends { _id: string; crewId?: string }>(prev: T[], next: T[]): T[] => {
          const nextById = new Map(next.map((d) => [d._id, d]))
          const out: T[] = []
          for (const p of prev) {
            // Drop a touched-crew row if the server didn't return it
            // (means it was deleted server-side); keep all other crew.
            if (p.crewId && touched.has(p.crewId)) {
              const fresh = nextById.get(p._id)
              if (fresh) {
                out.push(fresh)
                nextById.delete(p._id)
              }
              continue
            }
            out.push(p)
          }
          // Append any new docs the server returned that we hadn't seen.
          for (const fresh of nextById.values()) out.push(fresh)
          return out
        }
        set({
          activities: mergeById(get().activities, res.activities),
          assignments: mergeById(get().assignments, res.assignments),
          // Pairings + crew don't go through the touched-crew filter —
          // pairings can shift seat counts via assignments to OTHER
          // crew, and crew docs themselves don't change on assignment.
          // We refresh pairings by id to pick up crewCounts updates.
          pairings: (() => {
            const byId = new Map(res.pairings.map((p) => [p._id, p]))
            const out = get().pairings.map((p) => byId.get(p._id) ?? p)
            for (const p of res.pairings) if (!out.find((x) => x._id === p._id)) out.push(p)
            return out
          })(),
        })
      } catch {
        // Silent — fall back to next full reconcile / commit.
      }
    },

    loadContext: async () => {
      if (get().context.loaded) return
      try {
        const [airports, types, positions, crewGroups] = await Promise.all([
          api.getAirports({ crewBase: true }),
          api.getAircraftTypes(),
          api.getCrewPositions(),
          api.getCrewGroups(),
        ])
        // Seed `positions` so the Position filter is selectable before the
        // first Go. The crew-schedule aggregator will overwrite this list
        // with the same rows on commitPeriod.
        const prevPositions = get().positions
        set({
          context: {
            bases: airports.map((a) => ({ _id: a._id, iataCode: a.iataCode, name: a.name })),
            acTypes: [...new Set(types.map((t) => t.icaoType))].sort(),
            crewGroups: crewGroups
              .filter((g) => g.isActive)
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
              .map((g) => ({ _id: g._id, name: g.name })),
            loaded: true,
          },
          positions: prevPositions.length > 0 ? prevPositions : positions,
        })
      } catch {
        // non-fatal — filter dropdowns will remain empty
        set({ context: { bases: [], acTypes: [], crewGroups: [], loaded: true } })
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
    copyActivityToClipboard: (activityId) => {
      const s = get()
      const act = s.activities.find((a) => a._id === activityId)
      if (!act) return
      const code = s.activityCodes.find((c) => c._id === act.activityCodeId)
      const codeLabel = code?.code ?? '?'
      const offsetH = s.displayOffsetHours
      const toLocalHHMM = (utcIso: string): string => {
        const ms = new Date(utcIso).getTime() + offsetH * 3_600_000
        const d = new Date(ms)
        return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
      }
      set({
        clipboardActivity: {
          activityCodeId: act.activityCodeId,
          codeLabel,
          startHHMM: toLocalHHMM(act.startUtcIso),
          endHHMM: toLocalHHMM(act.endUtcIso),
          notes: act.notes ?? null,
          mode: 'copy',
          sourceActivityId: null,
        },
        pasteFlash: { kind: 'success', text: `Copied ${codeLabel} — paste with Ctrl+V`, ts: Date.now() },
      })
    },
    cutActivityToClipboard: (activityId) => {
      const s = get()
      const act = s.activities.find((a) => a._id === activityId)
      if (!act) return
      const code = s.activityCodes.find((c) => c._id === act.activityCodeId)
      const codeLabel = code?.code ?? '?'
      const offsetH = s.displayOffsetHours
      const toLocalHHMM = (utcIso: string): string => {
        const ms = new Date(utcIso).getTime() + offsetH * 3_600_000
        const d = new Date(ms)
        return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
      }
      set({
        clipboardActivity: {
          activityCodeId: act.activityCodeId,
          codeLabel,
          startHHMM: toLocalHHMM(act.startUtcIso),
          endHHMM: toLocalHHMM(act.endUtcIso),
          notes: act.notes ?? null,
          mode: 'cut',
          sourceActivityId: act._id,
        },
        pasteFlash: { kind: 'success', text: `Cut ${codeLabel} — paste with Ctrl+V`, ts: Date.now() },
      })
    },
    clearClipboard: () => set({ clipboardActivity: null }),
    setPasteFlash: (flash) => set({ pasteFlash: flash }),
    pasteClipboardToCells: async (targets) => {
      const s = get()
      const clip = s.clipboardActivity
      if (!clip || targets.length === 0) return { pasted: 0, skipped: 0, failed: 0 }
      // Anchor source HH:MM to each target local date. Same wrap-past-
      // midnight rule as the server: end <= start → push to next day.
      const offsetH = s.displayOffsetHours
      const localDateAndTimeToUtcIso = (dateIso: string, hhmm: string): string => {
        const [hh, mm] = hhmm.split(':').map((n) => parseInt(n, 10))
        const localMidnightUtcMs = Date.parse(`${dateIso}T00:00:00Z`) - offsetH * 3_600_000
        return new Date(localMidnightUtcMs + (hh * 60 + mm) * 60_000).toISOString()
      }
      const buildWindow = (dateIso: string): { startUtcIso: string; endUtcIso: string } => {
        const startUtcIso = localDateAndTimeToUtcIso(dateIso, clip.startHHMM)
        let endUtcIso = localDateAndTimeToUtcIso(dateIso, clip.endHHMM)
        if (new Date(endUtcIso).getTime() <= new Date(startUtcIso).getTime()) {
          const nextDay = new Date(Date.parse(`${dateIso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
          endUtcIso = localDateAndTimeToUtcIso(nextDay, clip.endHHMM)
        }
        return { startUtcIso, endUtcIso }
      }
      // Pre-paste legality:
      //   1. Skip cells that already hold an activity on the target date
      //      (same as before — silently absorb the no-op).
      //   2. REJECT cells whose target window overlaps an existing
      //      pairing assignment for that crew. Pasting REST/SBY/OFF on
      //      top of a flying duty is illegal; the planner has to clear
      //      the pairing first, otherwise the bar would visually
      //      sit on a duty the crew is still rostered to operate.
      //   3. Always trim duplicate (crewId, dateIso) pairs in the
      //      caller's target list.
      const occupied = new Set<string>()
      for (const a of s.activities) {
        const day = a.dateIso ?? a.startUtcIso.slice(0, 10)
        occupied.add(`${a.crewId}|${day}`)
      }
      const assignmentsByCrew = new Map<string, Array<{ startMs: number; endMs: number }>>()
      for (const a of s.assignments) {
        const arr = assignmentsByCrew.get(a.crewId) ?? []
        arr.push({ startMs: new Date(a.startUtcIso).getTime(), endMs: new Date(a.endUtcIso).getTime() })
        assignmentsByCrew.set(a.crewId, arr)
      }
      const dedupe = new Set<string>()
      const fresh: Array<{ crewId: string; dateIso: string; startUtcIso: string; endUtcIso: string }> = []
      let skipped = 0
      let illegal = 0
      for (const t of targets) {
        const key = `${t.crewId}|${t.dateIso}`
        if (dedupe.has(key)) continue
        dedupe.add(key)
        if (occupied.has(key)) {
          skipped += 1
          continue
        }
        const win = buildWindow(t.dateIso)
        const startMs = new Date(win.startUtcIso).getTime()
        const endMs = new Date(win.endUtcIso).getTime()
        const overlaps = assignmentsByCrew.get(t.crewId)?.some((a) => a.startMs < endMs && a.endMs > startMs)
        if (overlaps) {
          illegal += 1
          continue
        }
        fresh.push({ ...t, ...win })
      }
      if (fresh.length === 0) {
        const parts: string[] = []
        if (skipped) parts.push(`${skipped} had activity`)
        if (illegal) parts.push(`${illegal} would conflict with a pairing`)
        set({
          pasteFlash: {
            kind: 'warning',
            text: `Nothing pasted — ${parts.join(' · ') || 'no eligible cells'}`,
            ts: Date.now(),
          },
        })
        return { pasted: 0, skipped: skipped + illegal, failed: 0 }
      }
      // FDTL pre-check — for each fresh target, build a candidate
      // ScheduleDuty (rest vs duty per the activity code's flags) and
      // run `validateCrewAssignment` against the crew's existing
      // duties (assignments + activities). Any violation/warning →
      // park the targets in `pendingPasteConfirm` and let the shell
      // render the confirm dialog. Hard-block severity isn't possible
      // for activities under the current rule set.
      const ruleSet = s.ruleSet
      const issues: NonNullable<State['pendingPasteConfirm']>['issues'] = []
      if (ruleSet) {
        const pairingsById = new Map(s.pairings.map((p) => [p._id, p]))
        const activityCodesById = new Map(s.activityCodes.map((c) => [c._id, { flags: c.flags ?? [] }]))
        const code = s.activityCodes.find((c) => c._id === clip.activityCodeId)
        const cat = code
          ? categorizeActivityFlags(code.flags ?? [])
          : { category: 'rest' as const, countsDuty: false, countsBlock: false, countsFdp: false }
        const crewById = new Map(s.crew.map((c) => [c._id, c]))
        const dutiesByCrew = new Map<string, ScheduleDuty[]>()
        const homeBaseByCrew = new Map<string, string>()
        for (const t of fresh) {
          if (!dutiesByCrew.has(t.crewId)) {
            dutiesByCrew.set(
              t.crewId,
              buildScheduleDuties({
                crewId: t.crewId,
                assignments: s.assignments,
                activities: s.activities,
                pairingsById,
                activityCodesById,
                bookings: s.flightBookings,
              }),
            )
            homeBaseByCrew.set(t.crewId, (crewById.get(t.crewId)?.baseLabel ?? '').toUpperCase())
          }
        }
        for (const t of fresh) {
          const startMs = new Date(t.startUtcIso).getTime()
          const endMs = new Date(t.endUtcIso).getTime()
          const durMin = Math.max(0, (endMs - startMs) / 60_000)
          const candidate: ScheduleDuty = {
            id: `__paste_${t.crewId}_${t.dateIso}`,
            kind: cat.category === 'rest' ? 'rest' : 'activity',
            startUtcMs: startMs,
            endUtcMs: endMs,
            dutyMinutes: cat.category === 'duty' && cat.countsDuty ? durMin : 0,
            blockMinutes: cat.category === 'duty' && cat.countsBlock ? durMin : 0,
            fdpMinutes: cat.category === 'duty' && cat.countsFdp ? durMin : 0,
            landings: 0,
            departureStation: null,
            arrivalStation: null,
            isAugmented: false,
            label: clip.codeLabel,
          }
          const result = validateCrewAssignment({
            candidate,
            existing: dutiesByCrew.get(t.crewId) ?? [],
            homeBase: homeBaseByCrew.get(t.crewId) ?? '',
            ruleSet: ruleSet as Parameters<typeof validateCrewAssignment>[0]['ruleSet'],
          })
          for (const chk of result.checks) {
            if (chk.status !== 'violation' && chk.status !== 'warning') continue
            const m = crewById.get(t.crewId)
            issues.push({
              crewId: t.crewId,
              dateIso: t.dateIso,
              crewLabel: m ? `${m.lastName ?? ''} ${m.firstName ?? ''}`.trim() : t.crewId,
              severity: chk.status,
              title: chk.label ?? chk.ruleCode ?? 'FDTL rule',
              message: `${chk.shortReason ?? ''}${chk.legalReference ? ` — ${chk.legalReference}` : ''}`.trim(),
            })
          }
        }
      }
      if (issues.length > 0) {
        set({
          pendingPasteConfirm: { fresh, skipped, illegal, issues },
        })
        return { pasted: 0, skipped: skipped + illegal, failed: 0 }
      }
      try {
        const res = await api.createCrewActivitiesBulk({
          activities: fresh.map((t) => ({
            crewId: t.crewId,
            activityCodeId: clip.activityCodeId,
            dateIso: t.dateIso,
            startUtcIso: t.startUtcIso,
            endUtcIso: t.endUtcIso,
            notes: clip.notes,
          })),
        })
        get().mergeActivities(res.created as unknown as Array<{ _id: string }>)
        const touchedCrewIds = new Set(fresh.map((t) => t.crewId))
        // Cut semantics: delete the source on the first successful
        // paste, then clear the buffer so further Ctrl+V is a no-op.
        // If the source is one of the targets we just pasted into
        // (planner cut and pasted onto the same cell), skip the
        // delete — would wipe the brand-new bar.
        if (clip.mode === 'cut' && clip.sourceActivityId && res.created.length > 0) {
          const sourceId = clip.sourceActivityId
          const sourceAct = s.activities.find((a) => a._id === sourceId)
          const sourceWasOverwritten =
            sourceAct &&
            res.created.some(
              (c) =>
                (c as unknown as { crewId: string }).crewId === sourceAct.crewId &&
                ((c as unknown as { dateIso?: string | null }).dateIso ?? '') ===
                  (sourceAct.dateIso ?? sourceAct.startUtcIso.slice(0, 10)),
            )
          if (!sourceWasOverwritten) {
            try {
              await api.deleteCrewActivity(sourceId)
              set((st) => ({ activities: st.activities.filter((a) => a._id !== sourceId) }))
              if (sourceAct) touchedCrewIds.add(sourceAct.crewId)
            } catch {
              // Source delete failed — leave the planner with both bars
              // visible rather than silently swallowing. They can retry
              // via right-click → Delete.
            }
          }
          set({ clipboardActivity: null })
        }
        void get().reconcileCrew([...touchedCrewIds])
        // Fire-and-forget FDTL re-eval for the period — surfaces any
        // rest / cumulative violations the paste introduced (28-day OFF
        // shortfall, weekly rest dent, etc.) on the next reconcile via
        // `crewIssues`. Server is idempotent under spam.
        const opId = useOperatorStore.getState().operator?._id
        if (opId) {
          void api.reevaluateCrewRoster({ operatorId: opId, from: s.periodFromIso, to: s.periodToIso }).catch(() => {
            /* silent — next natural refresh re-evaluates */
          })
        }
        const failed = res.failed ?? 0
        const pasted = res.created.length
        const reasons: string[] = []
        if (skipped) reasons.push(`${skipped} skipped (had activity)`)
        if (illegal) reasons.push(`${illegal} illegal (pairing conflict)`)
        if (failed) reasons.push(`${failed} failed`)
        set({
          pasteFlash: {
            kind: failed > 0 || skipped > 0 || illegal > 0 ? 'warning' : 'success',
            text: `Pasted ${pasted} ${clip.codeLabel}` + (reasons.length ? ` · ${reasons.join(' · ')}` : ''),
            ts: Date.now(),
          },
        })
        return { pasted, skipped: skipped + illegal, failed }
      } catch (e) {
        set({
          pasteFlash: {
            kind: 'error',
            text: `Paste failed: ${(e as Error).message ?? 'unknown error'}`,
            ts: Date.now(),
          },
        })
        return { pasted: 0, skipped: skipped + illegal, failed: fresh.length }
      }
    },
    cancelPendingPaste: () => set({ pendingPasteConfirm: null }),
    confirmPendingPaste: async () => {
      const s = get()
      const pending = s.pendingPasteConfirm
      const clip = s.clipboardActivity
      if (!pending || !clip) {
        set({ pendingPasteConfirm: null })
        return
      }
      const { fresh, skipped, illegal } = pending
      // Clear the dialog state immediately so the user can't double-fire
      // the bulk POST by spamming the confirm button.
      set({ pendingPasteConfirm: null })
      try {
        const res = await api.createCrewActivitiesBulk({
          activities: fresh.map((t) => ({
            crewId: t.crewId,
            activityCodeId: clip.activityCodeId,
            dateIso: t.dateIso,
            startUtcIso: t.startUtcIso,
            endUtcIso: t.endUtcIso,
            notes: clip.notes,
          })),
        })
        get().mergeActivities(res.created as unknown as Array<{ _id: string }>)
        const touchedCrewIds = new Set(fresh.map((t) => t.crewId))
        if (clip.mode === 'cut' && clip.sourceActivityId && res.created.length > 0) {
          const sourceId = clip.sourceActivityId
          const sourceAct = s.activities.find((a) => a._id === sourceId)
          const sourceWasOverwritten =
            sourceAct &&
            res.created.some(
              (c) =>
                (c as unknown as { crewId: string }).crewId === sourceAct.crewId &&
                ((c as unknown as { dateIso?: string | null }).dateIso ?? '') ===
                  (sourceAct.dateIso ?? sourceAct.startUtcIso.slice(0, 10)),
            )
          if (!sourceWasOverwritten) {
            try {
              await api.deleteCrewActivity(sourceId)
              set((st) => ({ activities: st.activities.filter((a) => a._id !== sourceId) }))
              if (sourceAct) touchedCrewIds.add(sourceAct.crewId)
            } catch {
              // Source delete best-effort.
            }
          }
          set({ clipboardActivity: null })
        }
        void get().reconcileCrew([...touchedCrewIds])
        const opId = useOperatorStore.getState().operator?._id
        if (opId) {
          void api.reevaluateCrewRoster({ operatorId: opId, from: s.periodFromIso, to: s.periodToIso }).catch(() => {})
        }
        const failed = res.failed ?? 0
        const pasted = res.created.length
        const reasons: string[] = []
        if (skipped) reasons.push(`${skipped} skipped (had activity)`)
        if (illegal) reasons.push(`${illegal} illegal (pairing conflict)`)
        if (failed) reasons.push(`${failed} failed`)
        set({
          pasteFlash: {
            kind: 'warning',
            text:
              `Pasted ${pasted} ${clip.codeLabel} with FDTL warnings` +
              (reasons.length ? ` · ${reasons.join(' · ')}` : ''),
            ts: Date.now(),
          },
        })
      } catch (e) {
        set({
          pasteFlash: {
            kind: 'error',
            text: `Paste failed: ${(e as Error).message ?? 'unknown error'}`,
            ts: Date.now(),
          },
        })
      }
    },
    mergeActivities: (docs) => {
      if (!docs.length) return
      const byId = new Map(docs.map((d) => [d._id, d]))
      const next = get().activities.map((a) => (byId.has(a._id) ? ({ ...a, ...byId.get(a._id)! } as typeof a) : a))
      const seen = new Set(get().activities.map((a) => a._id))
      for (const d of docs) {
        if (!seen.has(d._id)) next.push(d as unknown as (typeof next)[number])
      }
      set({ activities: next })
    },
    mergeAssignments: (docs) => {
      if (!docs.length) return
      const byId = new Map(docs.map((d) => [d._id, d]))
      const next = get().assignments.map((a) => (byId.has(a._id) ? ({ ...a, ...byId.get(a._id)! } as typeof a) : a))
      const seen = new Set(get().assignments.map((a) => a._id))
      for (const d of docs) {
        if (!seen.has(d._id)) next.push(d as unknown as (typeof next)[number])
      }
      set({ assignments: next })
    },
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
          localStorage.setItem('horizon.crewSchedule.uncrewedTrayVisible.v2', next ? '1' : '0')
        } catch {
          // ignore
        }
      }
      // Opening the tray: lazy-fetch the uncrewed shortfall + the
      // uncrewed pairings themselves. The main aggregator scopes
      // pairings to "those with assignments" so this tray's data is
      // never present at initial load. Merging append-only keeps the
      // already-rendered Gantt rows untouched.
      if (next) {
        void get().loadUncrewed()
      }
    },
    setUncrewedTrayVisible: (visible) => {
      set({ uncrewedTrayVisible: visible })
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('horizon.crewSchedule.uncrewedTrayVisible.v2', visible ? '1' : '0')
        } catch {
          // ignore
        }
      }
      if (visible) {
        void get().loadUncrewed()
      }
    },
    loadUncrewed: async () => {
      // Generation guard — protects against stale results when the user
      // re-clicks Go (or changes filters) while a prior prefetch is still
      // in flight. Each call increments the module-scoped counter and
      // remembers its own value; only the latest issued call commits its
      // response to the store.
      const gen = ++uncrewedFetchGen
      const s = get()
      try {
        set({ uncrewedLoading: true })
        const res = await api.getCrewScheduleUncrewed({
          from: s.periodFromIso,
          to: s.periodToIso,
          base: s.filters.baseIds.length === 1 ? s.filters.baseIds[0] : undefined,
          position: s.filters.positionIds.length === 1 ? s.filters.positionIds[0] : undefined,
          acType: s.filters.acTypeIcaos.length === 1 ? s.filters.acTypeIcaos[0] : undefined,
          crewGroup: s.filters.crewGroupIds.length === 1 ? s.filters.crewGroupIds[0] : undefined,
          crewSearch: s.filters.specificCrewTokens.length > 0 ? s.filters.specificCrewTokens : undefined,
          offset: 0,
          limit: s.uncrewedPageSize,
        })
        if (gen !== uncrewedFetchGen) return // newer call superseded us
        // Merge uncrewed pairings into the existing pairings list,
        // de-duplicating by _id. Existing entries win (already hydrated
        // with crewCounts overlay etc.).
        const existing = new Set(get().pairings.map((p) => p._id))
        const newOnes = res.pairings.filter((p) => !existing.has(p._id))
        set({
          uncrewed: res.uncrewed,
          uncrewedTotal: res.total,
          pairings: newOnes.length > 0 ? [...get().pairings, ...newOnes] : get().pairings,
        })
      } catch {
        // Silent — tray will stay empty until next open.
      } finally {
        // Only the latest call clears the loading flag; otherwise an
        // earlier prefetch landing late would race a newer one and
        // flicker the spinner off prematurely.
        if (gen === uncrewedFetchGen) set({ uncrewedLoading: false })
      }
    },
    loadMoreUncrewed: async () => {
      const s = get()
      if (s.uncrewedLoading) return
      if (s.uncrewed.length >= s.uncrewedTotal) return
      const gen = ++uncrewedFetchGen
      try {
        set({ uncrewedLoading: true })
        const res = await api.getCrewScheduleUncrewed({
          from: s.periodFromIso,
          to: s.periodToIso,
          base: s.filters.baseIds.length === 1 ? s.filters.baseIds[0] : undefined,
          position: s.filters.positionIds.length === 1 ? s.filters.positionIds[0] : undefined,
          acType: s.filters.acTypeIcaos.length === 1 ? s.filters.acTypeIcaos[0] : undefined,
          crewGroup: s.filters.crewGroupIds.length === 1 ? s.filters.crewGroupIds[0] : undefined,
          crewSearch: s.filters.specificCrewTokens.length > 0 ? s.filters.specificCrewTokens : undefined,
          offset: s.uncrewed.length,
          limit: s.uncrewedPageSize,
        })
        if (gen !== uncrewedFetchGen) return
        const existingPairings = new Set(get().pairings.map((p) => p._id))
        const newPairings = res.pairings.filter((p) => !existingPairings.has(p._id))
        const existingUncrewed = new Set(get().uncrewed.map((u) => u.pairingId))
        const newUncrewed = res.uncrewed.filter((u) => !existingUncrewed.has(u.pairingId))
        set({
          uncrewed: newUncrewed.length > 0 ? [...get().uncrewed, ...newUncrewed] : get().uncrewed,
          uncrewedTotal: res.total,
          pairings: newPairings.length > 0 ? [...get().pairings, ...newPairings] : get().pairings,
        })
      } catch {
        // Silent — next user attempt re-fires.
      } finally {
        if (gen === uncrewedFetchGen) set({ uncrewedLoading: false })
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
    loadFlightBookings: async () => {
      const s = get()
      try {
        const rows = await api.getCrewFlightBookings({
          from: s.periodFromIso,
          to: s.periodToIso,
        })
        set({ flightBookings: rows })
      } catch {
        // Non-critical — stale chips self-heal on next reconcile.
      }
    },
    openPositioningDrawer: (d) => set({ positioningDrawer: d, contextMenu: null }),
    closePositioningDrawer: () => set({ positioningDrawer: null }),
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
    scrollToCrew: (crewId) =>
      set((s) => ({ scrollTargetCrewId: crewId, scrollTargetCrewTick: s.scrollTargetCrewTick + 1 })),
    consumeScrollTargetCrew: () => set({ scrollTargetCrewId: null }),
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
