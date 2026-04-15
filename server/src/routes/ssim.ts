import crypto from 'node:crypto'
import ExcelJS from 'exceljs'
import type { FastifyInstance } from 'fastify'
import { ScheduledFlight } from '../models/ScheduledFlight.js'
import { Operator } from '../models/Operator.js'
import { AircraftType } from '../models/AircraftType.js'
import { LopaConfig } from '../models/LopaConfig.js'
import { parseSsimExcel, type ParsedFlight } from '../utils/ssim-parser.js'
import { generateSsimExcel } from '../utils/ssim-exporter.js'
import { generateSSIM, type SSIMFlightRecord, type SSIMExportOptions } from '@skyhub/logic/src/utils/ssim-generator'

// ── Normalize any of our date-string flavours to ISO YYYY-MM-DD ──────────
// ScheduledFlight rows store effectiveFrom / effectiveUntil inconsistently
// (DD/MM/YYYY in the legacy import path, YYYY-MM-DD in newer writers). We
// can't lexically compare DD/MM/YYYY, so callers normalise both sides with
// this helper before comparing. Returns '' when the input doesn't match a
// known shape, which the caller treats as "exclude from filter result".
function toIsoDate(s: string | null | undefined): string {
  if (!s) return ''
  // Already ISO (allow optional trailing time)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  // DD/MM/YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return ''
}

// ── IANA timezone → ±HHMM offset string ───────────────────────────────────
// Uses the platform Intl API so no extra dependency is needed.
function tzOffsetString(timeZone: string, at: Date): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    const part = fmt.formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00'
    const m = part.match(/GMT([+-])(\d{2}):?(\d{2})/)
    if (!m) return '+0000'
    return `${m[1]}${m[2]}${m[3]}`
  } catch {
    return '+0000'
  }
}

// ── Rotation Grouping ────────────────────────────────────────────────────
// Chain flights into rotation cycles based on station continuity:
// Flight A (SGN→HAN) + Flight B (HAN→SGN) with same DOW/period = one cycle.
// Uses greedy forward chaining from each unvisited flight.

interface FlightDoc {
  _id: string
  flightNumber: string
  depStation: string
  arrStation: string
  daysOfWeek: string
  effectiveFrom: string
  effectiveUntil: string
  aircraftTypeIcao: string
  stdUtc: string
  staUtc: string
  rotationId?: string | null
  rotationSequence?: number | null
  rotationLabel?: string | null
  [key: string]: unknown
}

function assignRotations(docs: FlightDoc[]): void {
  // Index flights by departure station + DOW + period + AC type for fast lookup
  const byDepKey = new Map<string, FlightDoc[]>()
  for (const d of docs) {
    const key = `${d.depStation}|${d.daysOfWeek}|${d.effectiveFrom}|${d.effectiveUntil}|${d.aircraftTypeIcao}`
    const list = byDepKey.get(key) ?? []
    list.push(d)
    byDepKey.set(key, list)
  }

  // Sort each bucket by STD so we pick the earliest available next flight
  for (const list of byDepKey.values()) {
    list.sort((a, b) => a.stdUtc.localeCompare(b.stdUtc))
  }

  const visited = new Set<string>()
  let cycleNum = 0

  // Time comparison: "0800" > "0600" means later in the day
  function parseTime(hhmm: string): number {
    const h = parseInt(hhmm.replace(':', '').slice(0, 2), 10) || 0
    const m = parseInt(hhmm.replace(':', '').slice(2, 4), 10) || 0
    return h * 60 + m
  }

  for (const doc of docs) {
    if (visited.has(doc._id)) continue

    // Start a new chain from this flight
    const chain: FlightDoc[] = [doc]
    visited.add(doc._id)

    let current = doc
    // Follow the chain: find next flight departing from current's arrival station
    // with same DOW/period/AC type, departing after current arrives
    for (let depth = 0; depth < 20; depth++) {
      // safety limit
      const key = `${current.arrStation}|${current.daysOfWeek}|${current.effectiveFrom}|${current.effectiveUntil}|${current.aircraftTypeIcao}`
      const candidates = byDepKey.get(key)
      if (!candidates) break

      const currentSta = parseTime(current.staUtc)
      let next: FlightDoc | null = null
      for (const c of candidates) {
        if (visited.has(c._id)) continue
        // Next flight must depart after current arrives (with reasonable TAT)
        if (parseTime(c.stdUtc) >= currentSta) {
          next = c
          break
        }
      }
      if (!next) break

      chain.push(next)
      visited.add(next._id)
      current = next
    }

    // Only create a rotation if the chain has 2+ flights
    if (chain.length < 2) continue

    cycleNum++
    const rotationId = crypto.randomUUID()
    // Label: "57/58" or "57/58/59" from flight numbers
    const label = chain.map((f) => f.flightNumber).join('/')

    for (let i = 0; i < chain.length; i++) {
      chain[i].rotationId = rotationId
      chain[i].rotationSequence = i + 1
      chain[i].rotationLabel = label
    }
  }
}

