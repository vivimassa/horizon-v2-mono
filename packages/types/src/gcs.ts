/**
 * @file types/gcs.ts
 * Horizon GCS — complete TypeScript contract.
 * All agents import from here. No 'any' types.
 */

// ── ENUMS ───────────────────────────────────────────────────────────────────

/** Controls how duties are rendered on the Gantt grid. */
export enum DisplayMode {
  PAIRING = 'pairing',
  DUTY_PERIOD = 'duty_period',
  LEG = 'leg',
}

/** Which timezone label to show in the date/time header. */
export enum TimeMode {
  LOCAL = 'local',
  UTC = 'utc',
  BOTH = 'both',
}

/** How many days are rendered in one viewport. */
export enum ZoomLevel {
  ONE = 1,
  TWO = 2,
  THREE = 3,
  FOUR = 4,
  FIVE = 5,
  SIX = 6,
  SEVEN = 7,
  FOURTEEN = 14,
  TWENTY_EIGHT = 28,
  MONTH = 30,
}

/** @deprecated Position codes are now dynamic (defined in crew_positions table). Use string instead. */
export enum CrewPosition {
  CP = 'CP',
  FO = 'FO',
  CM = 'CM',
  FA = 'FA',
}

/** Broad category for a duty entry. */
export enum DutyType {
  FLIGHT = 'flight',
  GROUND = 'ground',
  REST = 'rest',
}

/** Well-known codes for non-flight (ground) duties. */
export enum GroundCode {
  /** Day off */
  OFF = 'OFF',
  /** Rest day — system-assigned when preceding duty crosses midnight local; not a qualifying day off */
  REST = 'REST',
  /** Standby */
  SBY = 'SBY',
  /** Sick leave */
  SICK = 'SICK',
  /** Annual leave */
  LVE = 'LVE',
  /** Training */
  TRN = 'TRN',
  /** Rest day off (regulatory) */
  ROFF = 'ROFF',
}

/** Badge indicators overlaid on a duty bar. */
export enum DutyIndicator {
  /** Pre-assigned */
  P = 'P',
  /** Requested by crew */
  R = 'R',
  /** Notification pending */
  N = 'N',
  /** Memo attached */
  M = 'M',
  /** Language qualified */
  L = 'L',
  /** Training observer */
  T = 'T',
}

/** Legality check result level. */
export enum LegalityLevel {
  LEGAL = 'legal',
  /** Warning — can proceed */
  SOFT = 'soft',
  /** Violation — must fix */
  HARD = 'hard',
}

/** Identifies the dragged item type in dnd context. */
export enum DragItemType {
  CREW_DUTY = 'crew_duty',
  UNCREWED_PAIRING = 'uncrewed_pairing',
}

// ── CORE DOMAIN TYPES ────────────────────────────────────────────────────────

/**
 * Aircraft type identifier, e.g. '332', '321', '77W', '738'.
 * Typed as a union of known codes plus arbitrary strings for extensibility.
 */
export type AircraftType = '332' | '321' | '77W' | '738' | string

/**
 * A flight duty within a crew schedule.
 * Represents one pairing assignment for a single crew member.
 */
export interface FlightDuty {
  /** Unique duty ID. */
  id: string
  type: DutyType.FLIGHT
  /** Pairing reference code, e.g. "PA1234". */
  pairingCode: string
  /** Aircraft type operating this duty. */
  aircraftType: AircraftType
  /** Route string, e.g. "LHR-CDG-LHR". */
  route: string
  /** Scheduled departure in local time of departure station, e.g. "06:45". */
  scheduledDep: string
  /** Scheduled arrival in local time of arrival station, e.g. "14:30 +1". */
  scheduledArr: string
  /** Actual UTC departure timestamp. */
  depUtc: Date
  /** Actual UTC arrival timestamp. */
  arrUtc: Date
  /**
   * 0-indexed day offset from `scheduleStart` (UTC date).
   * Determines which column the bar is placed in.
   */
  dayOffset: number
  /** Badge indicators to render on the duty bar. */
  indicators: DutyIndicator[]
  /** Highest legality level for this duty. */
  legalityLevel: LegalityLevel
  /** Human-readable legality remark strings. */
  legalityRemarks: string[]
  /** Free-text memos attached to this duty. */
  memos: string[]
}

/**
 * A ground duty (off day, standby, leave, etc.) for a crew member.
 */
export interface GroundDuty {
  /** Unique duty ID. */
  id: string
  type: DutyType.GROUND
  /** The ground activity code. */
  code: GroundCode
  /**
   * 0-indexed day offset from `scheduleStart` (UTC date).
   */
  dayOffset: number
  /** Badge indicators to render on the duty bar. */
  indicators: DutyIndicator[]
  /** Free-text memos attached to this duty. */
  memos: string[]
}

/** Discriminated union of all duty types. */
export type Duty = FlightDuty | GroundDuty

