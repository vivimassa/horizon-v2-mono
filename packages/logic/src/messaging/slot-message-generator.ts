/**
 * IATA SSIM Chapter 6 Slot Message Generator
 *
 * Generates SCR, SHL, and SMA outbound messages from slot series data.
 * Output is compatible with the parser in slot-message-parser.ts.
 */

// TODO: Replace @/components/network/slots/slot-types — define AirlineActionCode locally
export type AirlineActionCode = 'N' | 'Y' | 'B' | 'V' | 'F' | 'C' | 'M' | 'R' | 'L' | 'I' | 'D' | 'A' | 'P' | 'Z'

// ── Types ──

export interface SCRParams {
  operatorCode: string
  seasonCode: string
  airportIata: string
  creatorRef?: string
  series: SlotSeriesForMessage[]
  supplementaryInfo?: string[]
  generalInfo?: string[]
}

export interface SlotSeriesForMessage {
  actionCode: AirlineActionCode
  arrivalFlightNumber?: string
  departureFlightNumber?: string
  arrivalOrigin?: string
  departureDestination?: string
  arrivalTime?: number
  departureTime?: number
  overnightIndicator?: number
  periodStart: string // ISO date
  periodEnd: string
  daysOfOperation: string
  seats: number
  aircraftType: string // 3-char
  arrivalServiceType?: string
  departureServiceType?: string
  flexibilityArrival?: string
  flexibilityDeparture?: string
  minTurnaround?: number
  changeFrom?: Omit<SlotSeriesForMessage, 'actionCode' | 'changeFrom'>
}

// ── Constants ──

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

// ── Generators ──

export function generateSCR(params: SCRParams): string {
  return generateMessage('SCR', params)
}

export function generateSHL(params: SCRParams): string {
  return generateMessage('SHL', params)
}

export function generateSMA(params: SCRParams): string {
  return generateMessage('SMA', params)
}

function generateMessage(smi: string, params: SCRParams): string {
  const lines: string[] = []

  // Header
  lines.push(smi)
  if (params.creatorRef) {
    lines.push(`/${params.creatorRef}`)
  }
  lines.push(params.seasonCode)
  lines.push(formatDDMMM(new Date().toISOString().split('T')[0]))
  lines.push(params.airportIata)

  // Data lines
  for (const s of params.series) {
    // For C/R pairs, output the C-line first (changeFrom), then the replacement
    if (s.changeFrom && (s.actionCode === 'R' || s.actionCode === 'L' || s.actionCode === 'I')) {
      lines.push(formatDataLine('C', s.changeFrom))
      applySupplementaryLabels(lines, s.changeFrom)
    }

    lines.push(formatDataLine(s.actionCode, s))
    applySupplementaryLabels(lines, s)
  }

  // Footer
  if (params.supplementaryInfo) {
    for (const si of params.supplementaryInfo) {
      lines.push(`SI ${si}`)
    }
  }
  if (params.generalInfo) {
    for (const gi of params.generalInfo) {
      lines.push(`GI ${gi}`)
    }
  }

  return lines.join('\n')
}

function formatDataLine(actionCode: string, s: Omit<SlotSeriesForMessage, 'actionCode' | 'changeFrom'>): string {
  const parts: string[] = []

  const isTurnaround = !!s.arrivalFlightNumber && !!s.departureFlightNumber
  const isDepartureOnly = !s.arrivalFlightNumber && !!s.departureFlightNumber

  if (isDepartureOnly) {
    // Departure-only: space between action code and flight
    parts.push(`${actionCode} ${s.departureFlightNumber}`)
  } else if (isTurnaround) {
    // Turnaround: action code + arrival flight (no space), then dep flight
    parts.push(`${actionCode}${s.arrivalFlightNumber}`)
    parts.push(s.departureFlightNumber!)
  } else {
    // Arrival-only: action code + flight (no space)
    parts.push(`${actionCode}${s.arrivalFlightNumber || ''}`)
  }

  // Period: DDMMMDDMMM
  parts.push(`${formatDDMMM(s.periodStart)}${formatDDMMM(s.periodEnd)}`)

  // DOW
  parts.push(s.daysOfOperation.substring(0, 7))

  // Seats(3) + ACType(3)
  const seatsStr = String(s.seats).padStart(3, '0')
  const acType = (s.aircraftType || '???').substring(0, 3).padEnd(3, ' ').replace(/ /g, '0')
  parts.push(`${seatsStr}${acType}`)

  // Origin + ArrivalTime
  if (s.arrivalOrigin && s.arrivalTime !== undefined && s.arrivalTime !== null) {
    parts.push(`${s.arrivalOrigin}${formatSlotTime(s.arrivalTime)}`)
  }

  // DepTime + optional overnight + destination
  if (s.departureTime !== undefined && s.departureTime !== null) {
    let depPart = formatSlotTime(s.departureTime)
    if (s.overnightIndicator && s.overnightIndicator > 0) {
      depPart += String(s.overnightIndicator)
    }
    if (s.departureDestination) {
      depPart += s.departureDestination
    }
    parts.push(depPart)
  }

  // Service types
  const arrSvc = s.arrivalServiceType || 'J'
  const depSvc = s.departureServiceType || 'J'
  parts.push(`${arrSvc}${depSvc}`)

  return parts.join(' ')
}

function applySupplementaryLabels(lines: string[], s: Omit<SlotSeriesForMessage, 'actionCode' | 'changeFrom'>) {
  const labels: string[] = []
  if (s.flexibilityArrival) labels.push(`FA.${s.flexibilityArrival}`)
  if (s.flexibilityDeparture) labels.push(`FD.${s.flexibilityDeparture}`)
  if (s.minTurnaround) labels.push(`MT.${String(s.minTurnaround).padStart(3, '0')}`)

  if (labels.length > 0) {
    lines.push(`/ ${labels.join(' ')}/`)
  }
}

// ── Format Helpers ──

export function formatDDMMM(isoDate: string): string {
  if (!isoDate) return ''
  const d = new Date(isoDate)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = MONTH_NAMES[d.getUTCMonth()]
  return `${day}${month}`
}

export function formatSlotTime(hhmm: number): string {
  const h = Math.floor(hhmm / 100)
  const m = hhmm % 100
  return `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`
}
