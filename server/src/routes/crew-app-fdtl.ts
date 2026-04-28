import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireCrewAuth } from '../middleware/authenticate-crew.js'
import { computeFdtlSummary } from '../services/crew-fdtl-summary.js'

const QuerySchema = z.object({
  atIso: z.string().optional(),
})

export async function crewAppFdtlRoutes(app: FastifyInstance) {
  app.get('/crew-app/me/fdtl', { preHandler: requireCrewAuth }, async (req, reply) => {
    const parsed = QuerySchema.safeParse(req.query)
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten() })

    const atMs = parsed.data.atIso ? Date.parse(parsed.data.atIso) : Date.now()
    if (!Number.isFinite(atMs)) return reply.code(400).send({ error: 'Invalid atIso' })

    const summary = await computeFdtlSummary(req.crewOperatorId, req.crewId, atMs)
    return summary
  })
}
