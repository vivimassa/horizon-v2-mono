import type { ParsedLdm, LdmFlightId, LdmDestinationBlock, LdmSupplementary, LdmCompartmentLoad } from './types'

/**
 * Parse an IATA AHM 583 LDM (Load Distribution Message) from raw telex text.
 */
export function parseLdmMessage(raw: string): ParsedLdm | null {
  if (!raw) return null

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  // Find LDM identifier line
  let bodyStart = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toUpperCase() === 'LDM') {
      bodyStart = i + 1
      break
    }
  }

  if (bodyStart >= lines.length) return null

  const bodyLines = lines.slice(bodyStart).filter((l) => l !== '=')

  // Parse flight ID line
  const flightId = parseLdmFlightId(bodyLines[0])
  if (!flightId) return null

  const result: ParsedLdm = {
    messageType: 'LDM',
    flightId,
    destinations: [],
    supplementary: { raw: [] },
    rawLines: lines,
  }

  let currentDest: LdmDestinationBlock | null = null

  for (let i = 1; i < bodyLines.length; i++) {
    const line = bodyLines[i]
    const upper = line.toUpperCase()

    if (line.startsWith('-')) {
      // New destination block
      if (currentDest) result.destinations.push(currentDest)
      currentDest = parseDestinationLine1(line)
    } else if (upper.startsWith('SI') || upper.startsWith('SI ')) {
      result.supplementary.raw.push(line.slice(2).trim())
      parseSILine(line.slice(2).trim(), result.supplementary)
    } else if (upper.startsWith('.') || upper.includes('PAX/') || upper.includes('PAD/')) {
      // Destination line 2 — load summary
      if (currentDest) parseLoadSummary(line, currentDest)
    } else if (upper.includes('AVI/') || upper.includes('HUM/') || upper.includes('DGR/')) {
      // Special loads
      if (currentDest) currentDest.specialLoads.push(line)
    } else if (upper.startsWith('PAX')) {
      // Some LDMs have PAX on its own line
      if (currentDest) parseLoadSummary(line, currentDest)
    } else if (currentDest) {
      // Continuation lines — might be part of SI or load summary
      if (result.supplementary.raw.length > 0) {
        // Append to SI if we already started SI
        result.supplementary.raw.push(line)
      }
    }
  }

  if (currentDest) result.destinations.push(currentDest)

  return result
}

// ─── Flight ID line ──────────────────────────────────────────────

function parseLdmFlightId(line: string): LdmFlightId | null {
  if (!line) return null

  // Format: MS829/30.SUGBZ.F16Y129.2/5
  // or: VY5172/04.ECHQI.A320P.Y180.2/05
  const parts = line.split('.')
  if (parts.length < 2) return null

  // First part: airline+flight/day
  const flightMatch = parts[0].match(/^([A-Z]{2})(\d{1,4}[A-Z]?)\/(\d{2})$/i)
  if (!flightMatch) return null

  const result: LdmFlightId = {
    airline: flightMatch[1].toUpperCase(),
    flightNumber: flightMatch[2],
    dayOfMonth: flightMatch[3],
    registration: parts[1]?.toUpperCase() || '',
  }

  // Remaining dot-separated fields
  for (let i = 2; i < parts.length; i++) {
    const field = parts[i]
    if (/^\d+\/\d+$/.test(field)) {
      // Crew config: 2/5
      result.crewConfig = field
    } else if (/^[A-Z]\d+/.test(field) && /^[FJCWY]/.test(field)) {
      // Cabin config: F16Y129
      result.cabinConfig = field
    } else if (/^[A-Z]\d{3}[A-Z]?$/.test(field)) {
      // Aircraft type: A320, A320P, B738
      result.aircraftType = field
    } else if (/^[FJCWY]\d+/.test(field)) {
      result.cabinConfig = field
    }
  }

  return result
}

// ─── Destination line 1 ──────────────────────────────────────────

