import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { MaintenanceCheckType } from '../models/MaintenanceCheckType.js'
import { MaintenanceWindow } from '../models/MaintenanceWindow.js'

// ── Zod schemas ──

const checkTypeCreateSchema = z
  .object({
    operatorId: z.string().min(1),
    code: z.string().min(1).max(10),
    name: z.string().min(1).max(100),
    description: z.string().nullable().optional(),
    amosCode: z.string().nullable().optional(),
    applicableAircraftTypeIds: z.array(z.string()).optional().default([]),
    defaultHoursInterval: z.number().positive().nullable().optional(),
    defaultCyclesInterval: z.number().int().positive().nullable().optional(),
    defaultDaysInterval: z.number().int().positive().nullable().optional(),
    defaultDurationHours: z.number().positive().nullable().optional(),
    defaultStation: z.string().nullable().optional(),
    requiresGrounding: z.boolean().optional().default(true),
    resetsCheckCodes: z.array(z.string()).nullable().optional(),
    color: z.string().nullable().optional(),
    sortOrder: z.number().int().optional().default(0),
    isActive: z.boolean().optional().default(true),
  })
  .strict()

const checkTypeUpdateSchema = checkTypeCreateSchema.omit({ operatorId: true }).partial().strict()

const windowCreateSchema = z
  .object({
    operatorId: z.string().min(1),
    base: z.string().min(3).max(4),
    windowStartUtc: z.string().regex(/^\d{2}:\d{2}$/),
    windowEndUtc: z.string().regex(/^\d{2}:\d{2}$/),
    windowDurationHours: z.number().nullable().optional(),
    isManualOverride: z.boolean().optional().default(true),
    notes: z.string().nullable().optional(),
  })
  .strict()

// ── Helpers ──

function computeWindowDuration(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const startMin = sh * 60 + sm
  let endMin = eh * 60 + em
  if (endMin <= startMin) endMin += 24 * 60 // overnight window
  return Math.round(((endMin - startMin) / 60) * 100) / 100
}

// ── Routes ──

export async function maintenanceCheckRoutes(app: FastifyInstance): Promise<void> {
  // ────────────────────────────────────────────────
  // MAINTENANCE CHECK TYPES
  // ────────────────────────────────────────────────

  // List all for operator
  app.get('/maintenance-check-types', async (req) => {
    const q = req.query as Record<string, string>
    const filter: Record<string, unknown> = {}
    if (q.operatorId) filter.operatorId = q.operatorId
    return MaintenanceCheckType.find(filter).sort({ sortOrder: 1, name: 1 }).lean()
  })

  // Get single
  app.get('/maintenance-check-types/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await MaintenanceCheckType.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Check type not found' })
    return doc
  })

  // Create
  app.post('/maintenance-check-types', async (req, reply) => {
    const raw = req.body as Record<string, unknown>
    if (raw.code) raw.code = (raw.code as string).toUpperCase()
    if (raw.defaultStation) raw.defaultStation = (raw.defaultStation as string).toUpperCase()
    const parsed = checkTypeCreateSchema.safeParse(raw)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      })
    }
    const id = crypto.randomUUID()
    const doc = await MaintenanceCheckType.create({
      _id: id,
      ...parsed.data,
      createdAt: new Date().toISOString(),
    })
    return reply.code(201).send(doc.toObject())
  })

  // Update
  app.patch('/maintenance-check-types/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const raw = req.body as Record<string, unknown>
    if (raw.code) raw.code = (raw.code as string).toUpperCase()
    if (raw.defaultStation) raw.defaultStation = (raw.defaultStation as string).toUpperCase()
    const parsed = checkTypeUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      })
    }
    const doc = await MaintenanceCheckType.findByIdAndUpdate(
      id,
      { $set: { ...parsed.data, updatedAt: new Date().toISOString() } },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Check type not found' })
    return doc
  })

  // Delete
  app.delete('/maintenance-check-types/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await MaintenanceCheckType.findByIdAndDelete(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Check type not found' })
    return { ok: true }
  })

  // ────────────────────────────────────────────────
  // MAINTENANCE WINDOWS
  // ────────────────────────────────────────────────

  // List all for operator
  app.get('/maintenance-windows', async (req) => {
    const q = req.query as Record<string, string>
    const filter: Record<string, unknown> = {}
    if (q.operatorId) filter.operatorId = q.operatorId
    return MaintenanceWindow.find(filter).sort({ base: 1 }).lean()
  })

  // Create (upsert by base)
  app.post('/maintenance-windows', async (req, reply) => {
    const raw = req.body as Record<string, unknown>
    if (raw.base) raw.base = (raw.base as string).toUpperCase()
    const parsed = windowCreateSchema.safeParse(raw)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      })
    }
    const duration = computeWindowDuration(parsed.data.windowStartUtc, parsed.data.windowEndUtc)
    const now = new Date().toISOString()

    // Upsert: if same operator+base exists, update it
    const existing = await MaintenanceWindow.findOne({
      operatorId: parsed.data.operatorId,
      base: parsed.data.base,
    })

    if (existing) {
      const doc = await MaintenanceWindow.findByIdAndUpdate(
        existing._id,
        {
          $set: {
            windowStartUtc: parsed.data.windowStartUtc,
            windowEndUtc: parsed.data.windowEndUtc,
            windowDurationHours: duration,
            isManualOverride: parsed.data.isManualOverride ?? true,
            notes: parsed.data.notes ?? null,
            updatedAt: now,
          },
        },
        { new: true },
      ).lean()
      return doc
    }

    const id = crypto.randomUUID()
    const doc = await MaintenanceWindow.create({
      _id: id,
      ...parsed.data,
      windowDurationHours: duration,
      createdAt: now,
    })
    return reply.code(201).send(doc.toObject())
  })

  // Delete
  app.delete('/maintenance-windows/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await MaintenanceWindow.findByIdAndDelete(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Window not found' })
    return { ok: true }
  })
}
