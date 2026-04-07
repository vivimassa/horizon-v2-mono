import crypto from 'node:crypto'
import ExcelJS from 'exceljs'
import type { FastifyInstance } from 'fastify'
import { ScheduledFlight } from '../models/ScheduledFlight.js'
import { Operator } from '../models/Operator.js'
import { parseSsimExcel } from '../utils/ssim-parser.js'
import { generateSsimExcel } from '../utils/ssim-exporter.js'

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
    const docs = flights.map((f, i) => {
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
        source: 'ssim_import',
        formatting: separatorBelow ? { separatorBelow: true } : {},
        createdAt: now,
      }
    })

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
