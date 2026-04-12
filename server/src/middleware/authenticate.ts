import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
    operatorId: string
    userRole: string
  }
}

const PUBLIC_PATHS = ['/health', '/auth/login', '/auth/refresh', '/auth/set-password']
const PUBLIC_PREFIXES = ['/uploads/']

const INTERNAL_PATHS = ['/gantt/seed-oooi']

function isPublic(url: string, request?: FastifyRequest): boolean {
  const path = url.split('?')[0]
  if (PUBLIC_PATHS.includes(path)) return true
  if (PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))) return true
  // Internal-only paths: allowed only via app.inject (x-internal header)
  if (request?.headers['x-internal'] === 'true' && INTERNAL_PATHS.includes(path)) return true
  return false
}

export function registerAuthMiddleware(app: FastifyInstance) {
  app.decorateRequest('userId', '')
  app.decorateRequest('operatorId', '')
  app.decorateRequest('userRole', '')

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (isPublic(request.url, request)) {
      return
    }

    try {
      const decoded = await request.jwtVerify<{
        userId: string
        operatorId: string
        role: string
      }>()

      request.userId = decoded.userId
      request.operatorId = decoded.operatorId
      request.userRole = decoded.role
    } catch {
      return reply.code(401).send({ error: 'Unauthorized — invalid or missing token' })
    }
  })

  // Tenant-isolation safety net: for every authenticated request, overwrite
  // any operatorId smuggled in via query string or request body with the
  // value from the JWT. Routes that read from req.query / req.body for their
  // operatorId filtering therefore cannot leak cross-tenant data, even if the
  // caller passes a different operatorId on the wire.
  //
  // NOTE: url path params (e.g. /fdtl/schemes/:operatorId) are NOT touched here;
  // route handlers that key on a path param for cross-tenant admin operations
  // will need an explicit RBAC check in a follow-up sprint.
  app.addHook('preHandler', async (request: FastifyRequest) => {
    if (isPublic(request.url) || !request.operatorId) return

    if (
      request.query &&
      typeof request.query === 'object' &&
      'operatorId' in (request.query as Record<string, unknown>)
    ) {
      ;(request.query as Record<string, unknown>).operatorId = request.operatorId
    }

    if (
      request.body &&
      typeof request.body === 'object' &&
      !Array.isArray(request.body) &&
      'operatorId' in (request.body as Record<string, unknown>)
    ) {
      ;(request.body as Record<string, unknown>).operatorId = request.operatorId
    }
  })
}
