import type { HotacBooking } from '../types'

/**
 * Generate the body of a rooming-list email pre-filled from a single
 * HotacBooking (or a group sharing the same hotel). The planner can amend
 * the result while the email is held; nothing here is locked once saved.
 */

interface BuildArgs {
  bookings: HotacBooking[]
  signature?: string
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function fmtDate(utcMs: number): string {
  const d = new Date(utcMs)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return '—'
  const d = new Date(ms)
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}z`
}

export function buildRoomingListTemplate({ bookings, signature }: BuildArgs): {
  subject: string
  body: string
} {
  if (bookings.length === 0) {
    return { subject: '', body: '' }
  }
  const first = bookings[0]!
  const hotel = first.hotel
  const station = first.airportIata
  const night = fmtDate(first.layoverNightUtcMs)

  const totalPax = bookings.reduce((s, b) => s + b.pax, 0)
  const totalRooms = bookings.reduce((s, b) => s + b.rooms, 0)

  const lines: string[] = []
  lines.push(`Dear ${hotel?.name ?? 'Hotel'} reservations team,`)
  lines.push('')
  lines.push(`Please find below the rooming list for crew layover at ${station} on ${night}.`)
  lines.push('')

  for (const b of bookings) {
    lines.push(`— Pairing ${b.pairingCode}`)
    lines.push(
      `  Inbound: ${b.arrFlight ?? '—'} ${fmtDateTime(b.arrStaUtcIso)}` +
        ` · Outbound: ${b.depFlight ?? '—'} ${fmtDateTime(b.depStdUtcIso)}`,
    )
    lines.push(`  Rooms: ${b.rooms} (${b.occupancy}) · Pax: ${b.pax}`)
    if (b.crew.length > 0) {
      lines.push(`  Crew:`)
      for (const c of b.crew) {
        lines.push(`    - ${c.name.padEnd(28)} ${c.position}${c.base ? ' · Base ' + c.base : ''}`)
      }
    } else {
      const positions = Object.entries(b.crewByPosition)
        .map(([k, n]) => `${n}× ${k}`)
        .join(', ')
      lines.push(`  Crew: ${positions || '—'}`)
    }
    if (b.notes) lines.push(`  Notes: ${b.notes}`)
    lines.push('')
  }

  lines.push(`Total: ${totalRooms} room(s) · ${totalPax} pax`)
  lines.push(`Special: All single non-smoking unless noted.`)
  if (hotel) {
    lines.push(`Transport: ${hotel.amenities.includes('Shuttle') ? 'Crew shuttle' : 'Walking distance / taxi'}`)
  }
  lines.push('')
  lines.push('Please confirm receipt and reservation numbers at your earliest convenience.')
  lines.push('')
  if (signature) {
    lines.push(signature)
  } else {
    lines.push('SkyHub HOTAC desk')
  }

  const subject = `Rooming list — ${station} ${night} — ${totalRooms} room(s) — ${first.pairingCode}`
  return { subject, body: lines.join('\n') }
}
