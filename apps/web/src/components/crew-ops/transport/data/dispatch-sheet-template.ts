// Build a vendor dispatch-sheet email body from one or more trips.
// Mirrors HOTAC's rooming-list-template — used by right-click → Compose
// and by the toolbar's "Compose Held" action.

import type { TransportTrip } from '../types'

function fmtTime(ms: number): string {
  const d = new Date(ms)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}Z`
}

function fmtDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export interface DispatchSheetSubject {
  subject: string
  body: string
}

/** Build a single dispatch sheet for an array of trips going to the same
 *  vendor. The trips can be on different dates — the sheet groups them by
 *  date for legibility. */
export function buildDispatchSheetTemplate(trips: TransportTrip[]): DispatchSheetSubject {
  if (trips.length === 0) {
    return { subject: 'Dispatch sheet', body: '' }
  }
  const vendorName = trips[0]?.vendor?.name ?? 'Vendor'
  const airport = trips[0]?.airportIcao ?? ''

  const sortedByTime = trips.slice().sort((a, b) => a.scheduledTimeUtcMs - b.scheduledTimeUtcMs)
  const firstDate = fmtDate(sortedByTime[0]!.scheduledTimeUtcMs)
  const lastDate = fmtDate(sortedByTime[sortedByTime.length - 1]!.scheduledTimeUtcMs)
  const dateRange = firstDate === lastDate ? firstDate : `${firstDate} → ${lastDate}`

  const subject = `Crew Transport — ${airport} ${dateRange} (${trips.length} trip${trips.length === 1 ? '' : 's'})`

  const lines: string[] = []
  lines.push(`Dear ${vendorName} team,`)
  lines.push('')
  lines.push(`Please arrange the following crew transport for ${airport} on ${dateRange}:`)
  lines.push('')

  // Group by date
  const byDate = new Map<string, TransportTrip[]>()
  for (const t of sortedByTime) {
    const k = fmtDate(t.scheduledTimeUtcMs)
    const arr = byDate.get(k)
    if (arr) arr.push(t)
    else byDate.set(k, [t])
  }

  for (const [date, group] of byDate) {
    lines.push(`── ${date} ─────────────────────────`)
    for (const t of group) {
      const direction = t.tripType === 'hub-airport' || t.tripType === 'home-airport' ? 'OUTBOUND' : 'INBOUND'
      const tier = t.vendor?.vehicleTierName ? ` · ${t.vendor.vehicleTierName}` : ''
      lines.push('')
      lines.push(
        `[${direction}] ${fmtTime(t.scheduledTimeUtcMs)}  ${t.fromLabel} → ${t.toLabel}${tier}  (${t.paxCount} pax)`,
      )
      if (t.legFlightNumber) lines.push(`  Flight: ${t.legFlightNumber}`)
      for (const stop of t.paxStops) {
        const pos = stop.position ? ` (${stop.position})` : ''
        const addr = stop.pickupAddress ? `  pickup: ${stop.pickupAddress}` : ''
        lines.push(`  • ${stop.crewName}${pos}${addr}`)
      }
    }
    lines.push('')
  }

  lines.push('Please confirm by reply with vehicle plate(s) and driver contact.')
  lines.push('')
  lines.push('Thank you,')
  lines.push('HOTAC')

  return { subject, body: lines.join('\n') }
}
