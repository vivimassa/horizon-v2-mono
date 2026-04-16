import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { NonCrewPerson } from '../models/NonCrewPerson.js'

// ─── Zod schemas ────────────────────────────────────────

const fullNameSchema = z.object({
  first: z.string().min(1, 'First name required'),
  middle: z.string().nullable().optional(),
  last: z.string().min(1, 'Last name required'),
})

const passportSchema = z.object({
  number: z.string().min(1, 'Passport number required'),
  countryOfIssue: z.string().length(3, 'ISO 3166-1 alpha-3 code required'),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
})

const contactSchema = z.object({
  email: z.string().email().nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional(),
})

const nonCrewCreateSchema = z
  .object({
    fullName: fullNameSchema,
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
    gender: z.enum(['M', 'F', 'X']),
    nationality: z.string().length(3, 'ISO 3166-1 alpha-3 code required'),
    passport: passportSchema,
    contact: contactSchema.optional(),
    company: z.string().nullable().optional(),
    department: z.string().nullable().optional(),
    jumpseatPriority: z.enum(['low', 'normal', 'high']).optional().default('normal'),
    doNotList: z.boolean().optional().default(false),
    terminated: z.boolean().optional().default(false),
  })
  .strict()

const nonCrewUpdateSchema = z
  .object({
    fullName: fullNameSchema.optional(),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD')
      .optional(),
    gender: z.enum(['M', 'F', 'X']).optional(),
    nationality: z.string().length(3).optional(),
    passport: passportSchema.optional(),
    contact: contactSchema.optional(),
    company: z.string().nullable().optional(),
    department: z.string().nullable().optional(),
    jumpseatPriority: z.enum(['low', 'normal', 'high']).optional(),
    doNotList: z.boolean().optional(),
    terminated: z.boolean().optional(),
  })
  .strict()

// ─── Routes ─────────────────────────────────────────────

export async function nonCrewPeopleRoutes(app: FastifyInstance): Promise<void> {
  // List — tenant-scoped
  app.get('/non-crew-people', async (req) => {
    const operatorId = req.operatorId
    const { search, availableOnly } = req.query as { search?: string; availableOnly?: string }

    const filter: Record<string, unknown> = { operatorId }
    if (availableOnly === 'true') {
      filter.terminated = { $ne: true }
      filter.doNotList = { $ne: true }
    }

    const docs = await NonCrewPerson.find(filter).sort({ 'fullName.last': 1, 'fullName.first': 1 }).lean()

    if (search && search.trim().length > 0) {
      const needle = search.trim().toLowerCase()
      return docs.filter((d) => {
        const full = `${d.fullName?.first ?? ''} ${d.fullName?.middle ?? ''} ${d.fullName?.last ?? ''}`.toLowerCase()
        return (
          full.includes(needle) ||
          (d.passport?.number ?? '').toLowerCase().includes(needle) ||
          (d.company ?? '').toLowerCase().includes(needle) ||
          (d.department ?? '').toLowerCase().includes(needle)
        )
      })
    }

    return docs
  })

  // Get single — tenant-scoped
  app.get('/non-crew-people/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const doc = await NonCrewPerson.findOne({ _id: id, operatorId }).lean()
    if (!doc) return reply.code(404).send({ error: 'Person not found' })
    return doc
  })

  // Create
  app.post('/non-crew-people', async (req, reply) => {
    const parsed = nonCrewCreateSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const operatorId = req.operatorId

    // Enforce unique passport per operator
    const existing = await NonCrewPerson.findOne({
      operatorId,
      'passport.number': parsed.data.passport.number,
    }).lean()
    if (existing) {
      return reply
        .code(409)
        .send({ error: `Passport ${parsed.data.passport.number} already registered for this operator` })
    }

    const now = new Date().toISOString()
    const doc = await NonCrewPerson.create({
      _id: crypto.randomUUID(),
      operatorId,
      ...parsed.data,
      contact: parsed.data.contact ?? { email: null, phone: null },
      createdAt: now,
      updatedAt: now,
    })

    return reply.code(201).send(doc.toObject())
  })

  // Update (partial)
  app.patch('/non-crew-people/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const parsed = nonCrewUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    // Guard passport uniqueness if number is changing
    if (parsed.data.passport?.number) {
      const clash = await NonCrewPerson.findOne({
        _id: { $ne: id },
        operatorId,
        'passport.number': parsed.data.passport.number,
      }).lean()
      if (clash) {
        return reply
          .code(409)
          .send({ error: `Passport ${parsed.data.passport.number} already registered for another person` })
      }
    }

    const doc = await NonCrewPerson.findOneAndUpdate(
      { _id: id, operatorId },
      { $set: { ...parsed.data, updatedAt: new Date().toISOString() } },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Person not found' })
    return doc
  })

  // Delete
  app.delete('/non-crew-people/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId

    const existing = await NonCrewPerson.findOne({ _id: id, operatorId }).lean()
    if (!existing) return reply.code(404).send({ error: 'Person not found' })

    // Best-effort avatar cleanup
    if (existing.avatarUrl && existing.avatarUrl.startsWith('/uploads/')) {
      const __dirname = path.dirname(fileURLToPath(import.meta.url))
      const filepath = path.resolve(__dirname, '..', '..', existing.avatarUrl.replace('/uploads/', 'uploads/'))
      if (fs.existsSync(filepath)) {
        try {
          fs.unlinkSync(filepath)
        } catch {
          /* ignore */
        }
      }
    }

    await NonCrewPerson.deleteOne({ _id: id, operatorId })
    return { success: true }
  })

  // Avatar upload — mirrors operator-logo pattern
  app.post('/non-crew-people/:id/avatar', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId

    const person = await NonCrewPerson.findOne({ _id: id, operatorId }).lean()
    if (!person) return reply.code(404).send({ error: 'Person not found' })

    const file = await req.file()
    if (!file) return reply.code(400).send({ error: 'No file uploaded' })

    const ext = path.extname(file.filename).toLowerCase()
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      return reply.code(400).send({ error: 'Only JPG, PNG, or WebP files are allowed' })
    }

    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const uploadsDir = path.resolve(__dirname, '..', '..', 'uploads')
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

    const filename = `noncrew-${id}${ext}`
    const filepath = path.join(uploadsDir, filename)
    await pipeline(file.file, fs.createWriteStream(filepath))

    const avatarUrl = `/uploads/${filename}`
    await NonCrewPerson.findOneAndUpdate(
      { _id: id, operatorId },
      { $set: { avatarUrl, updatedAt: new Date().toISOString() } },
    )

    return { success: true, avatarUrl }
  })

  // Avatar delete
  app.delete('/non-crew-people/:id/avatar', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId

    const person = await NonCrewPerson.findOne({ _id: id, operatorId }).lean()
    if (!person) return reply.code(404).send({ error: 'Person not found' })

    if (person.avatarUrl && person.avatarUrl.startsWith('/uploads/')) {
      const __dirname = path.dirname(fileURLToPath(import.meta.url))
      const filepath = path.resolve(__dirname, '..', '..', person.avatarUrl.replace('/uploads/', 'uploads/'))
      if (fs.existsSync(filepath)) {
        try {
          fs.unlinkSync(filepath)
        } catch {
          /* ignore */
        }
      }
    }

    await NonCrewPerson.findOneAndUpdate(
      { _id: id, operatorId },
      { $set: { avatarUrl: null, updatedAt: new Date().toISOString() } },
    )
    return { success: true }
  })
}
