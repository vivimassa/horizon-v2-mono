/**
 * Compute the UTC instants that bound a calendar day in the *local time* of
 * a base airport.
 *
 * Day-anchored activities (OFF, REST, AL, SICK, MEDICAL) are operationally
 * "the crew is unavailable for calendar day D in their base local time".
 * Storing them as UTC midnight → UTC midnight only happens to be correct
 * for UTC+0 bases. For SGN (UTC+7) crew on Apr 15:
 *   - WRONG: 2026-04-15T00:00Z → 2026-04-15T23:59Z  (= 07:00 SGN to 06:59 next day SGN)
 *   - RIGHT: 2026-04-14T17:00Z → 2026-04-15T16:59Z  (= 00:00 SGN to 23:59 SGN)
 *
 * Without this fix, a flight scheduled 03:00 SGN local on the OFF day
 * (= 20:00 UTC previous day) falls OUTSIDE the stored UTC window and the
 * solver's interval-overlap check would happily place crew on it.
 *
 * Limitation: uses a fixed UTC offset (utcOffsetHours), not IANA TZ. DST
 * transition days will be off by 1h for crew based in DST-affected regions.
 * Most Asian operators (VN/TH/SG/MY/ID/PH) have no DST so this is moot.
 * To handle DST cleanly, switch to ianaTimezone + Intl.DateTimeFormat.
 */
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export function localDayWindowUtc(
  utcOffsetHours: number | null | undefined,
  dateIso: string,
): { startUtcIso: string; endUtcIso: string; startUtcMs: number; endUtcMs: number } {
  const offsetMs = (utcOffsetHours ?? 0) * 3_600_000
  // Local 00:00 expressed in UTC = UTC midnight of the same calendar date
  // shifted back by the base's offset.
  const dayMidnightUtcMs = Date.parse(`${dateIso}T00:00:00.000Z`)
  const startUtcMs = dayMidnightUtcMs - offsetMs
  const endUtcMs = startUtcMs + ONE_DAY_MS - 1
  return {
    startUtcIso: new Date(startUtcMs).toISOString(),
    endUtcIso: new Date(endUtcMs).toISOString(),
    startUtcMs,
    endUtcMs,
  }
}
