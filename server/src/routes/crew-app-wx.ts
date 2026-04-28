import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireCrewAuth } from '../middleware/authenticate-crew.js'
import { getMetar, getTaf } from '../services/wx-noaa.js'

const QuerySchema = z.object({
  dep: z.string().length(4),
  arr: z.string().length(4),
})

export async function crewAppWxRoutes(app: FastifyInstance) {
  app.get('/crew-app/wx', { preHandler: requireCrewAuth }, async (req, reply) => {
    const parsed = QuerySchema.safeParse(req.query)
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten() })

    const { dep, arr } = parsed.data
    const [metarDep, metarArr, tafDep, tafArr] = await Promise.all([
      getMetar(dep),
      getMetar(arr),
      getTaf(dep),
      getTaf(arr),
    ])

    return {
      dep,
      arr,
      metarDep: metarDep.raw,
      metarArr: metarArr.raw,
      tafDep: tafDep.raw,
      tafArr: tafArr.raw,
      source: 'noaa',
      fetchedAtMs: Math.max(metarDep.fetchedAtMs, metarArr.fetchedAtMs, tafDep.fetchedAtMs, tafArr.fetchedAtMs),
    }
  })
}
