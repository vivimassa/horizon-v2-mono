import type { FastifyInstance } from 'fastify'
import { ScheduledFlight } from '../models/ScheduledFlight.js'
import { computeScheduleDiff } from '../utils/schedule-diff-engine.js'

export async function scheduleMessageRoutes(app: FastifyInstance): Promise<void> {
  // ── Generate ASM/SSM messages by comparing two scenarios ──
  app.post('/schedule-messages/generate', async (req, reply) => {
    const { operatorId, seasonCode, baseScenarioId, targetScenarioId } = req.body as Record<string, string>
    if (!operatorId || !seasonCode) return reply.code(400).send({ error: 'operatorId and seasonCode required' })

    // Fetch base flights (production if no baseScenarioId)
    const baseFilter: Record<string, unknown> = { operatorId, seasonCode, isActive: { $ne: false } }
    if (baseScenarioId) baseFilter.scenarioId = baseScenarioId
    else baseFilter.scenarioId = null

    const targetFilter: Record<string, unknown> = { operatorId, seasonCode, isActive: { $ne: false } }
    if (targetScenarioId) targetFilter.scenarioId = targetScenarioId
    else targetFilter.scenarioId = null

    const [baseFlights, targetFlights] = await Promise.all([
      ScheduledFlight.find(baseFilter).lean(),
      ScheduledFlight.find(targetFilter).lean(),
    ])

    const messages = computeScheduleDiff(
      baseFlights.map(f => ({
        _id: f._id as string,
        flightNumber: `${f.airlineCode}${f.flightNumber}`,
        depStation: f.depStation as string,
        arrStation: f.arrStation as string,
        stdUtc: f.stdUtc as string,
        staUtc: f.staUtc as string,
        aircraftTypeIcao: f.aircraftTypeIcao as string | null,
        daysOfWeek: f.daysOfWeek as string,
        effectiveFrom: f.effectiveFrom as string,
        effectiveUntil: f.effectiveUntil as string,
        status: f.status as string,
      })),
      targetFlights.map(f => ({
        _id: f._id as string,
        flightNumber: `${f.airlineCode}${f.flightNumber}`,
        depStation: f.depStation as string,
        arrStation: f.arrStation as string,
        stdUtc: f.stdUtc as string,
        staUtc: f.staUtc as string,
        aircraftTypeIcao: f.aircraftTypeIcao as string | null,
        daysOfWeek: f.daysOfWeek as string,
        effectiveFrom: f.effectiveFrom as string,
        effectiveUntil: f.effectiveUntil as string,
        status: f.status as string,
      }))
    )

    return { messages, baseCount: baseFlights.length, targetCount: targetFlights.length }
  })
}
