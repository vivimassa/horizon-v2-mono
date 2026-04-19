import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import type { FastifyInstance } from 'fastify'
import { CrewMember } from '../models/CrewMember.js'
import { CrewPhone } from '../models/CrewPhone.js'
import { CrewPassport } from '../models/CrewPassport.js'
import { CrewLicense } from '../models/CrewLicense.js'
import { CrewVisa } from '../models/CrewVisa.js'
import { CrewQualification } from '../models/CrewQualification.js'
import { CrewExpiryDate } from '../models/CrewExpiryDate.js'
import { CrewGroupAssignment } from '../models/CrewGroupAssignment.js'
import { CrewGroup } from '../models/CrewGroup.js'
import { CrewBlockHours } from '../models/CrewBlockHours.js'
import { CrewOnOffPattern } from '../models/CrewOnOffPattern.js'
import { CrewAirportRestriction } from '../models/CrewAirportRestriction.js'
import { CrewPairing } from '../models/CrewPairing.js'
import { CrewRuleset } from '../models/CrewRuleset.js'
import { ExpiryCode, ExpiryCodeCategory } from '../models/ExpiryCode.js'
import { Airport } from '../models/Airport.js'
import { crewMemberCreateSchema, crewMemberUpdateSchema } from '../schemas/crew.js'
import { computeExpiryStatus, syncCrewExpiries } from '../services/sync-crew-expiries.js'
import { registerCrewSubEntityRoutes } from './crew-sub-entities.js'

