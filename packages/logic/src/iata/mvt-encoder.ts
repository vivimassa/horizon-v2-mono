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
  // DL
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

  // ─── Delay line (DL) ──────────────────────────────────────────
  if (input.delays && input.delays.length > 0) {
    if (input.delays.length === 1) {
      const d = input.delays[0]
      let dl = `DL${d.code}`
      if (d.duration) dl += `/${d.duration}`
      lines.push(dl)
    } else if (input.delays.length === 2) {
      const [d1, d2] = input.delays
      if (d1.duration && d2.duration) {
        lines.push(`DL${d1.code}/${d2.code}/${d1.duration}/${d2.duration}`)
      } else {
        lines.push(`DL${d1.code}/${d2.code}`)
      }
    } else {
      // More than 2 — encode first two, rest in SI
      const [d1, d2, ...rest] = input.delays
      if (d1.duration && d2.duration) {
        lines.push(`DL${d1.code}/${d2.code}/${d1.duration}/${d2.duration}`)
      } else {
        lines.push(`DL${d1.code}/${d2.code}`)
      }
      for (const d of rest) {
        const si = d.duration ? `SI ADDL DELAY ${d.code}/${d.duration}` : `SI ADDL DELAY ${d.code}`
        lines.push(si)
      }
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
