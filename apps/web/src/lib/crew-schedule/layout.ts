import type {
  ActivityCodeGroupRef,
  ActivityCodeRef,
  CrewActivityRef,
  CrewAssignmentRef,
  CrewMemberListItemRef,
  CrewMemoRef,
  CrewSchedulePublicationAssignmentRef,
  PairingRef,
} from '@skyhub/api'
import { isSmartFilterActive, matchesSmartFilter, type SmartFilterCriteria } from './smart-filter'

export type CrewScheduleZoom = '1D' | '2D' | '3D' | '4D' | '5D' | '6D' | '7D' | '14D' | '28D' | 'M'
export type BarLabelMode = 'pairing' | 'sector' | 'flight'

export interface CrewRowLayout {
  crewId: string
  y: number
  height: number
  crew: CrewMemberListItemRef
  /** Set when the Smart Filter is in 'highlight' mode and this row matches. */
  smartMatch?: boolean
  /** Sum of block minutes from all non-cancelled assignments in the
   *  visible period. Used by the left-panel block-hour chip. */
  blockMinutesInPeriod: number
}

export interface AssignmentBarLayout {
  assignmentId: string
  pairingId: string
  crewId: string
  x: number
  y: number
  width: number
  height: number
  label: string
  status: CrewAssignmentRef['status']
  fdtlStatus: PairingRef['fdtlStatus']
  hasDeadhead: boolean
  /** True when the pairing has at least one 'pairing'-scope memo. */
  hasMemo?: boolean
  /** Diff vs published snapshot (AIMS F10). Unset when overlay is off. */
  diff?: 'added' | 'reassigned' | 'unchanged'
}

/** Published-but-removed assignment rendered as a ghost bar in the
 *  original crew's row. */
export interface GhostBarLayout {
  snapshotAssignmentId: string
  pairingId: string
  crewId: string
  x: number
  y: number
  width: number
  height: number
  label: string
}

export interface RestStripLayout {
  crewId: string
  x: number
  y: number
  width: number
  height: number
  fromAssignmentId: string
  toAssignmentId: string
}

export interface ActivityBarLayout {
  activityId: string
  crewId: string
  activityCodeId: string
  x: number
  y: number
  width: number
  height: number
  label: string
  /** Fill colour from the activity code (fallback: gray). */
  color: string
}

export interface CrewScheduleLayout {
  rows: CrewRowLayout[]
  bars: AssignmentBarLayout[]
  activityBars: ActivityBarLayout[]
  restStrips: RestStripLayout[]
  /** Bars present in the published snapshot but absent now — drawn as
   *  dashed ghosts behind live bars when the overlay is on. */
  ghostBars: GhostBarLayout[]
  totalWidth: number
  totalHeight: number
  periodStartMs: number
  periodDays: number
  pph: number
  /** Resolved row height in px (from CREW_ROW_HEIGHT_LEVELS[rowHeightLevel]). */
  rowH: number
  /** Resolved bar height in px. */
  barH: number
}

/** Four row-height levels, matching `ROW_HEIGHT_LEVELS` in @/lib/gantt/types. */
export const CREW_ROW_HEIGHT_LEVELS = [
  { label: 'compact', rowH: 32, barH: 22, fontSize: 10 },
  { label: 'default', rowH: 44, barH: 28, fontSize: 11 },
  { label: 'large', rowH: 56, barH: 36, fontSize: 12 },
  { label: 'xlarge', rowH: 72, barH: 48, fontSize: 13 },
] as const

const MIN_BAR_WIDTH_PX = 4
const MIN_REST_WIDTH_PX = 2

/** Inclusive length of the user-picked period, in days. */
export function periodLengthInDays(periodFromIso: string, periodToIso: string): number {
  const from = new Date(periodFromIso + 'T00:00:00Z').getTime()
  const to = new Date(periodToIso + 'T00:00:00Z').getTime()
  return Math.max(1, Math.round((to - from) / 86_400_000) + 1)
}

/**
 * Number of days visible in the viewport at once for a given zoom.
 * The special `M` zoom means "fit the whole period" — equivalent to
 * zoomDays == periodDays so there's no horizontal scroll.
 */