export async function ssimRoutes(app: FastifyInstance): Promise<void> {
  // ── Import from Excel ──
  app.post('/ssim/import', async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.code(400).send({ error: 'No file uploaded' })

    const buffer = await data.toBuffer()
    const { flights, errors } = await parseSsimExcel(buffer)

    if (flights.length === 0) {
      return reply.code(400).send({ error: 'No valid flights parsed', errors })
    }

    const { operatorId, seasonCode, scenarioId } = req.query as Record<string, string>
    if (!operatorId || !seasonCode) return reply.code(400).send({ error: 'operatorId and seasonCode required' })

    // Get operator's IATA code as fallback for airline code
    const op = await Operator.findOne({ isActive: true }).lean()
    const defaultAirlineCode = (op?.iataCode as string) ?? ''

    const now = new Date().toISOString()
    const docs: FlightDoc[] = flights.map((f, i) => {
      const { separatorBelow, ...rest } = f
      return {
        _id: crypto.randomUUID(),
        operatorId,
        seasonCode,
        scenarioId: scenarioId || null,
        ...rest,
        airlineCode: rest.airlineCode || defaultAirlineCode,
        sortOrder: i,
        status: 'draft',
        isActive: true,
        source: '1.1.1 Scheduling XL (SSIM Import)',
        formatting: separatorBelow ? { separatorBelow: true } : {},
        createdAt: now,
        rotationId: null,
        rotationSequence: null,
        rotationLabel: null,
      }
    })

    // Auto-detect rotation cycles from station chains
    assignRotations(docs)

    await ScheduledFlight.insertMany(docs)

    return {
      success: true,
      imported: docs.length,
      errors: errors.length > 0 ? errors : undefined,
    }
  })

  // ── Export to Excel or IATA SSIM Chapter 7 text ──
  //
  // Query params (all optional unless noted):
  //   operatorId       (required) — tenant scope
  //   seasonCode               — IATA season ("S25" / "W24")
  //   scenarioId               — restrict to a what-if scenario
  //   format                   — 'xlsx' (default) or 'ssim' (text)
  //   timeMode                 — 'local' | 'utc' (only for ssim)
  //   actionCode               — 'H' | 'N' | 'R' (only for ssim; defaults 'H')
  //   dateFrom / dateTo        — YYYY-MM-DD overlap window on effective dates
  //   flightNumFrom / To       — numeric range, inclusive (filtered in JS — flightNumber is stored as string)
  //   depStations / arrStations — comma-separated ICAO codes
  //   serviceTypes             — comma-separated single-char IATA service types
  //
  // Known limitation: no chunking. Single in-memory result. Acceptable
  // ceiling ~10k flights / ~5 MB SSIM text. Add streaming if operators hit it.
  app.get('/ssim/export', async (req, reply) => {
    const q = req.query as Record<string, string>
    if (!q.operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const splitCsv = (raw?: string) =>
      raw
        ? raw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : []
    const depStations = splitCsv(q.depStations)
    const arrStations = splitCsv(q.arrStations)
    const serviceTypes = splitCsv(q.serviceTypes)

    const filter: Record<string, unknown> = {
      operatorId: q.operatorId,
      isActive: { $ne: false },
    }
    if (q.seasonCode) filter.seasonCode = q.seasonCode
    if (q.scenarioId) filter.scenarioId = q.scenarioId
    if (depStations.length > 0) filter.depStation = { $in: depStations }
    if (arrStations.length > 0) filter.arrStation = { $in: arrStations }
    if (serviceTypes.length > 0) filter.serviceType = { $in: serviceTypes }

    let flights = await ScheduledFlight.find(filter).sort({ sortOrder: 1, stdUtc: 1 }).lean()

    // Flight-number range is filtered in JS because flightNumber is stored as
    // a string — Mongo $gte/$lte would do lexical comparison ("9" > "10").
    const fnFrom = q.flightNumFrom ? parseInt(q.flightNumFrom, 10) : null
    const fnTo = q.flightNumTo ? parseInt(q.flightNumTo, 10) : null
    if (fnFrom != null || fnTo != null) {
      flights = flights.filter((f) => {
        const n = parseInt((f.flightNumber as string) || '0', 10) || 0
        if (fnFrom != null && n < fnFrom) return false
        if (fnTo != null && n > fnTo) return false
        return true
      })
    }

    // Date-overlap filter applied in JS rather than Mongo because the
    // ScheduledFlight collection mixes date formats: some rows store
    // effectiveFrom / effectiveUntil as ISO YYYY-MM-DD, others as DD/MM/YYYY
    // (legacy import path). Lexical compare on DD/MM/YYYY is wrong
    // ("31/12/2025" sorts after "01/01/2027"). Normalising both sides to
    // ISO before compare is the only reliable approach until the underlying
    // storage is migrated.
    if (q.dateFrom || q.dateTo) {
      const userFromIso = toIsoDate(q.dateFrom)
      const userToIso = toIsoDate(q.dateTo)
      flights = flights.filter((f) => {
        const effFromIso = toIsoDate(f.effectiveFrom as string)
        const effUntilIso = toIsoDate(f.effectiveUntil as string)
        if (!effFromIso || !effUntilIso) return false
        // Overlap: effectiveFrom <= userTo AND effectiveUntil >= userFrom
        if (userToIso && effFromIso > userToIso) return false
        if (userFromIso && effUntilIso < userFromIso) return false
        return true
      })
    }

    // Get operator (date format, IATA code, name, timezone)
    const op = await Operator.findOne({ $or: [{ code: q.operatorId }, { isActive: true }] }).lean()
    const dateFormat = (op?.dateFormat as string) ?? 'DD/MM/YYYY'

    // ── SSIM Chapter 7 (fixed-width 200-char) text format ──
    if (q.format === 'ssim') {
      if (!op) return reply.code(404).send({ error: 'Operator not found' })

      const timeMode = q.timeMode === 'utc' ? 'utc' : 'local' // default local
      const opOffset = timeMode === 'utc' ? '+0000' : tzOffsetString(op.timezone as string, new Date())

      // Derive season span from the flight set (min/max of effective dates)
      let seasonStart = ''
      let seasonEnd = ''
      for (const f of flights) {
        const from = (f.effectiveFrom as string) ?? ''
        const until = (f.effectiveUntil as string) ?? ''
        if (from && (!seasonStart || from < seasonStart)) seasonStart = from
        if (until && (!seasonEnd || until > seasonEnd)) seasonEnd = until
      }

      const airlineCode = (op.iataCode as string) || ''
      const airlineName = (op.name as string) || ''

      // ── Aircraft type ICAO → IATA lookup ──
      // SSIM Record 3 wants the IATA 3-char equipment code (e.g. "320", "321", "350", "380"),
      // not the ICAO code (A320 / A321 / A350 / A380). Build a map from the AircraftType
      // master data so each flight resolves its proper IATA code at write-time.
      const distinctTypes = Array.from(
        new Set(flights.map((f) => (f.aircraftTypeIcao as string) || '').filter(Boolean)),
      )
      const acTypeDocs = distinctTypes.length
        ? await AircraftType.find({
            operatorId: q.operatorId,
            $or: [{ icaoType: { $in: distinctTypes } }, { iataType: { $in: distinctTypes } }],
          }).lean()
        : []
      const icaoToIata = new Map<string, string>()
      for (const t of acTypeDocs) {
        const iata = ((t.iataType as string) || '').trim()
        if (!iata) continue
        if (t.icaoType) icaoToIata.set(t.icaoType as string, iata)
        // Self-map so an already-IATA code in the flight row still resolves
        icaoToIata.set(iata, iata)
      }
      const resolveIataAcType = (raw: string): string => {
        if (!raw) return ''
        return icaoToIata.get(raw) ?? raw.slice(0, 3)
      }

      // ── LOPA (seat configuration) lookup ──
      // SSIM Record 3 positions 172-191 hold the cabin configuration (e.g. "C008Y162").
      // LopaConfig is keyed by ICAO aircraft type. When multiple configs exist for the
      // same type we prefer the one flagged isDefault, then fall back to the first match.
      const lopas = distinctTypes.length
        ? await LopaConfig.find({
            operatorId: q.operatorId,
            aircraftType: { $in: distinctTypes },
            isActive: { $ne: false },
          }).lean()
        : []
      const lopaByType = new Map<string, Record<string, number>>()
      for (const l of lopas) {
        const key = l.aircraftType as string
        const existing = lopaByType.get(key)
        // First write wins UNLESS we find an isDefault entry, which always wins.
        if (existing && !l.isDefault) continue
        const cabins = (l.cabins as Array<{ classCode: string; seats: number }>) || []
        const cfg: Record<string, number> = {}
        for (const c of cabins) {
          // Map operator's "J" (Business) to IATA SSIM canonical "C" so the output
          // matches what downstream GDS systems expect. F / W / Y pass through unchanged.
          const code = c.classCode === 'J' ? 'C' : c.classCode
          if (code && c.seats > 0) cfg[code] = (cfg[code] || 0) + c.seats
        }
        lopaByType.set(key, cfg)
      }
      const resolveSeatConfig = (icaoType: string): Record<string, number> | undefined => {
        if (!icaoType) return undefined
        const cfg = lopaByType.get(icaoType)
        return cfg && Object.keys(cfg).length > 0 ? cfg : undefined
      }

      // Build rotation index: rotationId → seq → flight, so each leg can look up its onward.
      const byRotation = new Map<string, Map<number, (typeof flights)[number]>>()
      for (const f of flights) {
        const rid = f.rotationId as string | null
        const seq = f.rotationSequence as number | null
        if (!rid || seq == null) continue
        let m = byRotation.get(rid)
        if (!m) {
          m = new Map()
          byRotation.set(rid, m)
        }
        m.set(seq, f)
      }
      const onwardOf = (f: (typeof flights)[number]): (typeof flights)[number] | undefined => {
        const rid = f.rotationId as string | null
        const seq = f.rotationSequence as number | null
        if (!rid || seq == null) return undefined
        return byRotation.get(rid)?.get(seq + 1)
      }

      const records: SSIMFlightRecord[] = flights.map((f) => {
        const onward = onwardOf(f)
        return {
          airlineCode: ((f.airlineCode as string) || airlineCode).trim(),
          flightNumber: parseInt((f.flightNumber as string) || '0', 10) || 0,
          itineraryVariation: '01',
          legSequence: '01',
          serviceType: ((f.serviceType as string) || 'J').slice(0, 1),
          periodStart: (f.effectiveFrom as string) || seasonStart,
          periodEnd: (f.effectiveUntil as string) || seasonEnd,
          // ScheduledFlight stores daysOfWeek as a 7-char string ("1234567" or with spaces)
          daysOfOperation: ((f.daysOfWeek as string) || '       ').padEnd(7, ' ').slice(0, 7),
          depStation: (f.depStation as string) || '',
          stdUtc: (f.stdUtc as string) || '0000',
          depUtcOffset: opOffset,
          arrStation: (f.arrStation as string) || '',
          staUtc: (f.staUtc as string) || '0000',
          arrUtcOffset: opOffset,
          aircraftTypeIata: resolveIataAcType((f.aircraftTypeIcao as string) || ''),
          seatConfig: resolveSeatConfig((f.aircraftTypeIcao as string) || ''),
          onwardAirlineCode: onward ? ((onward.airlineCode as string) || airlineCode).trim() || undefined : undefined,
          onwardFlightNumber: onward ? parseInt((onward.flightNumber as string) || '0', 10) || undefined : undefined,
        }
      })

      const actionCode: 'H' | 'N' | 'R' = q.actionCode === 'N' || q.actionCode === 'R' ? q.actionCode : 'H'
      const options: SSIMExportOptions = {
        airlineCode,
        airlineName,
        seasonStart,
        seasonEnd,
        actionCode,
        creator: 'SKYHUB  ',
      }

      const text = generateSSIM(records, options)
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const seasonPart = q.seasonCode ? `${q.seasonCode}_` : ''
      const filename = `SSIM_${airlineCode || 'OP'}_${seasonPart}${timeMode.toUpperCase()}_${stamp}.ssim`

      reply.header('Content-Type', 'text/plain; charset=utf-8')
      reply.header('Content-Disposition', `attachment; filename="${filename}"`)
      // Surface record count + filename to the browser so the client UI can
      // show "N flights exported" without re-parsing the body. Expose them
      // via Access-Control-Expose-Headers since fetch() hides custom headers
      // by default in CORS responses.
      reply.header('X-Ssim-Flight-Count', String(records.length))
      reply.header('X-Ssim-Filename', filename)
      reply.header('Access-Control-Expose-Headers', 'X-Ssim-Flight-Count, X-Ssim-Filename, Content-Disposition')
      return reply.send(text)
    }

    // ── Default: Excel export ──

    const buffer = await generateSsimExcel(
      flights.map((f) => ({
        aircraftTypeIcao: f.aircraftTypeIcao as string | null,
        effectiveFrom: f.effectiveFrom as string,
        effectiveUntil: f.effectiveUntil as string,
        depStation: f.depStation as string,
        arrStation: f.arrStation as string,
        flightNumber: `${f.airlineCode}${f.flightNumber}`,
        stdUtc: f.stdUtc as string,
        staUtc: f.staUtc as string,
        departureDayOffset: (f.departureDayOffset as number) ?? 1,
        serviceType: f.serviceType as string,
        daysOfWeek: f.daysOfWeek as string,
        blockMinutes: f.blockMinutes as number | null,
        tat: null as number | null,
        status: f.status as string,
        separatorBelow: !!(f.formatting as Record<string, unknown>)?.separatorBelow,
      })),
      q.seasonCode,
      dateFormat,
    )

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    reply.header('Content-Disposition', `attachment; filename="schedule-${q.seasonCode}.xlsx"`)
    return reply.send(buffer)
  })

  // ── Download blank import template ──
  app.get('/ssim/template', async (req, reply) => {
    const q = req.query as Record<string, string>
    const op = await Operator.findOne({ isActive: true }).lean()
    const dateFmt = (op?.dateFormat as string) ?? 'DD/MM/YYYY'

    // Format example dates
    const fmtDate = (iso: string) => {
      const [y, m, d] = iso.split('-')
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const mon = months[parseInt(m, 10) - 1] ?? m
      switch (dateFmt) {
        case 'DD-MMM-YY':
          return `${d}-${mon}-${y.slice(2)}`
        case 'DD/MM/YYYY':
          return `${d}/${m}/${y}`
        case 'MM/DD/YYYY':
          return `${m}/${d}/${y}`
        case 'DD.MM.YYYY':
          return `${d}.${m}.${y}`
        default:
          return iso
      }
    }

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'SkyHub'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Schedule Template')

    const headers = [
      'AC Type',
      'From',
      'To',
      'DEP',
      'ARR',
      'Flight',
      'STD',
      'STA',
      'Offset',
      'SVC',
      'Frequency',
      'Block',
      'TAT',
      'Status',
    ]
    const headerRow = sheet.addRow(headers)
    headerRow.font = { bold: true, size: 11 }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F5' } }
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
    headerRow.height = 24

    const widths = [10, 14, 14, 6, 6, 10, 6, 6, 6, 5, 10, 6, 6, 8]
    widths.forEach((w, i) => {
      sheet.getColumn(i + 1).width = w
    })

    // Example row with operator's date format
    const example = sheet.addRow([
      'A321',
      fmtDate('2026-04-01'),
      fmtDate('2026-04-30'),
      'SGN',
      'HAN',
      '123',
      '08:00',
      '10:00',
      1,
      'J',
      '1234567',
      '2:00',
      '',
      'draft',
    ])
    example.alignment = { horizontal: 'center', vertical: 'middle' }
    example.font = { name: 'Consolas', size: 10, color: { argb: 'FF8F90A6' } }

    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]

    const buffer = await workbook.xlsx.writeBuffer()

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    reply.header('Content-Disposition', 'attachment; filename="schedule-import-template.xlsx"')
    return reply.send(Buffer.from(buffer))
  })
}
