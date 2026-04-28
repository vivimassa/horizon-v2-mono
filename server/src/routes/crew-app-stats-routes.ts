import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireCrewAuth } from '../middleware/authenticate-crew.js'
import { computeTopRoutes } from '../services/crew-stats-routes.js'

const QuerySchema = z.object({
  period: z.enum(['month', '28d', 'year']).default('month'),
  atIso: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(5),
})

export async function crewAppStatsTopRoutesRoutes(app: FastifyInstance) {
  app.get('/crew-app/me/stats/routes', { preHandler: requireCrewAuth }, async (req, reply) => {
    const parsed = QuerySchema.safeParse(req.query)
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten() })
    const atMs = parsed.data.atIso ? Date.parse(parsed.data.atIso) : Date.now()
    if (!Number.isFinite(atMs)) return reply.code(400).send({ error: 'Invalid atIso' })
    const routes = await computeTopRoutes(req.crewOperatorId, req.crewId, parsed.data.period, atMs, parsed.data.limit)
    return { routes }
  })
}
