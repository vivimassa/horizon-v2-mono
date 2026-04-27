// Canonical ScheduleDuty builder. Single source of truth for converting
// (assignments + activities + pairings) → ScheduleDuty[]. Used by:
//   • client drop-legality (drag-time roster check)
//   • client violations (assign-time override check)
//   • server evaluate-crew-roster (nightly sweep + on-demand)
//   • auto-assign solver (future)
//
// Deliberately structural: takes only the fields the validator needs,
// accepts any shape as long as those fields are present. Callers adapt
// their domain shapes via the minimal interfaces exported here.

import type { ScheduleDuty } from './crew-schedule-validator-types'
import { categorizeActivityFlags } from './activity-category'

export interface AssignmentLike {
  _id: string
  crewId: string
  pairingId: string
  seatPositionId?: string
  startUtcIso: string
  endUtcIso: string
  status: string
  /** True when this assignment was accepted under commander discretion
   *  (override dialog ack + server-persisted audit row). */
  commanderDiscretion?: boolean
}

export interface PairingLike {
  _id: string
  pairingCode?: string | null
  totalDutyMinutes?: number | null
  totalBlockMinutes?: number | null
  complementKey?: string | null
  legs?: Array<{ depStation?: string | null; arrStation?: string | null; stdUtcIso?: string; staUtcIso?: string }>
}

export interface ActivityLike {
  _id: string
  crewId: string
  startUtcIso: string
  endUtcIso: string
  /** Foreign key to ActivityCode. Required to look up flags via
   *  `activityCodesById`. When absent (or no entry in the map), the
   *  activity defaults to `kind: 'rest'` — opt-in safety, since an
   *  unclassified activity must not silently inflate duty counters. */
  activityCodeId?: string | null
}

export interface ActivityCodeMeta {
  flags: string[]
}

/** Crew flight booking — used by the FDTL evaluator to add duty time for
 *  positioning legs that are not attached to a pairing assignment.
 *
 *  Behaviour:
 *  - `purpose='temp-base-positioning'` rows emit a `kind:'activity'` duty
 *    with `dutyMinutes = window length`, `fdpMinutes = 0`, `blockMinutes = 0`.
 *    Positioning is duty time but never FDP (deadheading rule under all
 *    common regulators — CAAV VAR 15, EASA ORO.FTL, FAA Part 117).
 *  - `purpose='pairing-deadhead'` rows are SKIPPED here; they're already
 *    represented by the parent pairing's assignment, so emitting them would
 *    double-count duty hours.
 *  - `status='cancelled'` rows are skipped. */
export interface BookingLike {
  _id: string
  crewIds?: string[]
  status: string
  purpose?: string | null
  flightDate?: string | null
  stdUtcMs?: number | null
  staUtcMs?: number | null
}

export interface BuildScheduleDutiesInput {
  crewId: string
  assignments: AssignmentLike[]
  activities: ActivityLike[]
  pairingsById: Map<string, PairingLike>
  /** Activity-code metadata (flags) keyed by activityCodeId. When omitted
   *  or missing entries, all unclassified activities are treated as `rest`
   *  to avoid the AL-counts-as-168h-duty class of false-positive. */
  activityCodesById?: Map<string, ActivityCodeMeta>
  /** Crew flight bookings (positioning legs). Optional — callers that
   *  don't load bookings get pre-FDTL-aware behaviour. */
  bookings?: BookingLike[]
}