/**
 * An uncrewed pairing that needs to be assigned to a crew member.
 * Rendered in the UncrewedPanel and can be dragged onto the Gantt grid.
 */
export interface UncrewedPairing {
  /** Unique pairing ID. */
  id: string
  /** Pairing reference code, e.g. "PA1234". */
  pairingCode: string
  /** Aircraft type for this pairing. */
  aircraftType: AircraftType
  /** Route string, e.g. "DXB-LHR-DXB". */
  route: string
  /**
   * Operating day — 0-indexed offset from `scheduleStart`.
   * Determines which column the uncrewed card appears under.
   */
  dayOffset: number
  /** The crew position code that must fill this pairing. */
  requiredPosition: string
  /** Scheduled departure in local time of dep station, e.g. "06:45". */
  scheduledDep: string
  /** Scheduled arrival in local time of arr station, e.g. "14:30 +1". */
  scheduledArr: string
  /** Actual UTC departure timestamp. */
  depUtc: Date
  /** Actual UTC arrival timestamp. */
  arrUtc: Date
  /** Coverage status across all required positions for this pairing. */
  coverageStatus: 'uncovered' | 'mixed' | 'overcovered'
}

/**
 * A crew member with all their schedule duties for the active period.
 */
export interface CrewMember {
  /** Numeric primary key (matches DB). */
  id: number
  /** Employee/staff ID string, e.g. "EK-04821". */
  employeeId: string
  /** Full display name. */
  fullName: string
  /** Home base IATA code, e.g. "LHR" or "DXB". */
  base: string
  /** Crew position code (e.g. "CP", "CA"). Dynamic — matches crew_positions.code. */
  position: string
  /** Aircraft type the crew is qualified on. */
  aircraftType: AircraftType
  /** Seniority number (lower = more senior). */
  seniority: number
  /** Block hours accumulated in the current schedule period. */
  blockHours: number
  /** Regulatory block-hours limit for the current period. */
  blockHoursLimit: number
  /** All duties for this crew member, sorted by dayOffset ascending. */
  duties: Duty[]
}

/**
 * A home base grouping used to render header rows and cluster crew.
 */
export interface BaseGroup {
  /** IATA code, e.g. "LHR". */
  code: string
  /** Full base name, e.g. "London Heathrow". */
  name: string
  /** UTC offset in whole hours, e.g. +1 for BST, +4 for Gulf Standard. */
  utcOffset: number
  /** IANA timezone identifier for date-fns calls, e.g. "Europe/London". */
  ianaTimezone: string
  /** Crew members belonging to this base, ordered by position then seniority. */
  crew: CrewMember[]
  /**
   * Computed coverage percentage for the current view period (0–100).
   * Derived from crewed vs total pairings operating out of this base.
   */
  coveragePct: number
}

// ── UI STATE TYPES ────────────────────────────────────────────────────────────

/**
 * Identifies a single cell (crew × day) on the Gantt grid.
 */
export interface SelectedCell {
  crewId: number
  dayOffset: number
}

/**
 * Position and context for the right-click context menu.
 */
export interface ContextMenuState {
  /** Pixel X coordinate of the menu anchor. */
  x: number
  /** Pixel Y coordinate of the menu anchor. */
  y: number
  crewId: number
  dayOffset: number
  /** The duty under the cursor, or null if the cell is empty. */
  duty: Duty | null
}

/**
 * Active drag session state. Either a CREW_DUTY or an UNCREWED_PAIRING
 * will be populated depending on drag type.
 */
export interface DragState {
  type: DragItemType
  /** Present when type === CREW_DUTY */
  crewId?: number
  /** Present when type === CREW_DUTY */
  dayOffset?: number
  /** Present when type === CREW_DUTY */
  duty?: FlightDuty
  /** Present when type === UNCREWED_PAIRING */
  pairing?: UncrewedPairing
}

/**
 * A single toast notification message.
 */
export interface ToastMessage {
  /** Unique toast ID (UUID). */
  id: string
  /** Human-readable notification text. */
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}

// ── STORE SLICE TYPES ─────────────────────────────────────────────────────────

/**
 * All view/display preference state.
 */
export interface ViewState {
  /** How duties are rendered (pairing / duty-period / leg). */
  displayMode: DisplayMode
  /** Which timezone labels are shown. */
  timeMode: TimeMode
  /** Number of days visible in the Gantt viewport. */
  zoomLevel: ZoomLevel
  /**
   * Scroll offset: how many days past `scheduleStart` the viewport begins.
   * 0 means the first column shows `scheduleStart`.
   */
  viewStartOffset: number
  /**
   * Base filter. "ALL" shows all bases; otherwise an IATA code
   * restricts visible crew rows to that base.
   */
  filterBase: string
  /**
   * Aircraft type filter. "ALL" shows all crew; otherwise an AC type code
   * restricts visible crew rows to that aircraft type.
   */
  filterAcType: string
  /** Free-text search query for crew member names or IDs. */
  searchQuery: string
  /**
   * Map of base code → collapsed boolean.
   * When true, that base's crew rows are hidden.
   */
  collapsedBases: Record<string, boolean>
  /**
   * Vertical split position as a percentage (0–100).
   * Represents the percentage of total height given to the crew Gantt area.
   */
  splitPct: number
  /**
   * Row height in pixels for each crew row in the Gantt grid.
   * Levels: 28 (compact) | 34 (default) | 44 (large) | 58 (xlarge)
   */
  rowHeight: number
}

