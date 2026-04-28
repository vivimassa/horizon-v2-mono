import type { FastifyInstance } from 'fastify'
import { ActivityCode } from '../models/ActivityCode.js'
import { requireCrewAuth } from '../middleware/authenticate-crew.js'

export interface ActivityCodeMeta {
  id: string
  code: string
  name: string
  shortLabel: string | null
  color: string | null
  flags: string[]
}

/**
 * GET /crew-app/activity-codes
 *
 * Returns the operator's full ActivityCode catalog so the crew app can
 * resolve roster `activityCodeId` (UUID) → human label (e.g. "Day Off",
 * "Sim Training"). The list rarely changes; the client caches via
 * react-query for 30 min.
 *
 * Tenant-scoped via `req.crewOperatorId`. No PII — codes are operator-
 * level reference data.
 */
export async function crewAppActivityCodesRoutes(app: FastifyInstance) {
  app.get('/crew-app/activity-codes', { preHandler: requireCrewAuth }, async (req) => {
    const operatorId = req.crewOperatorId
    const codes = await ActivityCode.find({ operatorId, isActive: { $ne: false } })
      .select({ _id: 1, code: 1, name: 1, shortLabel: 1, color: 1, flags: 1 })
      .lean()
    const out: ActivityCodeMeta[] = codes.map((c) => ({
      id: c._id as string,
      code: c.code,
      name: c.name,
      shortLabel: c.shortLabel ?? null,
      color: c.color ?? null,
      flags: (c.flags ?? []) as string[],
    }))
    return { codes: out }
  })
}
