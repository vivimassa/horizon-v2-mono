// Hard-block date set per crew for auto-roster placements (OFF, SBY, etc.)
// driven by temp-base assignments. A crew on temp-base is operationally
// detached from home base — no home-base activity may be placed during the
// temp-base window OR on the positioning days that bracket it.
//
// Hybrid POS-day rule (per planner direction):
//   1. Days in [tempBase.fromIso, tempBase.toIso] are blocked (the TEMP block).
//   2. Synthesise (fromIso − 1) and (toIso + 1) as POS days regardless of
//      whether positioning has been booked. These exist so manpower projection
//      reflects the shortage even before positioning flights are scheduled.
//   3. Any actual `temp-base-positioning` flight booking dates are also
//      blocked. When a synthesised day coincides with a real positioning
//      booking, the Set deduplicates — no double-counting.

const MS_PER_DAY = 86_400_000

export type TempBaseRef = {
  crewId: string
  fromIso: string // YYYY-MM-DD
  toIso: string // YYYY-MM-DD
}

export type PositioningBookingRef = {
  crewIds: string[]
  flightDate: string | null // YYYY-MM-DD
  purpose: string | null
}

/** Step a YYYY-MM-DD date string forward (delta=+1) or backward (delta=−1). */
function shiftIsoDate(dateIso: string, delta: number): string {
  const t = Date.UTC(Number(dateIso.slice(0, 4)), Number(dateIso.slice(5, 7)) - 1, Number(dateIso.slice(8, 10)))
  return new Date(t + delta * MS_PER_DAY).toISOString().slice(0, 10)
}

/** Inclusive enumeration of all YYYY-MM-DD dates in [fromIso, toIso]. */
function enumerateDateRange(fromIso: string, toIso: string): string[] {
  const out: string[] = []
  if (fromIso > toIso) return out
  const startMs = Date.UTC(Number(fromIso.slice(0, 4)), Number(fromIso.slice(5, 7)) - 1, Number(fromIso.slice(8, 10)))
  const endMs = Date.UTC(Number(toIso.slice(0, 4)), Number(toIso.slice(5, 7)) - 1, Number(toIso.slice(8, 10)))
  for (let ms = startMs; ms <= endMs; ms += MS_PER_DAY) {
    out.push(new Date(ms).toISOString().slice(0, 10))
  }
  return out
}

/**
 * Compute the per-crew set of dates that must remain unassigned because the
 * crew is on temp-base or transiting to/from it. Returns one Set<dateIso>
 * per crew that has a temp-base or positioning booking; absent crew = empty.
 */
export function buildTempBlockedDates(
  tempBases: TempBaseRef[],
  posBookings: PositioningBookingRef[],
): Map<string, Set<string>> {
  const blocked = new Map<string, Set<string>>()
  const add = (crewId: string, day: string) => {
    let set = blocked.get(crewId)
    if (!set) {
      set = new Set<string>()
      blocked.set(crewId, set)
    }
    set.add(day)
  }

  for (const tb of tempBases) {
    if (!tb.crewId || !tb.fromIso || !tb.toIso) continue
    for (const day of enumerateDateRange(tb.fromIso, tb.toIso)) add(tb.crewId, day)
    add(tb.crewId, shiftIsoDate(tb.fromIso, -1))
    add(tb.crewId, shiftIsoDate(tb.toIso, +1))
  }

  for (const b of posBookings) {
    if (b.purpose !== 'temp-base-positioning') continue
    if (!b.flightDate) continue
    for (const cid of b.crewIds ?? []) add(cid, b.flightDate)
  }

  return blocked
}

/** Convenience: count crew blocked on a given day. */
export function countCrewBlockedOnDay(blocked: Map<string, Set<string>>, dayIso: string): number {
  let n = 0
  for (const set of blocked.values()) if (set.has(dayIso)) n++
  return n
}