export function zoomVisibleDays(zoom: CrewScheduleZoom, periodDays: number): number {
  if (zoom === 'M') return periodDays
  const n = Number(zoom.replace('D', ''))
  return Math.max(1, Math.min(n, periodDays))
}

/** Pixels per hour so `visibleDays` fit across `containerWidth`. */
export function computePixelsPerHour(containerWidth: number, visibleDays: number): number {
  return Math.max(0.3, containerWidth / (visibleDays * 24))
}

export interface BuildLayoutInput {
  crew: CrewMemberListItemRef[]
  pairings: PairingRef[]
  assignments: CrewAssignmentRef[]
  activities: CrewActivityRef[]
  activityCodes: ActivityCodeRef[]
  activityGroups: ActivityCodeGroupRef[]
  memos: CrewMemoRef[]
  periodFromIso: string
  periodToIso: string
  containerWidth: number
  zoom: CrewScheduleZoom
  barLabelMode: BarLabelMode
  filters: { baseIds: string[]; positionIds: string[]; acTypeIcaos: string[] }
  /** 0..3 — indexes into CREW_ROW_HEIGHT_LEVELS. */
  rowHeightLevel: number
  /** Crew ids hidden from the current view (AIMS §4.5 "Exclude crew"). */
  excludedCrewIds?: Set<string>
  /** Optional Smart Filter — applies show-only/highlight/exclude to rows. */
  smartFilter?: SmartFilterCriteria
  /** When the "Compare to Published" overlay is on, the snapshot's
   *  assignments drive per-bar diff flags and ghost-bar rendering. */
  publishedSnapshotAssignments?: CrewSchedulePublicationAssignmentRef[]
  /** Positions — used by the 'seat' grouping to resolve seatPositionId to
   *  a seat code for grouping. Optional when grouping is not set. */
  positions?: Array<{ _id: string; code: string; rankOrder: number }>
  /** Optional date-scoped crew grouping (AIMS §4.4). When set, replaces
   *  the default base→seniority→lastName sort with a group-aware sort. */
  grouping?: { kind: 'activity' | 'base' | 'seat'; dateIso: string }
  /** FDTL-driven minimum rest rules (minutes). When non-zero, each
   *  assignment bar anchors a zebra "mandatory rest" strip immediately
   *  after it, width = `max(minHoursForBase, precedingDutyMinutes)`. */
  restRules?: { homeBaseMinMinutes: number; awayMinMinutes: number }
}

/**
 * Pre-sort the raw crew roster for the 4.1.6 Gantt. Called by the store
 * at commit time and whenever the grouping toggle changes — never on a
 * silent reconcile, so assigning/deleting/swapping duties never moves a
 * row up or down.
 *
 * Default order: base → seniority → lastName (matches server sort).
 * Grouping order: date-scoped bucket (activity / base / seat), with
 * seniority + lastName as tie-breakers.
 */
export interface SortCrewInput {
  crew: CrewMemberListItemRef[]
  assignments: CrewAssignmentRef[]
  activities: CrewActivityRef[]
  pairings: PairingRef[]
  positions?: Array<{ _id: string; code: string; rankOrder?: number | null }>
  grouping?: { kind: 'activity' | 'base' | 'seat'; dateIso: string } | null
}