export function buildScheduleDuties(input: BuildScheduleDutiesInput): ScheduleDuty[] {
  const out: ScheduleDuty[] = []
  for (const a of input.assignments) {
    if (a.crewId !== input.crewId) continue
    if (a.status === 'cancelled') continue
    const p = input.pairingsById.get(a.pairingId)
    const startMs = new Date(a.startUtcIso).getTime()
    const endMs = new Date(a.endUtcIso).getTime()
    const legs = p?.legs ?? []
    const firstLeg = legs[0]
    const lastLeg = legs[legs.length - 1]
    out.push({
      id: a._id,
      kind: 'pairing',
      startUtcMs: startMs,
      endUtcMs: endMs,
      dutyMinutes: p?.totalDutyMinutes ?? Math.max(0, (endMs - startMs) / 60_000),
      blockMinutes: p?.totalBlockMinutes ?? 0,
      fdpMinutes: p?.totalDutyMinutes ?? 0,
      landings: legs.length,
      departureStation: firstLeg?.depStation ?? null,
      arrivalStation: lastLeg?.arrStation ?? null,
      isAugmented: p?.complementKey === 'aug1' || p?.complementKey === 'aug2',
      label: p?.pairingCode ?? 'pairing',
      commanderDiscretion: a.commanderDiscretion === true,
    })
  }
  // Group contiguous same-code activities (touching within ≤ 5 min) into
  // a single ScheduleDuty. Without this, a 7-day Annual Leave assignment
  // — stored as 7 daily rows with a 1-min seam between days — looks to
  // the rest evaluator like 7 separate "duty" blocks with 0:01 gaps.
  const crewActs = input.activities
    .filter((a) => a.crewId === input.crewId)
    .map((a) => {
      const s = new Date(a.startUtcIso).getTime()
      const e = new Date(a.endUtcIso).getTime()
      return { ...a, startMs: s, endMs: e }
    })
    .filter((a) => Number.isFinite(a.startMs) && Number.isFinite(a.endMs))
    .sort((a, b) => a.startMs - b.startMs)

  type Coalesced = { ids: string[]; codeId: string | null; startMs: number; endMs: number }
  const coalesced: Coalesced[] = []
  const SEAM_MS = 5 * 60_000
  for (const a of crewActs) {
    const codeId = a.activityCodeId ?? null
    const last = coalesced[coalesced.length - 1]
    if (last && last.codeId === codeId && a.startMs - last.endMs <= SEAM_MS) {
      last.endMs = Math.max(last.endMs, a.endMs)
      last.ids.push(a._id)
    } else {
      coalesced.push({ ids: [a._id], codeId, startMs: a.startMs, endMs: a.endMs })
    }
  }

  for (const c of coalesced) {
    const durMin = Math.max(0, (c.endMs - c.startMs) / 60_000)
    const meta = c.codeId ? input.activityCodesById?.get(c.codeId) : undefined
    // Default to 'rest' when the code isn't classified — duty inflation
    // (the AL = 168h-duty bug) is the worse failure mode than under-counting.
    const cat = meta
      ? categorizeActivityFlags(meta.flags)
      : { category: 'rest' as const, countsDuty: false, countsBlock: false, countsFdp: false }
    out.push({
      id: c.ids[0],
      kind: cat.category === 'rest' ? 'rest' : 'activity',
      startUtcMs: c.startMs,
      endUtcMs: c.endMs,
      dutyMinutes: cat.category === 'duty' && cat.countsDuty ? durMin : 0,
      blockMinutes: cat.category === 'duty' && cat.countsBlock ? durMin : 0,
      fdpMinutes: cat.category === 'duty' && cat.countsFdp ? durMin : 0,
      landings: 0,
      departureStation: null,
      arrivalStation: null,
      isAugmented: false,
      label: cat.category === 'rest' ? 'rest' : 'activity',
    })
  }

  // Crew flight bookings — positioning legs as duty (no FDP). See the
  // BookingLike doc-comment for the kept/skipped rules.
  for (const b of input.bookings ?? []) {
    if (b.status === 'cancelled') continue
    if (b.purpose !== 'temp-base-positioning') continue
    if (!b.crewIds || !b.crewIds.includes(input.crewId)) continue
    const window = bookingDutyWindowMs(b)
    if (!window) continue
    const dutyMin = Math.max(0, (window.endMs - window.startMs) / 60_000)
    out.push({
      id: b._id,
      kind: 'activity',
      startUtcMs: window.startMs,
      endUtcMs: window.endMs,
      // Positioning counts toward duty + cumulative limits, never FDP.
      // Block time is zero — no flying, just sitting in the cabin.
      dutyMinutes: dutyMin,
      blockMinutes: 0,
      fdpMinutes: 0,
      landings: 0,
      departureStation: null,
      arrivalStation: null,
      isAugmented: false,
      label: 'positioning',
    })
  }
  return out
}

/** Duty-window for a positioning booking. STD/STA when known give a
 *  realistic envelope (report -60min, debrief +30min); otherwise we fall
 *  back to a conservative full-UTC-day window keyed off `flightDate`. */
function bookingDutyWindowMs(b: BookingLike): { startMs: number; endMs: number } | null {
  if (b.stdUtcMs != null && b.staUtcMs != null) {
    const startMs = b.stdUtcMs - 60 * 60_000
    const endMs = b.staUtcMs + 30 * 60_000
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
      return { startMs, endMs }
    }
  }
  if (b.flightDate) {
    const dayStart = new Date(`${b.flightDate}T00:00:00Z`).getTime()
    if (Number.isFinite(dayStart)) {
      return { startMs: dayStart, endMs: dayStart + 86_400_000 - 1 }
    }
  }
  return null
}

/** Build a ScheduleDuty for a candidate pairing not yet assigned.
 *  Mirrors `buildScheduleDuties` for a single pairing + its legs.
 *  Returns null when the pairing has no legs AND no reportTime (cannot
 *  derive duty window). */
export function buildCandidateDuty(
  pairing: PairingLike & {
    reportTime?: string | null
    startDate?: string
  },
): ScheduleDuty | null {
  const legs = pairing.legs ?? []
  const firstLeg = legs[0]
  const lastLeg = legs[legs.length - 1]
  let startMs: number | null = null
  let endMs: number | null = null
  if (pairing.reportTime) {
    startMs = new Date(pairing.reportTime).getTime()
  } else if (firstLeg?.stdUtcIso) {
    startMs = new Date(firstLeg.stdUtcIso).getTime() - 60 * 60_000
  }
  if (lastLeg?.staUtcIso) {
    endMs = new Date(lastLeg.staUtcIso).getTime() + 30 * 60_000
  }
  if (startMs == null || endMs == null) return null
  return {
    id: pairing._id,
    kind: 'pairing',
    startUtcMs: startMs,
    endUtcMs: endMs,
    dutyMinutes: pairing.totalDutyMinutes ?? Math.max(0, (endMs - startMs) / 60_000),
    blockMinutes: pairing.totalBlockMinutes ?? 0,
    fdpMinutes: pairing.totalDutyMinutes ?? 0,
    landings: legs.length,
    departureStation: firstLeg?.depStation ?? null,
    arrivalStation: lastLeg?.arrStation ?? null,
    isAugmented: pairing.complementKey === 'aug1' || pairing.complementKey === 'aug2',
    label: pairing.pairingCode ?? 'candidate',
  }
}
