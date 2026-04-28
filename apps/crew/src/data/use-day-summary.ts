import type { RosterDuty } from './use-roster-month'

export interface DaySummary {
  flightCount: number
  blockMinutes: number
  dutyMinutes: number
  activityNames: string[]
}

/**
 * Aggregate a single day's roster duties for the calendar tooltip.
 * Pure function; cheap to compute on tap.
 */
export function summarizeDay(duties: RosterDuty[]): DaySummary {
  const flights = duties.filter((d) => d.kind === 'flight')
  const blockMinutes = flights.reduce((s, d) => s + d.blockMinutes, 0)
  const dutyMinutes = duties.reduce((s, d) => s + Math.max(0, (d.endUtcMs - d.startUtcMs) / 60_000), 0)
  const activityNames = duties.filter((d) => d.kind === 'activity').map((d) => d.title)
  return {
    flightCount: flights.length,
    blockMinutes,
    dutyMinutes: Math.round(dutyMinutes),
    activityNames,
  }
}
