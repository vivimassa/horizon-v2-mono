import type { TypeBEnvelope, MvtFlightId, MvtActionCode, MvtEta, MvtDelay, MvtPassengers } from './types'

/**
 * Encode a structured MVT into IATA AHM 780 standard telex format.
 */

export interface MvtEncodeInput {
  envelope?: TypeBEnvelope
  correction?: boolean
  flightId: {
    airline: string
    flightNumber: string
    dayOfMonth: string
    registration: string
    station: string
  }
  actionCode: MvtActionCode
  // AD fields
  offBlocks?: string // HHMM or DDHHMM
  airborne?: string // HHMM or DDHHMM
  // AA fields
  touchdown?: string // HHMM or DDHHMM
  onBlocks?: string // HHMM or DDHHMM
  // ED fields
  estimatedDeparture?: string // DDHHMM
  // NI fields
  nextInfoTime?: string // DDHHMM
  // RR fields
  returnTime?: string // HHMM or DDHHMM
  // EA entries
  etas?: MvtEta[]
  // DL / DLA — operator standard selects line type
  delayStandard?: 'ahm730' | 'ahm732'
  delays?: MvtDelay[]
  // PX
  passengers?: MvtPassengers
  // SI
  supplementaryInfo?: string[]
}

export function encodeMvtMessage(input: MvtEncodeInput): string {
  const lines: string[] = []

  // ─── Type B envelope (optional) ────────────────────────────────
  if (input.envelope) {
    const env = input.envelope
    const addrLine = [env.priority || 'QU', ...env.addresses].join(' ')
    lines.push(addrLine)

    const origLine = `.${env.originator || 'SYSTEM'} ${env.timestamp || formatCurrentTimestamp()}`
    lines.push(origLine)
  }

  // ─── Message type identifier ───────────────────────────────────
  lines.push(input.correction ? 'COR MVT' : 'MVT')

  // ─── Flight identification line ────────────────────────────────
  const fid = input.flightId
  lines.push(`${fid.airline}${fid.flightNumber}/${fid.dayOfMonth}.${fid.registration}.${fid.station}`)

  // ─── Action code line ──────────────────────────────────────────
  let actionLine = ''

  switch (input.actionCode) {
    case 'AD': {
      actionLine = `AD${input.offBlocks || ''}`
      if (input.airborne) actionLine += `/${input.airborne}`
      if (input.etas && input.etas.length > 0) {
        for (const ea of input.etas) {
          actionLine += ` EA${ea.time}${ea.destination}`
        }
      }
      break
    }
    case 'AA': {
      actionLine = `AA${input.touchdown || ''}`
      if (input.onBlocks) actionLine += `/${input.onBlocks}`
      break
    }
    case 'ED': {
      actionLine = `ED${input.estimatedDeparture || ''}`
      break
    }
    case 'NI': {
      actionLine = `NI${input.nextInfoTime || ''}`
      break
    }
    case 'RR': {
      actionLine = `AD${input.offBlocks || ''}`
      if (input.airborne) actionLine += `/${input.airborne}`
      actionLine += ` RR${input.returnTime || ''}`
      break
    }
    case 'FR': {
      actionLine = `FR${input.touchdown || ''}`
      if (input.onBlocks) actionLine += `/${input.onBlocks}`
      break
    }
    case 'EA': {
      if (input.etas && input.etas.length > 0) {
        const ea = input.etas[0]
        actionLine = `EA${ea.time}${ea.destination}`
      }
      break
    }
  }

  lines.push(actionLine)

  // ─── Delay line (DL / DLA) ────────────────────────────────────
  //
  // IATA AHM 780 allows up to 4 delay entries on one line. Convention:
  //   DL{C1}/{C2}/{C3}/{C4}/{D1}/{D2}/{D3}/{D4}
  // (any duration slot may be empty). If no delay has a duration, emit the
  // codes only. Codes beyond the 4-limit fall through to SI lines.
  if (input.delays && input.delays.length > 0) {
    const standard = input.delayStandard ?? 'ahm730'
    const prefix = standard === 'ahm732' ? 'DLA' : 'DL'
    const normalize = (d: MvtDelay): string => {
      if (standard === 'ahm732' && d.ahm732) {
        return `${d.ahm732.process}${d.ahm732.reason}${d.ahm732.stakeholder}`.toUpperCase()
      }
      return d.code
    }

    const primary = input.delays.slice(0, 4)
    const overflow = input.delays.slice(4)

    const codes = primary.map(normalize)
    const anyDuration = primary.some((d) => d.duration)
    const parts = [...codes]
    if (anyDuration) {
      for (const d of primary) parts.push(d.duration ?? '')
    }
    // Concatenate: DL/DLA prefix sticks to the first code, the rest are slash-joined.
    lines.push(`${prefix}${parts[0]}${parts.length > 1 ? '/' + parts.slice(1).join('/') : ''}`)

    for (const d of overflow) {
      const token = normalize(d)
      lines.push(d.duration ? `SI ADDL DELAY ${token}/${d.duration}` : `SI ADDL DELAY ${token}`)
    }
  }

  // ─── Passenger line (PX) ──────────────────────────────────────
  if (input.passengers) {
    const pax = input.passengers
    let pxLine = `PX${pax.total}`
    if (pax.noSeatHolders && pax.noSeatHolders > 0) {
      pxLine += `+${String(pax.noSeatHolders).padStart(2, '0')}`
    }
    if (pax.sectors && pax.sectors.length > 1) {
      pxLine = `PX${pax.sectors.join('/')}`
      if (pax.noSeatHolders && pax.noSeatHolders > 0) {
        pxLine += `+${String(pax.noSeatHolders).padStart(2, '0')}`
      }
    }
    lines.push(pxLine)
  }

  // ─── Supplementary info (SI) ──────────────────────────────────
  if (input.supplementaryInfo && input.supplementaryInfo.length > 0) {
    for (const si of input.supplementaryInfo) {
      lines.push(`SI ${si}`)
    }
  } else {
    lines.push('SI NIL')
  }

  // ─── End of message ────────────────────────────────────────────
  lines.push('=')

  return lines.join('\n')
}

// ─── Helper: current DDHHMM timestamp ────────────────────────────

function formatCurrentTimestamp(): string {
  const now = new Date()
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const hh = String(now.getUTCHours()).padStart(2, '0')
  const mm = String(now.getUTCMinutes()).padStart(2, '0')
  return dd + hh + mm
}

// ─── Helper: build envelope from common fields ───────────────────

export function buildEnvelope(opts: {
  priority?: 'QU' | 'QK' | 'QD' | 'QX'
  toStations: string[] // 3-letter IATA codes
  toFunction: string // 2-letter function (AP, KP, OW)
  toAirline: string // 2-letter airline designator
  fromStation: string
  fromFunction: string
  fromAirline: string
}): TypeBEnvelope {
  return {
    priority: opts.priority || 'QU',
    addresses: opts.toStations.map((s) => `${s}${opts.toFunction}${opts.toAirline}`),
    originator: `${opts.fromStation}${opts.fromFunction}${opts.fromAirline}`,
    timestamp: formatCurrentTimestamp(),
  }
}