/**
 * Server / database-sourced schedule data.
 */
export interface DataState {
  /** UTC midnight of the schedule period start date. */
  scheduleStart: Date
  /** All base groups with their crew and duties loaded. */
  bases: BaseGroup[]
  /** Pairings without a full crew complement. */
  uncrewed: UncrewedPairing[]
  /** True while any async data fetch is in flight. */
  isLoading: boolean
}

/**
 * Active swap mode — either a single-duty swap or a date-range swap.
 */
export interface SwapState {
  mode: 'single' | 'range'
  /** The crew member initiating the swap. */
  sourceCrewId: number
  /** Single mode: day offset of the source duty. */
  sourceDayOffset?: number
  /** Range mode: first day of the selected range (inclusive). */
  startDayOffset?: number
  /** Range mode: last day of the selected range (inclusive). */
  endDayOffset?: number
}

/**
 * A horizontal drag selection within a single crew row.
 */
export interface CellSelection {
  crewId: number
  startDayOffset: number
  endDayOffset: number
}

/**
 * Transient interaction state: selection, drag, menus, drawers, toasts.
 */
export interface InteractionState {
  /** Currently selected cell, or null if none. */
  selectedCell: SelectedCell | null
  /**
   * The duty whose detail panel is currently open (inline right-side panel).
   * null means the panel is closed.
   */
  dutyPanelTarget: { crewId: number; dayOffset: number } | null
  /** Active context menu, or null if not open. */
  contextMenu: ContextMenuState | null
  /** Active drag session, or null if not dragging. */
  dragState: DragState | null
  /**
   * Which side drawer / panel is currently open.
   * null means all drawers are closed.
   */
  openDrawer: 'duty_detail' | 'legality' | 'standby' | null
  /**
   * Crew member whose data populates the open drawer.
   * null when openDrawer is null.
   */
  drawerCrewId: number | null
  /**
   * Day offset context for the open drawer.
   * null when openDrawer is null.
   */
  drawerDayOffset: number | null
  /** Stack of active toast notifications. */
  toasts: ToastMessage[]
  /** Active swap mode, or null when not swapping. */
  swapState: SwapState | null
  /** Active horizontal drag selection within a crew row, or null. */
  cellSelection: CellSelection | null
}

// ── FULL STORE TYPE ───────────────────────────────────────────────────────────

/**
 * Complete Zustand store interface — merges all slice interfaces and
 * declares every action signature.
 */
export interface GCSStore extends ViewState, DataState, InteractionState {
  // ── View actions ──────────────────────────────────────────────────────────

  setDisplayMode: (mode: DisplayMode) => void
  setTimeMode: (mode: TimeMode) => void
  setZoom: (level: ZoomLevel) => void
  navigatePrev: () => void
  navigateNext: () => void
  setFilterBase: (base: string) => void
  setFilterAcType: (type: string) => void
  setSearch: (q: string) => void
  setScheduleStart: (date: Date) => void
  setViewStartOffset: (offset: number) => void
  setRowHeight: (h: number) => void
  toggleBaseCollapse: (base: string) => void
  setSplitPct: (pct: number) => void

  // ── Data mutation actions ──────────────────────────────────────────────────

  assignDuty: (crewId: number, pairing: UncrewedPairing) => void
  removeDuty: (crewId: number, dayOffset: number) => void
  moveDuty: (fromCrewId: number, toCrewId: number, dayOffset: number) => void

  // ── Interaction actions ────────────────────────────────────────────────────

  setSelectedCell: (cell: SelectedCell | null) => void
  setContextMenu: (menu: ContextMenuState | null) => void
  setDragState: (drag: DragState | null) => void
  openDetailDrawer: (crewId: number, dayOffset: number) => void
  openLegalityDrawer: (crewId: number, dayOffset: number) => void
  openStandbyPanel: (dayOffset: number, position: string) => void
  closeDrawer: () => void
  setDutyPanelTarget: (target: { crewId: number; dayOffset: number } | null) => void
  setSwapState: (state: SwapState | null) => void
  setCellSelection: (sel: CellSelection | null) => void
  swapDuties: (crew1Id: number, crew1DayOffset: number, crew2Id: number, crew2DayOffset: number) => void
  swapDutyRange: (crew1Id: number, crew2Id: number, startOffset: number, endOffset: number) => void

  // ── Toast actions ──────────────────────────────────────────────────────────

  addToast: (message: string, type: ToastMessage['type']) => void
  dismissToast: (id: string) => void
}
