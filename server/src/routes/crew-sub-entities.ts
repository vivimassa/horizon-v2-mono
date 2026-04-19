import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { CrewMember } from '../models/CrewMember.js'
import { CrewPhone } from '../models/CrewPhone.js'
import { CrewPassport } from '../models/CrewPassport.js'
import { CrewLicense } from '../models/CrewLicense.js'
import { CrewVisa } from '../models/CrewVisa.js'
import { CrewQualification } from '../models/CrewQualification.js'
import { CrewExpiryDate } from '../models/CrewExpiryDate.js'
import { CrewGroupAssignment } from '../models/CrewGroupAssignment.js'
import { CrewBlockHours } from '../models/CrewBlockHours.js'
import { CrewOnOffPattern } from '../models/CrewOnOffPattern.js'
import { CrewAirportRestriction } from '../models/CrewAirportRestriction.js'
import { CrewPairing } from '../models/CrewPairing.js'
import { CrewRuleset } from '../models/CrewRuleset.js'
import { syncCrewExpiries } from '../services/sync-crew-expiries.js'
import {
  airportRestrictionSchema,
  blockHoursSchema,
  expiryDateUpdateSchema,
  groupAssignmentSchema,
  licenseSchema,
  onOffPatternSchema,
  pairingSchema,
  passportSchema,
  phoneSchema,
  qualificationSchema,
  qualificationUpdateSchema,
  rulesetSchema,
  visaSchema,
} from '../schemas/crew.js'

/**
 * Assert the crew member exists and is scoped to the caller's operator.
 * Returns operatorId if valid; otherwise sends a 404 and returns null.
 */
async function requireCrew(crewId: string, operatorId: string): Promise<boolean> {
  const exists = await CrewMember.exists({ _id: crewId, operatorId })
  return !!exists
}

function nowIso(): string {
  return new Date().toISOString()
}

