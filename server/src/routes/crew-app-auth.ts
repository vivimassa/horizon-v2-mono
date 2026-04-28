import type { FastifyInstance, FastifyRequest } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { CrewMember } from '../models/CrewMember.js'
import { Operator } from '../models/Operator.js'
import { Airport } from '../models/Airport.js'
import { CrewPosition } from '../models/CrewPosition.js'
import { getServerEnv } from '@skyhub/env/server'
import { requireCrewAuth } from '../middleware/authenticate-crew.js'

/**
 * Resolve a CrewMember's `base` (Airport._id) to ICAO/IATA code and
 * `position` (CrewPosition._id) to its short code. The crew app shows
 * these as label chips ("HAN Base · CP"), not raw UUIDs.
 */
async function resolveProfileLabels(
  base: string | null | undefined,
  position: string | null | undefined,
): Promise<{ baseLabel: string | null; positionLabel: string | null }> {
  const [baseDoc, positionDoc] = await Promise.all([
    base ? Airport.findById(base, { icaoCode: 1, iataCode: 1 }).lean() : Promise.resolve(null),
    position ? CrewPosition.findById(position, { code: 1, name: 1 }).lean() : Promise.resolve(null),
  ])
  return {
    baseLabel: baseDoc?.iataCode ?? baseDoc?.icaoCode ?? null,
    positionLabel: positionDoc?.code ?? positionDoc?.name ?? null,
  }
}

// PIN policy: 6-digit numeric. bcrypt salt 12 (matches User password hashing).
const PIN_REGEX = /^\d{6}$/
const PIN_LOCKOUT_THRESHOLD = 5
const PIN_LOCKOUT_MINUTES = 15
// TTL for the temp PIN issued by Crew Ops (out-of-band) before crew sets
// permanent PIN. Imported by routes/crew.ts when adding the admin-side
// "Issue temp PIN" action.
export const CREW_TEMP_PIN_TTL_HOURS = 72

// In-memory rate limiter — same pattern as contact-submissions.ts. Buckets
// keyed by `${operatorId}:${employeeId}` (5/min) and IP (20/min). On boot
// the bucket is empty; production will swap for Redis if multi-instance.
const loginAttemptBucket = new Map<string, number[]>()
const ipBucket = new Map<string, number[]>()
const ATTEMPT_WINDOW_MS = 60_000
const ATTEMPT_MAX_PER_IDENTITY = 5
const ATTEMPT_MAX_PER_IP = 20

function rateLimitOk(bucket: Map<string, number[]>, key: string, max: number): boolean {
  const now = Date.now()
  const entries = (bucket.get(key) ?? []).filter((t) => now - t < ATTEMPT_WINDOW_MS)
  if (entries.length >= max) {
    bucket.set(key, entries)
    return false
  }
  entries.push(now)
  bucket.set(key, entries)
  return true
}

function getClientIp(req: FastifyRequest): string {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string') return xff.split(',')[0]?.trim() || req.ip
  return req.ip
}

interface CrewJwtPayload {
  crewId: string
  operatorId: string
  scope: 'crew'
}
interface CrewRefreshPayload extends CrewJwtPayload {
  type: 'refresh'
}

const LoginSchema = z.object({
  operatorId: z.string().min(1),
  employeeId: z.string().min(1).trim(),
  pin: z.string().regex(PIN_REGEX, 'PIN must be 6 digits'),
})

const SetPinSchema = z.object({
  operatorId: z.string().min(1),
  employeeId: z.string().min(1).trim(),
  tempPin: z.string().regex(PIN_REGEX, 'Temp PIN must be 6 digits'),
  newPin: z.string().regex(PIN_REGEX, 'New PIN must be 6 digits'),
})

const RefreshSchema = z.object({
  refreshToken: z.string().min(10),
})

