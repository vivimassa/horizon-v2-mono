import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { ScheduledFlight } from '../models/ScheduledFlight.js'
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

    const now = new Date().toISOString()
    const docs = flights.map(f => ({
      _id: crypto.randomUUID(),
      operatorId,
      seasonCode,
      scenarioId: scenarioId || null,
      ...f,
      status: 'draft',
      isActive: true,
      source: 'ssim_import',
      createdAt: now,
    }))

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

    const flights = await ScheduledFlight.find(filter).sort({ stdUtc: 1 }).lean()

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
        serviceType: f.serviceType as string,
        daysOfWeek: f.daysOfWeek as string,
        blockMinutes: f.blockMinutes as number | null,
        status: f.status as string,
      })),
      q.seasonCode
    )

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    reply.header('Content-Disposition', `attachment; filename="schedule-${q.seasonCode}.xlsx"`)
    return reply.send(buffer)
  })
}