function parseDestinationLine1(line: string): LdmDestinationBlock {
  const dest: LdmDestinationBlock = {
    station: '',
    compartments: [],
    specialLoads: [],
  }

  // Remove leading dash
  const content = line.slice(1)
  const parts = content.split('.')

  if (parts.length === 0) return dest

  // First part: station code
  dest.station = parts[0].toUpperCase()

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]

    if (part.startsWith('T')) {
      // Total hold weight: T9335
      dest.totalHoldWeight = parseInt(part.slice(1)) || 0
    } else if (/^\d+\/\d+$/.test(part)) {
      // Could be compartment/weight OR pax breakdown
      const [a, b] = part.split('/').map(Number)
      if (a <= 9 && b > a) {
        // Compartment: 1/2185
        dest.compartments.push({ compartment: a, weight: b })
      } else {
        // Pax breakdown component — store raw
        if (!dest.paxBreakdown) dest.paxBreakdown = part
        else dest.paxBreakdown += '/' + part
      }
    } else if (/^\d+\/\d+\/\d+/.test(part)) {
      // Multi-field: could be pax M/F/C/I
      dest.paxBreakdown = part
    } else if (/^\d+$/.test(part)) {
      // Standalone number — probably continuation
    }
  }

  return dest
}

// ─── Load summary line ───────────────────────────────────────────

function parseLoadSummary(line: string, dest: LdmDestinationBlock) {
  const upper = line.toUpperCase().replace(/^\./, '')

  // PAX/16/94
  const paxMatch = upper.match(/PAX\/([\d/]+)/)
  if (paxMatch) {
    const counts = paxMatch[1].split('/').map(Number)
    if (!dest.pax) dest.pax = { revenue: counts, nonRevenue: [] }
    else dest.pax.revenue = counts
  }

  // PAD/0/0
  const padMatch = upper.match(/PAD\/([\d/]+)/)
  if (padMatch) {
    const counts = padMatch[1].split('/').map(Number)
    if (!dest.pax) dest.pax = { revenue: [], nonRevenue: counts }
    else dest.pax.nonRevenue = counts
  }

  // B138/1794 (baggage pieces/weight)
  const bagMatch = upper.match(/B(\d+)\/(\d+)/)
  if (bagMatch) {
    dest.baggage = { pieces: parseInt(bagMatch[1]), weight: parseInt(bagMatch[2]) }
  }

  // C1450 (cargo weight)
  const cargoMatch = upper.match(/(?:^|[.\s])C(\d+)/)
  if (cargoMatch) {
    dest.cargoWeight = parseInt(cargoMatch[1])
  }

  // M0 (mail weight)
  const mailMatch = upper.match(/(?:^|[.\s])M(\d+)/)
  if (mailMatch) {
    dest.mailWeight = parseInt(mailMatch[1])
  }

  // E0 (equipment weight)
  const eqMatch = upper.match(/(?:^|[.\s])E(\d+)/)
  if (eqMatch) {
    dest.equipmentWeight = parseInt(eqMatch[1])
  }
}

// ─── SI line parsing ─────────────────────────────────────────────

function parseSILine(line: string, si: LdmSupplementary) {
  const upper = line.toUpperCase()

  const dowMatch = upper.match(/DOW\s+(\d+)/)
  if (dowMatch) si.dow = parseInt(dowMatch[1])

  const zfwMatch = upper.match(/ZFW\s+(\d+)/)
  if (zfwMatch) si.zfw = parseInt(zfwMatch[1])

  const towMatch = upper.match(/TOW\s+(\d+)/)
  if (towMatch) si.tow = parseInt(towMatch[1])

  const tofMatch = upper.match(/TOF\s+(\d+)/)
  if (tofMatch) si.tof = parseInt(tofMatch[1])

  const lawMatch = upper.match(/LAW\s+(\d+)/)
  if (lawMatch) si.law = parseInt(lawMatch[1])

  const sobMatch = upper.match(/TTL\s+SOB\s+(\d+)/)
  if (sobMatch) si.totalSob = parseInt(sobMatch[1])
}

// ─── Utilities ───────────────────────────────────────────────────

export function parseCabinConfig(config: string): Array<{ cls: string; seats: number }> {
  const result: Array<{ cls: string; seats: number }> = []
  const pattern = /([FJCWY])(\d+)/g
  let match
  while ((match = pattern.exec(config)) !== null) {
    result.push({ cls: match[1], seats: parseInt(match[2]) })
  }
  return result
}

export function formatWeight(kg: number | undefined): string {
  if (kg === undefined || kg === null) return '—'
  return `${kg.toLocaleString()} kg`
}