export async function crewRoutes(app: FastifyInstance): Promise<void> {
  // ─── List ─────────────────────────────────────────────
  app.get('/crew', async (req) => {
    const operatorId = req.operatorId
    const q = req.query as {
      base?: string
      position?: string
      status?: string
      aircraftType?: string
      search?: string
      groupId?: string
    }

    const filter: Record<string, unknown> = { operatorId }
    if (q.base) filter.base = q.base
    if (q.position) filter.position = q.position
    if (q.status) filter.status = q.status

    // If filtering by aircraftType, pre-resolve crew IDs from qualifications
    if (q.aircraftType) {
      const quals = await CrewQualification.find({ operatorId, aircraftType: q.aircraftType }, { crewId: 1 }).lean()
      filter._id = { $in: quals.map((x) => x.crewId) }
    }
    // If filtering by groupId, pre-resolve crew IDs from assignments
    if (q.groupId) {
      const assigns = await CrewGroupAssignment.find({ operatorId, groupId: q.groupId }, { crewId: 1 }).lean()
      const ids = assigns.map((x) => x.crewId)
      filter._id = filter._id
        ? { $in: (filter._id as { $in: string[] }).$in.filter((id) => ids.includes(id)) }
        : { $in: ids }
    }

    const docs = await CrewMember.find(filter).sort({ seniority: 1, lastName: 1, firstName: 1 }).lean()

    const crewIds = docs.map((d) => d._id as string)
    const [allQuals, allExpiries, baseAirports] = await Promise.all([
      CrewQualification.find({ crewId: { $in: crewIds } }, { crewId: 1, aircraftType: 1 }).lean(),
      CrewExpiryDate.find({ crewId: { $in: crewIds } }).lean(),
      Airport.find({ _id: { $in: docs.map((d) => d.base).filter(Boolean) } }, { _id: 1, iataCode: 1 }).lean(),
    ])
    const codes = await ExpiryCode.find({ operatorId, isActive: true }).lean()
    const codeMap = new Map(codes.map((c) => [c._id as string, c]))
    const baseLabel = new Map(baseAirports.map((a) => [a._id as string, a.iataCode]))

    // Aggregate ac types & alert count per crew
    const acByCrew = new Map<string, Set<string>>()
    for (const q of allQuals) {
      if (!acByCrew.has(q.crewId)) acByCrew.set(q.crewId, new Set())
      if (q.aircraftType) acByCrew.get(q.crewId)!.add(q.aircraftType)
    }
    const alertByCrew = new Map<string, number>()
    for (const e of allExpiries) {
      const status = computeExpiryStatus(e.expiryDate, codeMap.get(e.expiryCodeId)?.warningDays ?? null)
      if (status === 'warning' || status === 'expired') {
        alertByCrew.set(e.crewId, (alertByCrew.get(e.crewId) ?? 0) + 1)
      }
    }

    let results = docs.map((d) => ({
      ...d,
      acTypes: Array.from(acByCrew.get(d._id as string) ?? []).sort(),
      expiryAlertCount: alertByCrew.get(d._id as string) ?? 0,
      baseLabel: d.base ? (baseLabel.get(d.base) ?? null) : null,
    }))

    if (q.search && q.search.trim().length > 0) {
      const needle = q.search.trim().toLowerCase()
      results = results.filter((d) => {
        const full = `${d.firstName} ${d.middleName ?? ''} ${d.lastName}`.toLowerCase()
        return (
          full.includes(needle) ||
          d.employeeId.toLowerCase().includes(needle) ||
          (d.shortCode ?? '').toLowerCase().includes(needle)
        )
      })
    }

    return results
  })

  // ─── Full profile ─────────────────────────────────────
  app.get('/crew/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId

    const member = await CrewMember.findOne({ _id: id, operatorId }).lean()
    if (!member) return reply.code(404).send({ error: 'Crew member not found' })

    const [
      phones,
      passports,
      licenses,
      visas,
      qualifications,
      expiryDates,
      groupAssignments,
      rulesets,
      onOffPatterns,
      airportRestrictions,
      pairings,
      blockHours,
      codes,
      categories,
      baseAirport,
    ] = await Promise.all([
      CrewPhone.find({ crewId: id }).sort({ priority: 1 }).lean(),
      CrewPassport.find({ crewId: id }).lean(),
      CrewLicense.find({ crewId: id }).lean(),
      CrewVisa.find({ crewId: id }).lean(),
      CrewQualification.find({ crewId: id }).sort({ isPrimary: -1, startDate: -1 }).lean(),
      CrewExpiryDate.find({ crewId: id }).lean(),
      CrewGroupAssignment.find({ crewId: id }).lean(),
      CrewRuleset.find({ crewId: id }).sort({ startDate: -1 }).lean(),
      CrewOnOffPattern.find({ crewId: id }).sort({ startDate: -1 }).lean(),
      CrewAirportRestriction.find({ crewId: id }).lean(),
      CrewPairing.find({ crewId: id }).lean(),
      CrewBlockHours.find({ crewId: id }).lean(),
      ExpiryCode.find({ operatorId }).lean(),
      ExpiryCodeCategory.find({ operatorId }).lean(),
      member.base ? Airport.findOne({ _id: member.base }, { iataCode: 1 }).lean() : null,
    ])

    const codeMap = new Map(codes.map((c) => [c._id as string, c]))
    const catMap = new Map(categories.map((c) => [c._id as string, c]))

    const expiryDatesFull = expiryDates.map((e) => {
      const code = codeMap.get(e.expiryCodeId)
      const cat = code ? catMap.get(code.categoryId) : null
      return {
        ...e,
        codeLabel: code?.code ?? '??',
        codeName: code?.name ?? 'Unknown',
        categoryKey: cat?.key ?? 'other',
        categoryLabel: cat?.label ?? 'Other',
        categoryColor: cat?.color ?? '#888888',
        status: computeExpiryStatus(e.expiryDate, code?.warningDays ?? null),
      }
    })

    // Group names + paired crew names
    const groupIds = groupAssignments.map((g) => g.groupId)
    const pairedIds = pairings.map((p) => p.pairedCrewId)
    const [groups, pairedCrew] = await Promise.all([
      CrewGroup.find({ _id: { $in: groupIds } }).lean(),
      CrewMember.find({ _id: { $in: pairedIds } }, { firstName: 1, lastName: 1, employeeId: 1 }).lean(),
    ])
    const groupNameById = new Map(groups.map((g) => [g._id as string, g.name]))
    const pairedNameById = new Map(pairedCrew.map((c) => [c._id as string, `${c.firstName} ${c.lastName}`]))

    return {
      member,
      baseLabel: baseAirport?.iataCode ?? null,
      phones,
      passports,
      licenses,
      visas,
      qualifications,
      expiryDates: expiryDatesFull,
      groupAssignments: groupAssignments.map((a) => ({ ...a, groupName: groupNameById.get(a.groupId) ?? '' })),
      rulesets,
      onOffPatterns,
      airportRestrictions,
      pairings: pairings.map((p) => ({ ...p, pairedCrewName: pairedNameById.get(p.pairedCrewId) ?? '' })),
      blockHours,
    }
  })

  // ─── Create ───────────────────────────────────────────
  app.post('/crew', async (req, reply) => {
    const operatorId = req.operatorId
    const parsed = crewMemberCreateSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const existing = await CrewMember.findOne({ operatorId, employeeId: parsed.data.employeeId }).lean()
    if (existing) {
      return reply.code(409).send({ error: `Employee ID "${parsed.data.employeeId}" already exists` })
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const doc = await CrewMember.create({
      _id: id,
      operatorId,
      ...parsed.data,
      createdAt: now,
      updatedAt: now,
    })
    await syncCrewExpiries(id, operatorId)
    return reply.code(201).send(doc.toObject())
  })

  // ─── Update ───────────────────────────────────────────
  app.patch('/crew/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const parsed = crewMemberUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const prior = await CrewMember.findOne({ _id: id, operatorId }).lean()
    if (!prior) return reply.code(404).send({ error: 'Crew member not found' })

    const doc = await CrewMember.findOneAndUpdate(
      { _id: id, operatorId },
      { $set: { ...parsed.data, updatedAt: new Date().toISOString() } },
      { new: true },
    ).lean()

    // If position changed, re-sync expiry set
    if (parsed.data.position !== undefined && parsed.data.position !== prior.position) {
      await syncCrewExpiries(id, operatorId)
    }

    return doc
  })

  // ─── Soft delete ──────────────────────────────────────
  app.delete('/crew/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const existing = await CrewMember.findOne({ _id: id, operatorId }).lean()
    if (!existing) return reply.code(404).send({ error: 'Crew member not found' })
    await CrewMember.findOneAndUpdate(
      { _id: id, operatorId },
      {
        $set: {
          status: 'terminated',
          exitDate: new Date().toISOString().slice(0, 10),
          updatedAt: new Date().toISOString(),
        },
      },
    )
    return { success: true }
  })

  // ─── Sync expiries explicitly ─────────────────────────
  app.post('/crew/:id/sync-expiries', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const existing = await CrewMember.findOne({ _id: id, operatorId }).lean()
    if (!existing) return reply.code(404).send({ error: 'Crew member not found' })
    await syncCrewExpiries(id, operatorId)
    return { success: true }
  })

  // ─── Avatar upload ────────────────────────────────────
  app.post('/crew/:id/avatar', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId

    const person = await CrewMember.findOne({ _id: id, operatorId }).lean()
    if (!person) return reply.code(404).send({ error: 'Crew member not found' })

    const file = await req.file()
    if (!file) return reply.code(400).send({ error: 'No file uploaded' })

    const ext = path.extname(file.filename).toLowerCase()
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      return reply.code(400).send({ error: 'Only JPG, PNG, or WebP files are allowed' })
    }

    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const uploadsDir = path.resolve(__dirname, '..', '..', 'uploads')
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

    const filename = `crew-${id}${ext}`
    const filepath = path.join(uploadsDir, filename)
    await pipeline(file.file, fs.createWriteStream(filepath))

    const photoUrl = `/uploads/${filename}`
    await CrewMember.findOneAndUpdate(
      { _id: id, operatorId },
      { $set: { photoUrl, updatedAt: new Date().toISOString() } },
    )
    return { success: true, photoUrl, avatarUrl: photoUrl }
  })

  app.delete('/crew/:id/avatar', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const person = await CrewMember.findOne({ _id: id, operatorId }).lean()
    if (!person) return reply.code(404).send({ error: 'Crew member not found' })

    if (person.photoUrl && person.photoUrl.startsWith('/uploads/')) {
      const __dirname = path.dirname(fileURLToPath(import.meta.url))
      const filepath = path.resolve(__dirname, '..', '..', person.photoUrl.replace('/uploads/', 'uploads/'))
      if (fs.existsSync(filepath)) {
        try {
          fs.unlinkSync(filepath)
        } catch {
          /* ignore */
        }
      }
    }
    await CrewMember.findOneAndUpdate(
      { _id: id, operatorId },
      { $set: { photoUrl: null, updatedAt: new Date().toISOString() } },
    )
    return { success: true }
  })

  // Sub-entity CRUD (phones, passports, licenses, visas, qualifications, expiries,
  // block hours, patterns, restrictions, pairings, rulesets, group assignments)
  await registerCrewSubEntityRoutes(app)
}
