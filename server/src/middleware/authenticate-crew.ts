import type { FastifyRequest, FastifyReply } from 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    crewId: string
    crewOperatorId: string
  }
}

interface CrewJwtPayload {
  crewId: string
  operatorId: string
  scope: 'crew'
  type?: 'refresh'
}

/**
 * Per-route preHandler that verifies a crew-scoped JWT and decorates the
 * request with crewId + crewOperatorId. Use on every /crew-app/* route
 * EXCEPT the public auth endpoints (operators list, login, refresh,
 * set-pin). The main authenticate.ts middleware skips /crew-app/* via
 * PUBLIC_PREFIXES, so this hook is the sole gate.
 *
 * Mounts request.crewId from JWT (single source of truth — clients cannot
 * smuggle a different crewId in body/query).
 */
export async function requireCrewAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    const decoded = await request.jwtVerify<CrewJwtPayload>()

    if (decoded.scope !== 'crew') {
      return reply.code(403).send({ error: 'Ops token cannot access crew API' })
    }
    if (decoded.type === 'refresh') {
      return reply.code(401).send({ error: 'Refresh token cannot access protected routes' })
    }

    request.crewId = decoded.crewId
    request.crewOperatorId = decoded.operatorId
  } catch {
    return reply.code(401).send({ error: 'Unauthorized — invalid or missing crew token' })
  }
}
