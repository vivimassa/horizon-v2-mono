import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireCrewAuth } from '../middleware/authenticate-crew.js'
import { computeCrewStats } from '../services/crew-stats-aggregator.js'

const QuerySchema = z.object({
  period: z.enum(['month', '28d', 'year']).default('month'),
  atIso: z.string().optional(),
})

export async function crewAppStatsRoutes(app: FastifyInstance) {
  app.get('/crew-app/me/stats', { preHandler: requireCrewAuth }, async (req, reply) => {
    const parsed = QuerySchema.safeParse(req.query)
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten() })
    const atMs = parsed.data.atIso ? Date.parse(parsed.data.atIso) : Date.now()
    if (!Number.isFinite(atMs)) return reply.code(400).send({ error: 'Invalid atIso' })
    const stats = await computeCrewStats(req.crewOperatorId, req.crewId, parsed.data.period, atMs)
    return stats
  })
}
