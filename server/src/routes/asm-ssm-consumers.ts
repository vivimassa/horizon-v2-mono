import crypto from 'node:crypto'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { AsmSsmConsumer } from '../models/AsmSsmConsumer.js'

/**
 * 7.1.5.1 ASM/SSM Transmission — consumer CRUD.
 *
 *   GET    /asm-ssm-consumers?operatorId=…          → list
 *   POST   /asm-ssm-consumers                       → create (pull_api returns plaintext key ONCE)
 *   PATCH  /asm-ssm-consumers/:id                   → update
 *   DELETE /asm-ssm-consumers/:id                   → soft-delete (active=false)
 *   POST   /asm-ssm-consumers/:id/rotate-key        → issue fresh pull_api key
 *
 * Writes are gated by requireOpsRole; reads open to any authenticated
 * user of the tenant. Keys are stored only as SHA-256 hashes — plaintext
 * leaves the server exactly once, at create/rotate time.
 */

const DELIVERY_MODES = ['pull_api', 'sftp', 'smtp'] as const

const pullApiBlock = z
  .object({
    ipAllowlist: z.array(z.string()).optional(),
  })
  .optional()

const sftpBlock = z
  .object({
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535).optional(),
    user: z.string().min(1),
    authType: z.enum(['password', 'key']).optional(),
    secretRef: z.string().optional(),
    targetPath: z.string().optional(),
    filenamePattern: z.string().optional(),
  })
  .optional()

const smtpBlock = z
  .object({
    to: z.string().email(),
    cc: z.array(z.string().email()).optional(),
    bcc: z.array(z.string().email()).optional(),
    subjectTemplate: z.string().optional(),
    asAttachment: z.boolean().optional(),
  })
  .optional()

const createSchema = z.object({
  operatorId: z.string().min(1),
  name: z.string().min(1).max(120),
  contactEmail: z.string().email().nullable().optional(),
  deliveryMode: z.enum(DELIVERY_MODES),
  pullApi: pullApiBlock,
  sftp: sftpBlock,
  smtp: smtpBlock,
  active: z.boolean().optional(),
})

const updateSchema = createSchema.partial().omit({ operatorId: true })

const WRITE_ROLES = new Set(['administrator', 'manager', 'operator'])
async function requireOpsRole(req: FastifyRequest, reply: FastifyReply) {
  if (!WRITE_ROLES.has(req.userRole)) {
    return reply.code(403).send({ error: 'Forbidden — ops role required' })
  }
}

function hashKey(plain: string): string {
  return crypto.createHash('sha256').update(plain).digest('hex')
}

function maskKey(plain: string): string {
  if (plain.length <= 8) return '••••••••'
  return `${plain.slice(0, 4)}${'•'.repeat(Math.max(4, plain.length - 8))}${plain.slice(-4)}`
}

