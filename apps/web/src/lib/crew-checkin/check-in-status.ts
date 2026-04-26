/**
 * Check-in status state machine for 4.1.7.1.
 *
 *   pending     — RRT in the future, no check-in yet
 *   checkedIn   — checkInUtcMs ≤ rrt + LATE_THRESHOLD
 *   late        — checkInUtcMs in (rrt+LATE, rrt+VERY_LATE]
 *   veryLate    — checkInUtcMs > rrt+VERY_LATE
 *   awaitingLate     — no check-in yet AND now > rrt+LATE
 *   awaitingVeryLate — no check-in yet AND now > rrt+VERY_LATE
 *   noShow      — no check-in yet AND now > rrt+NO_SHOW
 *   departed    — STD has passed (informational, overrides others when no check-in)
 *
 * Thresholds are SkyHub defaults; future settings drawer will let the
 * operator override them per-tenant.
 */

export const LATE_MIN = 5
export const VERY_LATE_MIN = 20
export const NO_SHOW_MIN = 60

export interface CheckInThresholds {
  lateAfterMinutes: number
  veryLateAfterMinutes: number
  noShowAfterMinutes: number
}

export const DEFAULT_THRESHOLDS: CheckInThresholds = {
  lateAfterMinutes: LATE_MIN,
  veryLateAfterMinutes: VERY_LATE_MIN,
  noShowAfterMinutes: NO_SHOW_MIN,
}

export type CheckInStatus =
  | 'pending'
  | 'checkedIn'
  | 'late'
  | 'veryLate'
  | 'awaitingLate'
  | 'awaitingVeryLate'
  | 'noShow'
  | 'departed'

export interface CheckInStatusInput {
  rrtMs: number | null
  stdMs: number | null
  checkInUtcMs: number | null | undefined
  nowMs: number
  thresholds?: CheckInThresholds
}

export function computeCheckInStatus({
  rrtMs,
  stdMs,
  checkInUtcMs,
  nowMs,
  thresholds = DEFAULT_THRESHOLDS,
}: CheckInStatusInput): CheckInStatus {
  if (rrtMs == null) {
    return checkInUtcMs ? 'checkedIn' : 'pending'
  }

  if (checkInUtcMs != null) {
    const delta = (checkInUtcMs - rrtMs) / 60_000
    if (delta <= thresholds.lateAfterMinutes) return 'checkedIn'
    if (delta <= thresholds.veryLateAfterMinutes) return 'late'
    return 'veryLate'
  }

  const delta = (nowMs - rrtMs) / 60_000
  if (stdMs != null && nowMs > stdMs && delta > thresholds.noShowAfterMinutes) return 'noShow'
  if (stdMs != null && nowMs > stdMs) return 'departed'
  if (delta > thresholds.noShowAfterMinutes) return 'noShow'
  if (delta > thresholds.veryLateAfterMinutes) return 'awaitingVeryLate'
  if (delta > thresholds.lateAfterMinutes) return 'awaitingLate'
  return 'pending'
}

export interface StatusVisuals {
  label: string
  /** Hex color for icon + accent. */
  color: string
  /** Background tint (rgba). */
  bg: string
  /** Lucide icon name. */
  icon: 'CheckCircle2' | 'Hourglass' | 'AlertTriangle' | 'XCircle' | 'Plane' | 'Clock'
}

export function statusVisuals(status: CheckInStatus): StatusVisuals {
  switch (status) {
    case 'checkedIn':
      return { label: 'Checked-In', color: '#06C270', bg: 'rgba(6,194,112,0.12)', icon: 'CheckCircle2' }
    case 'late':
      return { label: 'Late', color: '#FF8800', bg: 'rgba(255,136,0,0.12)', icon: 'Hourglass' }
    case 'awaitingLate':
      return { label: 'Late (no report)', color: '#FF8800', bg: 'rgba(255,136,0,0.12)', icon: 'Hourglass' }
    case 'veryLate':
      return { label: 'Very Late', color: '#FF3B3B', bg: 'rgba(255,59,59,0.14)', icon: 'AlertTriangle' }
    case 'awaitingVeryLate':
      return { label: 'Very Late (no report)', color: '#FF3B3B', bg: 'rgba(255,59,59,0.14)', icon: 'AlertTriangle' }
    case 'noShow':
      return { label: 'No-Show', color: '#FF3B3B', bg: 'rgba(255,59,59,0.18)', icon: 'XCircle' }
    case 'departed':
      return { label: 'Departed', color: '#0063F7', bg: 'rgba(0,99,247,0.12)', icon: 'Plane' }
    case 'pending':
    default:
      return { label: 'Pending', color: '#9A9BA8', bg: 'rgba(154,155,168,0.14)', icon: 'Clock' }
  }
}
