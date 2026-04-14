import crypto from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { ContactSubmission } from '../models/ContactSubmission.js'

const PayloadSchema = z.object({
  name: z.string().trim().min(1).max(200),
  company: z.string().trim().min(1).max(200),
  airline: z.string().trim().max(200).optional().default(''),
  role: z.string().trim().max(200).optional().default(''),
  email: z.string().trim().toLowerCase().email().max(320),
  phone: z.string().trim().max(50).optional().default(''),
  country: z.string().trim().max(120).optional().default(''),
  message: z.string().trim().min(10).max(5000),
  source: z.string().trim().max(120).optional().default(''),
  consent: z.literal(true, { message: 'Consent required' }),
})

// Simple in-memory rate limit: 3 submissions per IP per 60 seconds
const bucket = new Map<string, number[]>()
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 3

function rateLimit(ip: string): boolean {
  const now = Date.now()
  const entries = (bucket.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (entries.length >= MAX_PER_WINDOW) {
    bucket.set(ip, entries)
    return false
  }
  entries.push(now)
  bucket.set(ip, entries)
  return true
}

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
}

async function notifySales(doc: {
  name: string
  company: string
  email: string
  message: string
  country: string
  role: string
  airline: string
  phone: string
  source: string
  _id: unknown
}): Promise<void> {
  // Submissions are persisted in MongoDB (collection: contact_submissions).
  // Install nodemailer and set SMTP_HOST / CONTACT_NOTIFY_EMAIL to enable
  // email delivery — we keep the dependency out of the base build for now.
  const line = [
    `[contact] NEW LEAD stored id=${doc._id}`,
    `  name=${doc.name}`,
    `  company=${doc.company}${doc.airline ? ` (${doc.airline})` : ''}`,
    `  email=${doc.email}${doc.phone ? `  phone=${doc.phone}` : ''}`,
    `  role=${doc.role || '—'}  country=${doc.country || '—'}  source=${doc.source || '—'}`,
    `  message: ${doc.message.replace(/\s+/g, ' ').slice(0, 240)}${doc.message.length > 240 ? '…' : ''}`,
  ].join('\n')
  console.log(line)
}

export async function contactSubmissionRoutes(app: FastifyInstance): Promise<void> {
  app.post('/contact-submissions', async (req: FastifyRequest, reply) => {
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip
    if (!rateLimit(ip)) {
      return reply.code(429).send({ ok: false, error: 'Too many requests. Try again in a minute.' })
    }

    const parsed = PayloadSchema.safeParse(req.body)
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message
      }
      return reply.code(400).send({ ok: false, error: 'Invalid submission', fieldErrors })
    }

    const body = parsed.data

    try {
      const doc = await ContactSubmission.create({
        ...body,
        ipHash: hashIp(ip),
        userAgent: String(req.headers['user-agent'] ?? '').slice(0, 500),
      })

      // Fire-and-forget email notification — don't block the response.
      notifySales({
        name: body.name,
        company: body.company,
        email: body.email,
        message: body.message,
        country: body.country,
        role: body.role,
        airline: body.airline,
        phone: body.phone,
        source: body.source,
        _id: doc._id,
      }).catch((e) => console.error('[contact] notifySales error:', e))

      return reply.send({ ok: true, id: String(doc._id) })
    } catch (e) {
      req.log.error({ err: e }, 'contact submission failed')
      return reply.code(500).send({ ok: false, error: 'Internal error' })
    }
  })
}