export function sortCrewRoster(input: SortCrewInput): CrewMemberListItemRef[] {
  const list = [...input.crew]
  const grouping = input.grouping
  if (grouping) {
    const dateIso = grouping.dateIso
    const dayStartMs = new Date(dateIso + 'T00:00:00Z').getTime()
    const dayEndMs = dayStartMs + 86_400_000
    const assignByCrew = new Map<string, CrewAssignmentRef>()
    const actByCrew = new Map<string, CrewActivityRef>()
    for (const a of input.assignments) {
      if (a.status === 'cancelled') continue
      const s = new Date(a.startUtcIso).getTime()
      const e = new Date(a.endUtcIso).getTime()
      if (s < dayEndMs && e > dayStartMs && !assignByCrew.has(a.crewId)) {
        assignByCrew.set(a.crewId, a)
      }
    }
    for (const a of input.activities) {
      const ad = a.dateIso ?? a.startUtcIso.slice(0, 10)
      if (ad === dateIso && !actByCrew.has(a.crewId)) actByCrew.set(a.crewId, a)
    }
    const positionByCode = new Map(input.positions?.map((p) => [p._id, p]) ?? [])
    const pairingById = new Map(input.pairings.map((p) => [p._id, p]))

    const bucketKey = (c: CrewMemberListItemRef): string => {
      const assign = assignByCrew.get(c._id)
      const act = actByCrew.get(c._id)
      if (grouping.kind === 'activity') {
        if (assign) return `0|${assign.pairingId}`
        if (act) return `1|${act.activityCodeId}`
        return '2|'
      }
      if (grouping.kind === 'base') {
        if (assign) {
          const p = pairingById.get(assign.pairingId)
          return `0|${p?.baseAirport ?? 'ZZZ'}`
        }
        return `1|${c.baseLabel ?? 'ZZZ'}`
      }
      if (assign) {
        const pos = positionByCode.get(assign.seatPositionId)
        return `0|${String(pos?.rankOrder ?? 999).padStart(4, '0')}|${pos?.code ?? 'ZZZ'}`
      }
      if (act) return '1|ACT'
      return '2|'
    }

    list.sort((a, b) => {
      const ka = bucketKey(a)
      const kb = bucketKey(b)
      if (ka !== kb) return ka < kb ? -1 : 1
      const sa = a.seniority ?? 9999
      const sb = b.seniority ?? 9999
      if (sa !== sb) return sa - sb
      return a.lastName.localeCompare(b.lastName)
    })
  } else {
    list.sort((a, b) => {
      const bc = (a.baseLabel ?? '').localeCompare(b.baseLabel ?? '')
      if (bc !== 0) return bc
      const sa = a.seniority ?? 9999
      const sb = b.seniority ?? 9999
      if (sa !== sb) return sa - sb
      return a.lastName.localeCompare(b.lastName)
    })
  }
  return list
}