export async function registerCrewSubEntityRoutes(app: FastifyInstance): Promise<void> {
  // ─── Phones ──────────────────────────────────────────
  app.post('/crew/:id/phones', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    if (!(await requireCrew(id, operatorId))) return reply.code(404).send({ error: 'Crew not found' })
    const parsed = phoneSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    const doc = await CrewPhone.create({
      _id: crypto.randomUUID(),
      operatorId,
      crewId: id,
      priority: parsed.data.priority ?? 1,
      type: parsed.data.type,
      number: parsed.data.number,
      smsEnabled: parsed.data.smsEnabled ?? false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    return reply.code(201).send(doc.toObject())
  })
  app.patch('/crew/:id/phones/:phoneId', async (req, reply) => {
    const { id, phoneId } = req.params as { id: string; phoneId: string }
    const operatorId = req.operatorId
    const parsed = phoneSchema.partial().safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    const doc = await CrewPhone.findOneAndUpdate(
      { _id: phoneId, crewId: id, operatorId },
      { $set: { ...parsed.data, updatedAt: nowIso() } },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Phone not found' })
    return doc
  })
  app.delete('/crew/:id/phones/:phoneId', async (req, reply) => {
    const { id, phoneId } = req.params as { id: string; phoneId: string }
    const operatorId = req.operatorId
    const r = await CrewPhone.deleteOne({ _id: phoneId, crewId: id, operatorId })
    if (r.deletedCount === 0) return reply.code(404).send({ error: 'Phone not found' })
    return { success: true }
  })

  // ─── Passports ───────────────────────────────────────
  const deactivateOtherPassports = async (crewId: string, exceptId: string) => {
    await CrewPassport.updateMany(
      { crewId, _id: { $ne: exceptId } },
      { $set: { isActive: false, updatedAt: nowIso() } },
    )
  }
  app.post('/crew/:id/passports', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    if (!(await requireCrew(id, operatorId))) return reply.code(404).send({ error: 'Crew not found' })
    const parsed = passportSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    const newId = crypto.randomUUID()
    const doc = await CrewPassport.create({
      _id: newId,
      operatorId,
      crewId: id,
      ...parsed.data,
      isActive: parsed.data.isActive ?? false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    if (doc.isActive) await deactivateOtherPassports(id, newId)
    return reply.code(201).send(doc.toObject())
  })
  app.patch('/crew/:id/passports/:passportId', async (req, reply) => {
    const { id, passportId } = req.params as { id: string; passportId: string }
    const operatorId = req.operatorId
    const parsed = passportSchema.partial().safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    const doc = await CrewPassport.findOneAndUpdate(
      { _id: passportId, crewId: id, operatorId },
      { $set: { ...parsed.data, updatedAt: nowIso() } },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Passport not found' })
    if (parsed.data.isActive === true) await deactivateOtherPassports(id, passportId)
    return doc
  })
  app.delete('/crew/:id/passports/:passportId', async (req, reply) => {
    const { id, passportId } = req.params as { id: string; passportId: string }
    const operatorId = req.operatorId
    const r = await CrewPassport.deleteOne({ _id: passportId, crewId: id, operatorId })
    if (r.deletedCount === 0) return reply.code(404).send({ error: 'Passport not found' })
    return { success: true }
  })

  // ─── Licenses ────────────────────────────────────────
  app.post('/crew/:id/licenses', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    if (!(await requireCrew(id, operatorId))) return reply.code(404).send({ error: 'Crew not found' })
    const parsed = licenseSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    const doc = await CrewLicense.create({
      _id: crypto.randomUUID(),
      operatorId,
      crewId: id,
      ...parsed.data,
      temporary: parsed.data.temporary ?? false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    return reply.code(201).send(doc.toObject())
  })
  app.patch('/crew/:id/licenses/:licenseId', async (req, reply) => {
    const { id, licenseId } = req.params as { id: string; licenseId: string }
    const operatorId = req.operatorId
    const parsed = licenseSchema.partial().safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    const doc = await CrewLicense.findOneAndUpdate(
      { _id: licenseId, crewId: id, operatorId },
      { $set: { ...parsed.data, updatedAt: nowIso() } },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'License not found' })
    return doc
  })
  app.delete('/crew/:id/licenses/:licenseId', async (req, reply) => {
    const { id, licenseId } = req.params as { id: string; licenseId: string }
    const operatorId = req.operatorId
    const r = await CrewLicense.deleteOne({ _id: licenseId, crewId: id, operatorId })
    if (r.deletedCount === 0) return reply.code(404).send({ error: 'License not found' })
    return { success: true }
  })

  // ─── Visas ───────────────────────────────────────────
  app.post('/crew/:id/visas', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    if (!(await requireCrew(id, operatorId))) return reply.code(404).send({ error: 'Crew not found' })
    const parsed = visaSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    const doc = await CrewVisa.create({
      _id: crypto.randomUUID(),
      operatorId,
      crewId: id,
      ...parsed.data,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    return reply.code(201).send(doc.toObject())
  })
  app.patch('/crew/:id/visas/:visaId', async (req, reply) => {
    const { id, visaId } = req.params as { id: string; visaId: string }
    const operatorId = req.operatorId
    const parsed = visaSchema.partial().safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    const doc = await CrewVisa.findOneAndUpdate(
      { _id: visaId, crewId: id, operatorId },
      { $set: { ...parsed.data, updatedAt: nowIso() } },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Visa not found' })
    return doc
  })
  app.delete('/crew/:id/visas/:visaId', async (req, reply) => {
    const { id, visaId } = req.params as { id: string; visaId: string }
    const operatorId = req.operatorId
    const r = await CrewVisa.deleteOne({ _id: visaId, crewId: id, operatorId })
    if (r.deletedCount === 0) return reply.code(404).send({ error: 'Visa not found' })
    return { success: true }
  })

  // ─── Qualifications ──────────────────────────────────
  app.post('/crew/:id/qualifications', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    if (!(await requireCrew(id, operatorId))) return reply.code(404).send({ error: 'Crew not found' })
    const parsed = qualificationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    const doc = await CrewQualification.create({
      _id: crypto.randomUUID(),
      operatorId,
      crewId: id,
      ...parsed.data,
      isPrimary: parsed.data.isPrimary ?? false,
      acFamilyQualified: parsed.data.acFamilyQualified ?? false,
      trainingQuals: parsed.data.trainingQuals ?? [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    await syncCrewExpiries(id, operatorId)
    return reply.code(201).send(doc.toObject())
  })
  app.patch('/crew/:id/qualifications/:qualId', async (req, reply) => {
    const { id, qualId } = req.params as { id: string; qualId: string }
    const operatorId = req.operatorId
    const parsed = qualificationUpdateSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    const doc = await CrewQualification.findOneAndUpdate(
      { _id: qualId, crewId: id, operatorId },
      { $set: { ...parsed.data, updatedAt: nowIso() } },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Qualification not found' })
    await syncCrewExpiries(id, operatorId)
    return doc
  })
  app.delete('/crew/:id/qualifications/:qualId', async (req, reply) => {
    const { id, qualId } = req.params as { id: string; qualId: string }
    const operatorId = req.operatorId
    const r = await CrewQualification.deleteOne({ _id: qualId, crewId: id, operatorId })
    if (r.deletedCount === 0) return reply.code(404).send({ error: 'Qualification not found' })
    await syncCrewExpiries(id, operatorId)
    return { success: true }
  })

  // ─── Expiry date override ────────────────────────────
  app.patch('/crew/:id/expiry-dates/:expiryId', async (req, reply) => {
    const { id, expiryId } = req.params as { id: string; expiryId: string }
    const operatorId = req.operatorId
    const parsed = expiryDateUpdateSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    const patch: Record<string, unknown> = { ...parsed.data, updatedAt: nowIso() }
    if (parsed.data.expiryDate !== undefined) patch.isManualOverride = parsed.data.expiryDate !== null
    const doc = await CrewExpiryDate.findOneAndUpdate(
      { _id: expiryId, crewId: id, operatorId },
      { $set: patch },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Expiry row not found' })
    return doc
  })

  // ─── Block hours (upsert on (aircraftType, position)) ─
  app.post('/crew/:id/block-hours', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    if (!(await requireCrew(id, operatorId))) return reply.code(404).send({ error: 'Crew not found' })
    const parsed = blockHoursSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    const doc = await CrewBlockHours.findOneAndUpdate(
      { crewId: id, operatorId, aircraftType: parsed.data.aircraftType, position: parsed.data.position },
      {
        $set: { ...parsed.data, updatedAt: nowIso() },
        $setOnInsert: { _id: crypto.randomUUID(), operatorId, crewId: id, createdAt: nowIso() },
      },
      { new: true, upsert: true },
    ).lean()
    return reply.code(201).send(doc)
  })
  app.delete('/crew/:id/block-hours/:rowId', async (req, reply) => {
    const { id, rowId } = req.params as { id: string; rowId: string }
    const operatorId = req.operatorId
    const r = await CrewBlockHours.deleteOne({ _id: rowId, crewId: id, operatorId })
    if (r.deletedCount === 0) return reply.code(404).send({ error: 'Row not found' })
    return { success: true }
  })

  // ─── On/off patterns ─────────────────────────────────
  app.post('/crew/:id/on-off-patterns', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    if (!(await requireCrew(id, operatorId))) return reply.code(404).send({ error: 'Crew not found' })
    const parsed = onOffPatternSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    const doc = await CrewOnOffPattern.create({
      _id: crypto.randomUUID(),
      operatorId,
      crewId: id,
      ...parsed.data,
      startingDay: parsed.data.startingDay ?? 0,
      createdAt: nowIso(),
    })
    return reply.code(201).send(doc.toObject())
  })
  app.delete('/crew/:id/on-off-patterns/:patternId', async (req, reply) => {
    const { id, patternId } = req.params as { id: string; patternId: string }
    const operatorId = req.operatorId
    const r = await CrewOnOffPattern.deleteOne({ _id: patternId, crewId: id, operatorId })
    if (r.deletedCount === 0) return reply.code(404).send({ error: 'Pattern not found' })
    return { success: true }
  })

  // ─── Airport restrictions ────────────────────────────
  app.post('/crew/:id/airport-restrictions', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    if (!(await requireCrew(id, operatorId))) return reply.code(404).send({ error: 'Crew not found' })
    const parsed = airportRestrictionSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    const doc = await CrewAirportRestriction.create({
      _id: crypto.randomUUID(),
      operatorId,
      crewId: id,
      ...parsed.data,
      createdAt: nowIso(),
    })
    return reply.code(201).send(doc.toObject())
  })
  app.delete('/crew/:id/airport-restrictions/:restrictionId', async (req, reply) => {
    const { id, restrictionId } = req.params as { id: string; restrictionId: string }
    const operatorId = req.operatorId
    const r = await CrewAirportRestriction.deleteOne({ _id: restrictionId, crewId: id, operatorId })
    if (r.deletedCount === 0) return reply.code(404).send({ error: 'Restriction not found' })
    return { success: true }
  })

  // ─── Pairings ────────────────────────────────────────
  app.post('/crew/:id/pairings', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    if (!(await requireCrew(id, operatorId))) return reply.code(404).send({ error: 'Crew not found' })
    const parsed = pairingSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    const doc = await CrewPairing.create({
      _id: crypto.randomUUID(),
      operatorId,
      crewId: id,
      ...parsed.data,
      createdAt: nowIso(),
    })
    return reply.code(201).send(doc.toObject())
  })
  app.delete('/crew/:id/pairings/:pairingId', async (req, reply) => {
    const { id, pairingId } = req.params as { id: string; pairingId: string }
    const operatorId = req.operatorId
    const r = await CrewPairing.deleteOne({ _id: pairingId, crewId: id, operatorId })
    if (r.deletedCount === 0) return reply.code(404).send({ error: 'Pairing not found' })
    return { success: true }
  })

  // ─── Rulesets ────────────────────────────────────────
  app.post('/crew/:id/rulesets', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    if (!(await requireCrew(id, operatorId))) return reply.code(404).send({ error: 'Crew not found' })
    const parsed = rulesetSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    const doc = await CrewRuleset.create({
      _id: crypto.randomUUID(),
      operatorId,
      crewId: id,
      ...parsed.data,
      createdAt: nowIso(),
    })
    return reply.code(201).send(doc.toObject())
  })
  app.delete('/crew/:id/rulesets/:rulesetId', async (req, reply) => {
    const { id, rulesetId } = req.params as { id: string; rulesetId: string }
    const operatorId = req.operatorId
    const r = await CrewRuleset.deleteOne({ _id: rulesetId, crewId: id, operatorId })
    if (r.deletedCount === 0) return reply.code(404).send({ error: 'Ruleset not found' })
    return { success: true }
  })

  // ─── Group assignments ───────────────────────────────
  app.post('/crew/:id/group-assignments', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    if (!(await requireCrew(id, operatorId))) return reply.code(404).send({ error: 'Crew not found' })
    const parsed = groupAssignmentSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    try {
      const doc = await CrewGroupAssignment.create({
        _id: crypto.randomUUID(),
        operatorId,
        crewId: id,
        ...parsed.data,
        createdAt: nowIso(),
      })
      return reply.code(201).send(doc.toObject())
    } catch (err) {
      const e = err as { code?: number }
      if (e.code === 11000) return reply.code(409).send({ error: 'Already assigned to this group' })
      throw err
    }
  })
  app.delete('/crew/:id/group-assignments/:assignmentId', async (req, reply) => {
    const { id, assignmentId } = req.params as { id: string; assignmentId: string }
    const operatorId = req.operatorId
    const r = await CrewGroupAssignment.deleteOne({ _id: assignmentId, crewId: id, operatorId })
    if (r.deletedCount === 0) return reply.code(404).send({ error: 'Assignment not found' })
    return { success: true }
  })
}
