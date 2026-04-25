// Compares two snapshots of bookings (previous fetch → current fetch) and
// emits disruption events when flight changes affect a hotel night.
//
// Phase 1 is intentionally simple — Phase 2 hooks in real flight-instance
// status changes (delays, cancellations) from the FlightInstance API.

import type { HotacBooking, HotacDisruption } from '../types'

const HOURS_MS = 3_600_000

interface DetectInput {
  /** Bookings as they were on the previous tick. */
  prev: HotacBooking[]
  /** Bookings on the current tick. */
  next: HotacBooking[]
  detectedAtUtcMs?: number
}

export function detectDisruptions({ prev, next, detectedAtUtcMs = Date.now() }: DetectInput): {
  disruptions: HotacDisruption[]
  updated: HotacBooking[]
} {
  const prevById = new Map(prev.map((b) => [b.id, b]))
  const disruptions: HotacDisruption[] = []
  const updated: HotacBooking[] = []

  for (const cur of next) {
    const before = prevById.get(cur.id)
    const flags = new Set(cur.disruptionFlags)

    if (before) {
      // Inbound STA shifted by > 4 hours
      if (cur.arrStaUtcIso && before.arrStaUtcIso) {
        const delta = Math.abs(Date.parse(cur.arrStaUtcIso) - Date.parse(before.arrStaUtcIso))
        if (delta > 4 * HOURS_MS) {
          flags.add('inbound-delayed')
          disruptions.push({
            bookingId: cur.id,
            flag: 'inbound-delayed',
            detail: `Inbound ${cur.arrFlight ?? ''} STA shifted ${(delta / HOURS_MS).toFixed(1)}h`,
            detectedAtUtcMs,
          })
        }
      }

      // Outbound STD shifted by > 4 hours
      if (cur.depStdUtcIso && before.depStdUtcIso) {
        const delta = Math.abs(Date.parse(cur.depStdUtcIso) - Date.parse(before.depStdUtcIso))
        if (delta > 4 * HOURS_MS) {
          flags.add('outbound-delayed')
          disruptions.push({
            bookingId: cur.id,
            flag: 'outbound-delayed',
            detail: `Outbound ${cur.depFlight ?? ''} STD shifted ${(delta / HOURS_MS).toFixed(1)}h`,
            detectedAtUtcMs,
          })
        }
      }

      // Layover hours grew significantly — flag as extend-night candidate
      if (cur.layoverHours - before.layoverHours > 12) {
        flags.add('extend-night')
        disruptions.push({
          bookingId: cur.id,
          flag: 'extend-night',
          detail: `Layover extended by ${(cur.layoverHours - before.layoverHours).toFixed(1)}h — additional night(s) likely`,
          detectedAtUtcMs,
        })
      }
    }

    // Confirmation overdue — sent > 2h ago without a confirmation number
    // (Phase 2 wires real send timestamps; this is best-effort here.)
    if (cur.status === 'sent' && !cur.confirmationNumber) {
      // No prior data to compute SLA in Phase 1 — skip.
    }

    if (flags.size > cur.disruptionFlags.length) {
      updated.push({ ...cur, disruptionFlags: Array.from(flags) })
    } else {
      updated.push(cur)
    }
  }

  // Bookings that disappeared between snapshots → cancelled
  const nextIds = new Set(next.map((b) => b.id))
  for (const before of prev) {
    if (!nextIds.has(before.id)) {
      disruptions.push({
        bookingId: before.id,
        flag: 'inbound-cancelled',
        detail: `Pairing ${before.pairingCode} layover at ${before.airportIata} no longer in plan`,
        detectedAtUtcMs,
      })
    }
  }

  return { disruptions, updated }
}