export function buildCrewScheduleLayout(input: BuildLayoutInput): CrewScheduleLayout {
  const periodStartMs = new Date(input.periodFromIso + 'T00:00:00Z').getTime()
  const periodDays = periodLengthInDays(input.periodFromIso, input.periodToIso)
  const visibleDays = zoomVisibleDays(input.zoom, periodDays)
  const pph = computePixelsPerHour(input.containerWidth, visibleDays)
  // totalWidth spans the full period — when visibleDays < periodDays,
  // the scroll container exposes a horizontal scrollbar; when visibleDays
  // === periodDays (e.g. zoom='M'), totalWidth === containerWidth so
  // there's no scrolling needed. Matches 4.1.5.2's range behavior.
  const totalWidth = periodDays * 24 * pph

  const level = CREW_ROW_HEIGHT_LEVELS[Math.max(0, Math.min(3, input.rowHeightLevel))]
  const ROW_H = level.rowH
  const BAR_H = level.barH

  // Filter crew
  const excluded = input.excludedCrewIds
  let visibleCrew = input.crew.filter((c) => {
    if (excluded && excluded.has(c._id)) return false
    if (input.filters.baseIds.length > 0 && (!c.base || !input.filters.baseIds.includes(c.base))) return false
    if (input.filters.positionIds.length > 0 && (!c.position || !input.filters.positionIds.includes(c.position)))
      return false
    if (input.filters.acTypeIcaos.length > 0) {
      const qualTypes = (c.qualifications ?? []).map((q) => q.aircraftType)
      const have = qualTypes.length > 0 ? qualTypes : (c.acTypes ?? [])
      if (!have.some((t) => input.filters.acTypeIcaos.includes(t))) return false
    }
    return true
  })

  // Apply Smart Filter (AIMS §3 / §6.4). Highlight mode tags rows
  // rather than filtering them; show-only / exclude trim the list.
  const sf = input.smartFilter
  const smartActive = sf && isSmartFilterActive(sf)
  const smartMatched = new Set<string>()
  if (smartActive && sf) {
    const ctx = {
      assignments: input.assignments,
      activities: input.activities,
      pairings: input.pairings,
    }
    for (const c of visibleCrew) {
      if (matchesSmartFilter(c, sf, ctx)) smartMatched.add(c._id)
    }
    if (sf.mode === 'show-only') {
      visibleCrew = visibleCrew.filter((c) => smartMatched.has(c._id))
    } else if (sf.mode === 'exclude') {
      visibleCrew = visibleCrew.filter((c) => !smartMatched.has(c._id))
    }
    // 'highlight' mode: keep everyone; row.smartMatch is set below.
  }

  // Ordering is authoritative from `input.crew` — the store pre-sorts
  // it on commit / filter change / grouping toggle via `sortCrewRoster`.
  // Silent reconciles (after assign/delete/swap) preserve that order so
  // crew rows don't reshuffle on every mutation.

  // Per-crew block-hour totals within the period — drives the inline
  // block-hour chip in the left panel. Sums pairing.totalBlockMinutes
  // for every non-cancelled assignment; no pro-rating across the period
  // edges because the aggregator already bounds to the window.
  const pairingByIdForBlock = new Map(input.pairings.map((p) => [p._id, p]))
  const blockMinutesByCrew = new Map<string, number>()
  for (const a of input.assignments) {
    if (a.status === 'cancelled') continue
    const p = pairingByIdForBlock.get(a.pairingId)
    if (!p) continue
    blockMinutesByCrew.set(a.crewId, (blockMinutesByCrew.get(a.crewId) ?? 0) + (p.totalBlockMinutes ?? 0))
  }

  const rows: CrewRowLayout[] = visibleCrew.map((crew, i) => ({
    crewId: crew._id,
    y: i * ROW_H,
    height: ROW_H,
    crew,
    smartMatch: smartActive && sf?.mode === 'highlight' ? smartMatched.has(crew._id) : undefined,
    blockMinutesInPeriod: blockMinutesByCrew.get(crew._id) ?? 0,
  }))
  const rowByCrew = new Map(rows.map((r) => [r.crewId, r]))

  const pairingById = new Map(input.pairings.map((p) => [p._id, p]))

  // Precompute which pairings have memos so bars can render a dot.
  const pairingsWithMemo = new Set(input.memos.filter((m) => m.scope === 'pairing').map((m) => m.targetId))

  // Publication-snapshot indexes for the F10 overlay. `diffOn` is true
  // whenever a snapshot was supplied; otherwise all bars render as
  // plain (no diff flags, no ghost layer).
  const diffOn = !!input.publishedSnapshotAssignments
  const snapshotById = new Map<string, CrewSchedulePublicationAssignmentRef>()
  if (input.publishedSnapshotAssignments) {
    for (const a of input.publishedSnapshotAssignments) snapshotById.set(a.assignmentId, a)
  }
  const currentAssignmentIds = new Set(input.assignments.map((a) => a._id))

  const bars: AssignmentBarLayout[] = []
  for (const a of input.assignments) {
    const row = rowByCrew.get(a.crewId)
    if (!row) continue
    const pairing = pairingById.get(a.pairingId)
    if (!pairing) continue
    const startMs = new Date(a.startUtcIso).getTime()
    const endMs = new Date(a.endUtcIso).getTime()
    const x = ((startMs - periodStartMs) / 3_600_000) * pph
    const w = Math.max(MIN_BAR_WIDTH_PX, ((endMs - startMs) / 3_600_000) * pph)
    let diff: AssignmentBarLayout['diff'] | undefined
    if (diffOn) {
      const snap = snapshotById.get(a._id)
      if (!snap) diff = 'added'
      else if (snap.crewId !== a.crewId) diff = 'reassigned'
      else diff = 'unchanged'
    }
    bars.push({
      assignmentId: a._id,
      pairingId: a.pairingId,
      crewId: a.crewId,
      x,
      y: row.y + (ROW_H - BAR_H) / 2,
      width: w,
      height: BAR_H,
      label: computeBarLabel(pairing, input.barLabelMode),
      status: a.status,
      fdtlStatus: pairing.fdtlStatus,
      hasDeadhead: pairing.legs.some((l) => l.isDeadhead),
      hasMemo: pairingsWithMemo.has(a.pairingId),
      diff,
    })
  }

  // Rest strips: "mandatory rest after duty" zebra anchored to the end
  // of every bar. Width = `max(minHoursForBase, precedingDutyMinutes)`
  // per CAAV-style rules (§15.037 — rest must match or exceed the
  // preceding duty period). Capped at the next bar's start so it never
  // overlaps the following pairing — if required rest would overshoot,
  // the legality engine flags it separately; the strip just stops short.
  const barsByCrew = new Map<string, AssignmentBarLayout[]>()
  for (const b of bars) {
    const arr = barsByCrew.get(b.crewId) ?? []
    arr.push(b)
    barsByCrew.set(b.crewId, arr)
  }
  const restStrips: RestStripLayout[] = []
  const restRules = input.restRules
  const restActive = !!restRules && (restRules.homeBaseMinMinutes > 0 || restRules.awayMinMinutes > 0)
  for (const [crewId, list] of barsByCrew) {
    list.sort((a, b) => a.x - b.x)
    const row = rowByCrew.get(crewId)
    if (!row) continue
    for (let i = 0; i < list.length; i += 1) {
      const bar = list[i]
      if (!restActive) continue
      const pairing = pairingById.get(bar.pairingId)
      if (!pairing) continue
      // Home base iff the pairing's last leg lands at its base.
      const lastLeg = pairing.legs[pairing.legs.length - 1]
      const endsAtBase = !!lastLeg && !!pairing.baseAirport && lastLeg.arrStation === pairing.baseAirport
      const minMins = endsAtBase ? restRules!.homeBaseMinMinutes : restRules!.awayMinMinutes
      const dutyMins = Math.max(0, pairing.totalDutyMinutes ?? 0)
      const requiredMins = Math.max(minMins, dutyMins)
      if (requiredMins <= 0) continue
      const desiredWidth = (requiredMins / 60) * pph
      const restX = bar.x + bar.width
      // Cap at the next bar's left edge, or the period's total width.
      const next = list[i + 1]
      const cap = next ? next.x : totalWidth
      const width = Math.max(0, Math.min(desiredWidth, cap - restX))
      if (width < MIN_REST_WIDTH_PX) continue
      restStrips.push({
        crewId,
        x: restX,
        y: row.y + (ROW_H - BAR_H) / 2,
        width,
        height: BAR_H,
        fromAssignmentId: bar.assignmentId,
        toAssignmentId: next ? next.assignmentId : '',
      })
    }
  }

  // Activity bars — positioned at startUtcIso → endUtcIso, colored per
  // activity code. Rendered behind pairing bars so a pairing always wins
  // visual priority on an overlapping day.
  const activityCodeById = new Map(input.activityCodes.map((c) => [c._id, c]))
  const activityGroupById = new Map(input.activityGroups.map((g) => [g._id, g]))
  const activityBars: ActivityBarLayout[] = []
  for (const a of input.activities) {
    const row = rowByCrew.get(a.crewId)
    if (!row) continue
    const code = activityCodeById.get(a.activityCodeId)
    const group = code ? activityGroupById.get(code.groupId) : undefined
    const startMs = new Date(a.startUtcIso).getTime()
    const endMs = new Date(a.endUtcIso).getTime()
    const x = ((startMs - periodStartMs) / 3_600_000) * pph
    const w = Math.max(MIN_BAR_WIDTH_PX, ((endMs - startMs) / 3_600_000) * pph)
    activityBars.push({
      activityId: a._id,
      crewId: a.crewId,
      activityCodeId: a.activityCodeId,
      x,
      y: row.y + (ROW_H - BAR_H) / 2,
      width: w,
      height: BAR_H,
      label: code?.shortLabel ?? code?.code ?? '—',
      // Fallback cascade matches the Activity Assign picker pill:
      // code.color → group.color → neutral gray.
      color: code?.color ?? group?.color ?? '#9A9BA8',
    })
  }

  // Rest strips after duty-ish activities (Ground Duty, Deadhead, Airport/
  // Home Standby, Training, Simulator). Uses the same `max(minRest, duty)`
  // rule as pairings; capped at the next bar (pairing or activity) on the
  // same crew row so it doesn't overlap the next duty.
  if (restActive) {
    const REST_FLAGS = new Set([
      'is_flight_duty',
      'is_ground_duty',
      'is_deadhead',
      'is_airport_standby',
      'is_home_standby',
      'is_training',
      'is_simulator',
    ])
    // Precompute "next bar start x" per crew by scanning all pairing +
    // activity bars on that crew row, sorted by x.
    const allBarsByCrew = new Map<string, { x: number; width: number }[]>()
    for (const b of bars) {
      const arr = allBarsByCrew.get(b.crewId) ?? []
      arr.push({ x: b.x, width: b.width })
      allBarsByCrew.set(b.crewId, arr)
    }
    for (const ab of activityBars) {
      const arr = allBarsByCrew.get(ab.crewId) ?? []
      arr.push({ x: ab.x, width: ab.width })
      allBarsByCrew.set(ab.crewId, arr)
    }
    for (const arr of allBarsByCrew.values()) arr.sort((a, b) => a.x - b.x)

    for (const ab of activityBars) {
      const code = activityCodeById.get(ab.activityCodeId)
      if (!code) continue
      if (!(code.flags ?? []).some((f) => REST_FLAGS.has(f))) continue
      const row = rowByCrew.get(ab.crewId)
      if (!row) continue
      const crewBars = allBarsByCrew.get(ab.crewId) ?? []
      // "Away vs home" doesn't apply to ground activities — use home-base
      // min as the floor.
      const minMins = restRules!.homeBaseMinMinutes
      const dutyMins = Math.max(0, (ab.width / pph) * 60)
      const requiredMins = Math.max(minMins, dutyMins)
      if (requiredMins <= 0) continue
      const desiredWidth = (requiredMins / 60) * pph
      const restX = ab.x + ab.width
      // Next bar start after this activity's end.
      let cap = totalWidth
      for (const other of crewBars) {
        if (other.x > restX - 0.5) {
          cap = other.x
          break
        }
      }
      const width = Math.max(0, Math.min(desiredWidth, cap - restX))
      if (width < MIN_REST_WIDTH_PX) continue
      restStrips.push({
        crewId: ab.crewId,
        x: restX,
        y: row.y + (ROW_H - BAR_H) / 2,
        width,
        height: BAR_H,
        fromAssignmentId: ab.activityId,
        toAssignmentId: '',
      })
    }
  }

  // Ghost bars for assignments present in the published snapshot but
  // absent from the current data (i.e. the assignment was deleted).
  // Drawn in the snapshot crew's row.
  const ghostBars: GhostBarLayout[] = []
  if (diffOn && input.publishedSnapshotAssignments) {
    for (const snap of input.publishedSnapshotAssignments) {
      if (currentAssignmentIds.has(snap.assignmentId)) continue
      const row = rowByCrew.get(snap.crewId)
      if (!row) continue
      const pairing = pairingById.get(snap.pairingId)
      const startMs = new Date(snap.startUtcIso).getTime()
      const endMs = new Date(snap.endUtcIso).getTime()
      const x = ((startMs - periodStartMs) / 3_600_000) * pph
      const w = Math.max(MIN_BAR_WIDTH_PX, ((endMs - startMs) / 3_600_000) * pph)
      ghostBars.push({
        snapshotAssignmentId: snap.assignmentId,
        pairingId: snap.pairingId,
        crewId: snap.crewId,
        x,
        y: row.y + (ROW_H - BAR_H) / 2,
        width: w,
        height: BAR_H,
        label: pairing?.pairingCode ?? snap.pairingId.slice(0, 6),
      })
    }
  }

  return {
    rows,
    bars,
    activityBars,
    restStrips,
    ghostBars,
    totalWidth,
    totalHeight: rows.length * ROW_H,
    periodStartMs,
    periodDays,
    pph,
    rowH: ROW_H,
    barH: BAR_H,
  }
}

function computeBarLabel(p: PairingRef, mode: BarLabelMode): string {
  if (!p.legs.length) return p.pairingCode
  if (mode === 'pairing') return p.pairingCode
  if (mode === 'sector') {
    const first = p.legs[0]
    const last = p.legs[p.legs.length - 1]
    return `${first.depStation}→${last.arrStation}`
  }
  const first = p.legs[0]
  const suffix = p.legs.length > 1 ? ` +${p.legs.length - 1}` : ''
  return `${first.flightNumber}${suffix}`
}
