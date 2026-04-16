import type { ParsedMvt } from '@skyhub/logic/src/iata/types'
import { DelayCode } from '../models/DelayCode.js'

export interface AppliedDelta {
  set: Record<string, number | null>
  pushDelays: Array<{ code: string; minutes: number; reason: string; category: string }>
  summary: string
  delaysAppended: number
}

export interface ApplyFlightRef {
  operatingDate: string
  schedule?: { stdUtc?: number | null; staUtc?: number | null } | null
  delays: Array<{ code: string; minutes: number }>
}

export interface ApplyOptions {
  operatorId: string
  parsed: ParsedMvt
  flight: ApplyFlightRef
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

export async function buildMvtApplyDelta({ operatorId, parsed, flight }: ApplyOptions): Promise<AppliedDelta> {
  const base = toUtcMsBase(flight.operatingDate)
  const refMs = flight.schedule?.stdUtc ?? base

  const resolveTime = (t: string | undefined): number | null => {
    if (!t) return null
    return mvtTimeToUtcMs(t, base, refMs)
  }

  const set: Record<string, number | null> = {}
  const parts: string[] = []

  switch (parsed.actionCode) {
    case 'AD': {
      const atd = resolveTime(parsed.offBlocks)
      if (atd != null) {
        set['actual.atdUtc'] = atd
        parts.push(`ATD ${fmt(parsed.offBlocks)}`)
      }
      const off = resolveTime(parsed.airborne)
      if (off != null) {
        set['actual.offUtc'] = off
        parts.push(`OFF ${fmt(parsed.airborne)}`)
      }
      break
    }
    case 'AA': {
      const on = resolveTime(parsed.touchdown)
      if (on != null) {
        set['actual.onUtc'] = on
        parts.push(`ON ${fmt(parsed.touchdown)}`)
      }
      const ata = resolveTime(parsed.onBlocks)
      if (ata != null) {
        set['actual.ataUtc'] = ata
        parts.push(`ATA ${fmt(parsed.onBlocks)}`)
      }
      break
    }
    case 'ED': {
      const etd = resolveTime(parsed.estimatedDeparture)
      if (etd != null) {
        set['estimated.etdUtc'] = etd
        parts.push(`ETD ${fmt(parsed.estimatedDeparture)}`)
      }
      break
    }
    case 'NI': {
      set['estimated.etdUtc'] = null
      parts.push('NI (indefinite delay)')
      break
    }
    case 'RR': {
      const atd = resolveTime(parsed.offBlocks)
      if (atd != null) set['actual.atdUtc'] = atd
      set['actual.offUtc'] = null
      parts.push(`RR at ${fmt(parsed.returnTime ?? parsed.offBlocks)}`)
      break
    }
    case 'FR': {
      const on = resolveTime(parsed.touchdown)
      if (on != null) set['actual.onUtc'] = on
      const ata = resolveTime(parsed.onBlocks)
      if (ata != null) set['actual.ataUtc'] = ata
      parts.push(`FR ${fmt(parsed.touchdown)}`)
      break
    }
    case 'EA': {
      const eta = parsed.etas[0]?.time
      const etaMs = resolveTime(eta)
      if (etaMs != null) {
        set['estimated.etaUtc'] = etaMs
        parts.push(`ETA ${fmt(eta)}`)
      }
      break
    }
  }

  const pushDelays = await resolveDelays(operatorId, parsed, flight.delays ?? [])
  if (pushDelays.length > 0) {
    const totalMin = pushDelays.reduce((s, d) => s + d.minutes, 0)
    parts.push(`+${pushDelays.length} delay${pushDelays.length === 1 ? '' : 's'} (${totalMin} min)`)
  }

  return {
    set,
    pushDelays,
    summary: parts.length > 0 ? parts.join(', ') : `${parsed.actionCode} applied`,
    delaysAppended: pushDelays.length,
  }
}

async function resolveDelays(
  operatorId: string,
  parsed: ParsedMvt,
  existing: ApplyFlightRef['delays'],
): Promise<Array<{ code: string; minutes: number; reason: string; category: string }>> {
  if (parsed.delays.length === 0) return []

  const codesToFetch = new Set<string>()
  for (const d of parsed.delays) {
    if (d.code) codesToFetch.add(d.code)
  }
  const docs =
    codesToFetch.size > 0 ? await DelayCode.find({ operatorId, code: { $in: Array.from(codesToFetch) } }).lean() : []
  const byCode = new Map(docs.map((doc) => [doc.code, doc]))

  const resolved: Array<{ code: string; minutes: number; reason: string; category: string }> = []
  for (const d of parsed.delays) {
    const minutes = durationToMinutes(d.duration)
    if (minutes <= 0) continue
    const isDup = existing.some((e) => e.code === d.code && Math.abs(e.minutes - minutes) <= 5)
    if (isDup) continue
    const master = byCode.get(d.code)
    resolved.push({
      code: d.code,
      minutes,
      reason: master?.description ?? master?.name ?? '',
      category: master?.category ?? '',
    })
  }
  return resolved
}

export function durationToMinutes(duration: string | undefined): number {
  if (!duration || duration.length < 4) return 0
  const h = parseInt(duration.slice(0, 2), 10)
  const m = parseInt(duration.slice(2, 4), 10)
  if (Number.isNaN(h) || Number.isNaN(m)) return 0
  return h * 60 + m
}

export function mvtTimeToUtcMs(time: string, base: number, refMs: number): number {
  if (time.length === 6) {
    const dd = parseInt(time.slice(0, 2), 10)
    const hh = parseInt(time.slice(2, 4), 10)
    const mm = parseInt(time.slice(4, 6), 10)
    return snapToNearest(refMs, setDdHhMm(base, dd, hh, mm))
  }
  if (time.length === 4) {
    const hh = parseInt(time.slice(0, 2), 10)
    const mm = parseInt(time.slice(2, 4), 10)
    const candidate = base + hh * HOUR + mm * 60 * 1000
    return snapToNearest(refMs, candidate)
  }
  return base
}

function setDdHhMm(base: number, dd: number, hh: number, mm: number): number {
  const d = new Date(base)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), dd, hh, mm, 0)
}

function snapToNearest(refMs: number, candidate: number): number {
  // Shift candidate by ±24h windows until it is within ±12h of refMs
  let best = candidate
  let bestDiff = Math.abs(candidate - refMs)
  for (const delta of [-DAY, DAY, -2 * DAY, 2 * DAY]) {
    const alt = candidate + delta
    const diff = Math.abs(alt - refMs)
    if (diff < bestDiff) {
      best = alt
      bestDiff = diff
    }
  }
  return best
}

function toUtcMsBase(operatingDate: string): number {
  const [y, m, d] = operatingDate.split('-').map((x) => parseInt(x, 10))
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0)
}

function fmt(t: string | undefined): string {
  if (!t) return ''
  if (t.length === 6) return `${t.slice(2, 4)}:${t.slice(4, 6)}z day ${t.slice(0, 2)}`
  if (t.length === 4) return `${t.slice(0, 2)}:${t.slice(2, 4)}z`
  return t
}
