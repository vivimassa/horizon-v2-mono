import crypto from 'node:crypto'
import ExcelJS from 'exceljs'
import type { FastifyInstance } from 'fastify'
import { ScheduledFlight } from '../models/ScheduledFlight.js'
import { Operator } from '../models/Operator.js'
import { parseSsimExcel, type ParsedFlight } from '../utils/ssim-parser.js'
import { generateSsimExcel } from '../utils/ssim-exporter.js'

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
    for (let depth = 0; depth < 20; depth++) { // safety limit
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
    const label = chain.map(f => f.flightNumber).join('/')

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

  // ── Export to Excel ──
  app.get('/ssim/export', async (req, reply) => {
    const q = req.query as Record<string, string>
    if (!q.operatorId || !q.seasonCode) return reply.code(400).send({ error: 'operatorId and seasonCode required' })

    const filter: Record<string, unknown> = {
      operatorId: q.operatorId,
      seasonCode: q.seasonCode,
      isActive: { $ne: false },
    }
    if (q.scenarioId) filter.scenarioId = q.scenarioId

    const flights = await ScheduledFlight.find(filter).sort({ sortOrder: 1, stdUtc: 1 }).lean()

    // Get operator date format (lookup by code, or fallback to first active)
    const op = await Operator.findOne({ $or: [{ code: q.operatorId }, { isActive: true }] }).lean()
    const dateFormat = (op?.dateFormat as string) ?? 'DD/MM/YYYY'

    const buffer = await generateSsimExcel(
      flights.map(f => ({
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
      dateFormat
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
        case 'DD-MMM-YY': return `${d}-${mon}-${y.slice(2)}`
        case 'DD/MM/YYYY': return `${d}/${m}/${y}`
        case 'MM/DD/YYYY': return `${m}/${d}/${y}`
        case 'DD.MM.YYYY': return `${d}.${m}.${y}`
        default: return iso
      }
    }

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'SkyHub'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Schedule Template')

    const headers = ['AC Type', 'From', 'To', 'DEP', 'ARR', 'Flight', 'STD', 'STA', 'Offset', 'SVC', 'Frequency', 'Block', 'TAT', 'Status']
    const headerRow = sheet.addRow(headers)
    headerRow.font = { bold: true, size: 11 }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F5' } }
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
    headerRow.height = 24

    const widths = [10, 14, 14, 6, 6, 10, 6, 6, 6, 5, 10, 6, 6, 8]
    widths.forEach((w, i) => { sheet.getColumn(i + 1).width = w })

    // Example row with operator's date format
    const example = sheet.addRow(['A321', fmtDate('2026-04-01'), fmtDate('2026-04-30'), 'SGN', 'HAN', '123', '08:00', '10:00', 1, 'J', '1234567', '2:00', '', 'draft'])
    example.alignment = { horizontal: 'center', vertical: 'middle' }
    example.font = { name: 'Consolas', size: 10, color: { argb: 'FF8F90A6' } }

    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]

    const buffer = await workbook.xlsx.writeBuffer()

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    reply.header('Content-Disposition', 'attachment; filename="schedule-import-template.xlsx"')
    return reply.send(Buffer.from(buffer))
  })
}