export async function crewAppAuthRoutes(app: FastifyInstance) {
  const env = getServerEnv()

  // ── GET /crew-app/auth/operators ─────────────────────────────────────
  // Public — used by the operator-picker on first-launch of the crew app.
  // Returns minimal branding info, never any PII.
  app.get('/crew-app/auth/operators', async () => {
    const operators = await Operator.find(
      { isActive: { $ne: false } },
      { _id: 1, code: 1, name: 1, iataCode: 1, icaoCode: 1, accentColor: 1, logoUrl: 1, country: 1 },
    ).lean()
    return {
      operators: operators.map((o) => ({
        operatorId: o._id,
        code: o.code,
        name: o.name,
        iataCode: o.iataCode ?? null,
        icaoCode: o.icaoCode ?? null,
        accentColor: o.accentColor ?? '#1e40af',
        logoUrl: o.logoUrl ?? null,
        country: o.country ?? null,
      })),
    }
  })

  // ── POST /crew-app/auth/login ────────────────────────────────────────
  // Body: { operatorId, employeeId, pin }
  // Returns: { accessToken, refreshToken, profile }
  app.post('/crew-app/auth/login', async (req, reply) => {
    const parsed = LoginSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.flatten() })
    }
    const { operatorId, employeeId, pin } = parsed.data
    const ip = getClientIp(req)

    if (!rateLimitOk(ipBucket, ip, ATTEMPT_MAX_PER_IP)) {
      return reply.code(429).send({ error: 'Too many login attempts. Try again in a minute.' })
    }
    const identityKey = `${operatorId}:${employeeId.toUpperCase()}`
    if (!rateLimitOk(loginAttemptBucket, identityKey, ATTEMPT_MAX_PER_IDENTITY)) {
      return reply.code(429).send({ error: 'Too many login attempts for this account.' })
    }

    const crew = await CrewMember.findOne({ operatorId, employeeId }).lean()
    if (!crew) {
      return reply.code(401).send({ error: 'Invalid employee ID or PIN' })
    }
    if (crew.status !== 'active') {
      return reply.code(403).send({ error: 'Account is not active' })
    }

    const lockedUntil = crew.crewApp?.pinLockedUntil
    if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) {
      return reply.code(423).send({ error: 'Account temporarily locked. Try again later.' })
    }

    const pinHash = crew.crewApp?.pinHash
    if (!pinHash) {
      return reply
        .code(409)
        .send({ error: 'PIN not set. Use the temporary PIN issued by Crew Ops.', code: 'PIN_NOT_SET' })
    }

    const valid = await bcrypt.compare(pin, pinHash)
    if (!valid) {
      const failed = (crew.crewApp?.pinFailedAttempts ?? 0) + 1
      const update: Record<string, unknown> = { 'crewApp.pinFailedAttempts': failed }
      if (failed >= PIN_LOCKOUT_THRESHOLD) {
        update['crewApp.pinLockedUntil'] = new Date(Date.now() + PIN_LOCKOUT_MINUTES * 60_000).toISOString()
        update['crewApp.pinFailedAttempts'] = 0
      }
      await CrewMember.updateOne({ _id: crew._id }, { $set: update })
      return reply.code(401).send({ error: 'Invalid employee ID or PIN' })
    }

    await CrewMember.updateOne(
      { _id: crew._id },
      {
        $set: {
          'crewApp.pinFailedAttempts': 0,
          'crewApp.pinLockedUntil': null,
          'crewApp.lastLoginAt': new Date().toISOString(),
        },
      },
    )

    const payload: CrewJwtPayload = { crewId: crew._id as string, operatorId, scope: 'crew' }
    const accessToken = app.jwt.sign(payload, { expiresIn: env.JWT_ACCESS_EXPIRY })
    const refreshToken = app.jwt.sign({ ...payload, type: 'refresh' } satisfies CrewRefreshPayload, {
      expiresIn: env.JWT_REFRESH_EXPIRY,
    })

    const { baseLabel, positionLabel } = await resolveProfileLabels(crew.base, crew.position)
    return {
      accessToken,
      refreshToken,
      profile: {
        crewId: crew._id,
        operatorId: crew.operatorId,
        employeeId: crew.employeeId,
        firstName: crew.firstName,
        lastName: crew.lastName,
        position: positionLabel,
        base: baseLabel,
        photoUrl: crew.photoUrl ?? null,
        isScheduleVisible: crew.isScheduleVisible ?? true,
      },
    }
  })

  // ── POST /crew-app/auth/set-pin ──────────────────────────────────────
  // First-login flow. Crew Ops issues a temp PIN out-of-band (SMS/email);
  // crew enters EID + tempPin + newPin. We rotate to permanent PIN and
  // immediately return tokens (skip a second login round-trip).
  app.post('/crew-app/auth/set-pin', async (req, reply) => {
    const parsed = SetPinSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.flatten() })
    }
    const { operatorId, employeeId, tempPin, newPin } = parsed.data
    const ip = getClientIp(req)
    if (!rateLimitOk(ipBucket, ip, ATTEMPT_MAX_PER_IP)) {
      return reply.code(429).send({ error: 'Too many attempts. Try again in a minute.' })
    }

    const crew = await CrewMember.findOne({ operatorId, employeeId }).lean()
    if (!crew) return reply.code(401).send({ error: 'Invalid employee ID or temp PIN' })
    if (crew.status !== 'active') return reply.code(403).send({ error: 'Account is not active' })

    const tempHash = crew.crewApp?.tempPinHash
    const tempExpiry = crew.crewApp?.tempPinExpiresAt
    if (!tempHash || !tempExpiry || new Date(tempExpiry).getTime() < Date.now()) {
      return reply.code(401).send({ error: 'Temp PIN expired or not issued. Contact Crew Ops.' })
    }
    const valid = await bcrypt.compare(tempPin, tempHash)
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid employee ID or temp PIN' })
    }

    const newHash = await bcrypt.hash(newPin, 12)
    await CrewMember.updateOne(
      { _id: crew._id },
      {
        $set: {
          'crewApp.pinHash': newHash,
          'crewApp.pinSetAt': new Date().toISOString(),
          'crewApp.tempPinHash': null,
          'crewApp.tempPinExpiresAt': null,
          'crewApp.pinFailedAttempts': 0,
          'crewApp.pinLockedUntil': null,
          'crewApp.lastLoginAt': new Date().toISOString(),
        },
      },
    )

    const payload: CrewJwtPayload = { crewId: crew._id as string, operatorId, scope: 'crew' }
    const accessToken = app.jwt.sign(payload, { expiresIn: env.JWT_ACCESS_EXPIRY })
    const refreshToken = app.jwt.sign({ ...payload, type: 'refresh' } satisfies CrewRefreshPayload, {
      expiresIn: env.JWT_REFRESH_EXPIRY,
    })

    const { baseLabel: spBaseLabel, positionLabel: spPositionLabel } = await resolveProfileLabels(
      crew.base,
      crew.position,
    )
    return {
      accessToken,
      refreshToken,
      profile: {
        crewId: crew._id,
        operatorId: crew.operatorId,
        employeeId: crew.employeeId,
        firstName: crew.firstName,
        lastName: crew.lastName,
        position: spPositionLabel,
        base: spBaseLabel,
        photoUrl: crew.photoUrl ?? null,
      },
    }
  })

  // ── POST /crew-app/auth/refresh ──────────────────────────────────────
  app.post('/crew-app/auth/refresh', async (req, reply) => {
    const parsed = RefreshSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Refresh token required' })

    try {
      const decoded = app.jwt.verify<CrewRefreshPayload>(parsed.data.refreshToken)
      if (decoded.type !== 'refresh' || decoded.scope !== 'crew') {
        return reply.code(401).send({ error: 'Invalid token type' })
      }
      const crew = await CrewMember.findById(decoded.crewId).lean()
      if (!crew || crew.status !== 'active') {
        return reply.code(401).send({ error: 'Crew member not found or inactive' })
      }
      const payload: CrewJwtPayload = {
        crewId: decoded.crewId,
        operatorId: decoded.operatorId,
        scope: 'crew',
      }
      const accessToken = app.jwt.sign(payload, { expiresIn: env.JWT_ACCESS_EXPIRY })
      const refreshToken = app.jwt.sign({ ...payload, type: 'refresh' } satisfies CrewRefreshPayload, {
        expiresIn: env.JWT_REFRESH_EXPIRY,
      })
      return { accessToken, refreshToken }
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired refresh token' })
    }
  })

  // ── POST /crew-app/auth/logout ───────────────────────────────────────
  // Authenticated. Removes the supplied push token from the crew member's
  // pushTokens array (so the device stops receiving notifications even if
  // the JWT is still valid client-side).
  app.post<{ Body: { pushToken?: string } }>('/crew-app/auth/logout', { preHandler: requireCrewAuth }, async (req) => {
    const pushToken = req.body?.pushToken
    if (pushToken) {
      await CrewMember.updateOne({ _id: req.crewId }, { $pull: { 'crewApp.pushTokens': { token: pushToken } } })
    }
    return { success: true }
  })
}