export async function asmSsmConsumerRoutes(app: FastifyInstance) {
  // ── GET list ─────────────────────────────────────────────
  app.get('/asm-ssm-consumers', async (req, reply) => {
    const q = req.query as { operatorId?: string; includeInactive?: string }
    if (!q.operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const filter: Record<string, unknown> = { operatorId: q.operatorId }
    if (q.includeInactive !== 'true') filter.active = true

    const docs = await AsmSsmConsumer.find(filter).sort({ createdAtUtc: -1 }).lean()
    // Strip the key hash before returning — clients never need it.
    return {
      consumers: docs.map((d) => {
        const { pullApi, ...rest } = d
        const pa = pullApi as { apiKeyHash?: string | null; ipAllowlist?: string[] } | undefined
        return {
          ...rest,
          pullApi: pa
            ? {
                hasKey: Boolean(pa.apiKeyHash),
                ipAllowlist: pa.ipAllowlist ?? [],
              }
            : { hasKey: false, ipAllowlist: [] },
        }
      }),
    }
  })

  // ── POST create ──────────────────────────────────────────
  app.post('/asm-ssm-consumers', { preHandler: requireOpsRole }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }
    const d = parsed.data

    // Mode-specific required-field check (Zod optional blocks, so enforce here).
    if (d.deliveryMode === 'sftp' && !d.sftp) {
      return reply.code(400).send({ error: 'sftp config required when deliveryMode=sftp' })
    }
    if (d.deliveryMode === 'smtp' && !d.smtp) {
      return reply.code(400).send({ error: 'smtp config required when deliveryMode=smtp' })
    }

    const now = new Date().toISOString()
    let plaintextKey: string | null = null
    const pullApi: { apiKeyHash: string | null; ipAllowlist: string[] } = {
      apiKeyHash: null,
      ipAllowlist: d.pullApi?.ipAllowlist ?? [],
    }
    if (d.deliveryMode === 'pull_api') {
      plaintextKey = `sh_${crypto.randomBytes(24).toString('base64url')}`
      pullApi.apiKeyHash = hashKey(plaintextKey)
    }

    const doc = await AsmSsmConsumer.create({
      _id: crypto.randomUUID(),
      operatorId: d.operatorId,
      name: d.name,
      contactEmail: d.contactEmail ?? null,
      deliveryMode: d.deliveryMode,
      pullApi,
      sftp: d.deliveryMode === 'sftp' ? (d.sftp ?? {}) : {},
      smtp: d.deliveryMode === 'smtp' ? (d.smtp ?? {}) : {},
      active: d.active ?? true,
      createdAtUtc: now,
      updatedAtUtc: now,
    })

    return {
      consumer: {
        ...doc.toObject(),
        pullApi: {
          hasKey: Boolean(pullApi.apiKeyHash),
          ipAllowlist: pullApi.ipAllowlist,
        },
      },
      // Plaintext key is returned ONCE — the UI displays it and warns the user.
      apiKey: plaintextKey,
      apiKeyMasked: plaintextKey ? maskKey(plaintextKey) : null,
    }
  })

  // ── PATCH update ─────────────────────────────────────────
  app.patch('/asm-ssm-consumers/:id', { preHandler: requireOpsRole }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }
    const d = parsed.data
    const now = new Date().toISOString()

    const existing = await AsmSsmConsumer.findById(id).lean()
    if (!existing) return reply.code(404).send({ error: 'Consumer not found' })

    const update: Record<string, unknown> = { updatedAtUtc: now }
    if (d.name !== undefined) update.name = d.name
    if (d.contactEmail !== undefined) update.contactEmail = d.contactEmail
    if (d.active !== undefined) update.active = d.active
    if (d.deliveryMode !== undefined) update.deliveryMode = d.deliveryMode
    // Mode-specific block updates preserve key hash.
    if (d.pullApi !== undefined) {
      const ex = existing.pullApi as { apiKeyHash?: string | null } | undefined
      update.pullApi = {
        apiKeyHash: ex?.apiKeyHash ?? null,
        ipAllowlist: d.pullApi.ipAllowlist ?? [],
      }
    }
    if (d.sftp !== undefined) update.sftp = d.sftp
    if (d.smtp !== undefined) update.smtp = { ...existing.smtp, ...d.smtp }

    await AsmSsmConsumer.updateOne({ _id: id }, { $set: update })
    const fresh = await AsmSsmConsumer.findById(id).lean()
    if (!fresh) return reply.code(404).send({ error: 'Consumer not found after update' })

    const pa = fresh.pullApi as { apiKeyHash?: string | null; ipAllowlist?: string[] } | undefined
    return {
      consumer: {
        ...fresh,
        pullApi: { hasKey: Boolean(pa?.apiKeyHash), ipAllowlist: pa?.ipAllowlist ?? [] },
      },
    }
  })

  // ── DELETE (soft) ────────────────────────────────────────
  app.delete('/asm-ssm-consumers/:id', { preHandler: requireOpsRole }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const now = new Date().toISOString()
    const result = await AsmSsmConsumer.updateOne({ _id: id }, { $set: { active: false, updatedAtUtc: now } })
    if (result.matchedCount === 0) return reply.code(404).send({ error: 'Consumer not found' })
    return { ok: true }
  })

  // ── POST rotate-key (pull_api only) ──────────────────────
  app.post('/asm-ssm-consumers/:id/rotate-key', { preHandler: requireOpsRole }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await AsmSsmConsumer.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Consumer not found' })
    if (doc.deliveryMode !== 'pull_api') {
      return reply.code(400).send({ error: 'rotate-key only valid for pull_api consumers' })
    }

    const plaintextKey = `sh_${crypto.randomBytes(24).toString('base64url')}`
    const ex = doc.pullApi as { ipAllowlist?: string[] } | undefined
    const now = new Date().toISOString()
    await AsmSsmConsumer.updateOne(
      { _id: id },
      {
        $set: {
          pullApi: { apiKeyHash: hashKey(plaintextKey), ipAllowlist: ex?.ipAllowlist ?? [] },
          updatedAtUtc: now,
        },
      },
    )
    return { apiKey: plaintextKey, apiKeyMasked: maskKey(plaintextKey), rotatedAtUtc: now }
  })
}
