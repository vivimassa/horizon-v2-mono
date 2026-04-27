import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { CrewMember } from '../models/CrewMember.js'
import { requireCrewAuth } from '../middleware/authenticate-crew.js'

const RegisterSchema = z.object({
  token: z.string().min(10).max(256),
  platform: z.enum(['ios', 'android']),
})

const UnregisterSchema = z.object({
  token: z.string().min(10).max(256),
})

export async function crewAppPushTokenRoutes(app: FastifyInstance) {
  // ── POST /crew-app/push-tokens/register ───────────────────────────────
  // Idempotent — upserts the token. Same token across crew app reinstalls
  // gets its registeredAt refreshed; new tokens are appended.
  app.post('/crew-app/push-tokens/register', { preHandler: requireCrewAuth }, async (req, reply) => {
    const parsed = RegisterSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.flatten() })
    }
    const { token, platform } = parsed.data
    const nowIso = new Date().toISOString()

    // Two-phase upsert: $pull existing matching token, then $push fresh
    // entry. Cheaper than scanning the array client-side.
    await CrewMember.updateOne({ _id: req.crewId }, { $pull: { 'crewApp.pushTokens': { token } } })
    await CrewMember.updateOne(
      { _id: req.crewId },
      {
        $push: {
          'crewApp.pushTokens': { token, platform, registeredAt: nowIso, lastUsedAt: nowIso },
        },
      },
    )

    return { success: true }
  })

  // ── DELETE /crew-app/push-tokens ──────────────────────────────────────
  app.delete('/crew-app/push-tokens', { preHandler: requireCrewAuth }, async (req, reply) => {
    const parsed = UnregisterSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.flatten() })
    }
    await CrewMember.updateOne({ _id: req.crewId }, { $pull: { 'crewApp.pushTokens': { token: parsed.data.token } } })
    return { success: true }
  })
}
