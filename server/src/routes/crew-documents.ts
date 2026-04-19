import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { CrewDocument } from '../models/CrewDocument.js'
import { CrewExpiryDate } from '../models/CrewExpiryDate.js'
import {
  CrewDocumentFolder,
  FOLDER_EXPIRY_CATEGORIES,
  SYSTEM_FOLDER_SLUGS,
  type SystemFolderSlug,
} from '../models/CrewDocumentFolder.js'
import { CrewMember } from '../models/CrewMember.js'
import { Airport } from '../models/Airport.js'
import { CrewPosition } from '../models/CrewPosition.js'
import { CrewGroupAssignment } from '../models/CrewGroupAssignment.js'
import { ExpiryCode, ExpiryCodeCategory } from '../models/ExpiryCode.js'
import { ensureSystemFolders } from '../services/ensure-crew-document-folders.js'
import {
  persistUploadedCrewDocument,
  deleteCrewDocument as deleteDocService,
  type UploadExtras,
} from '../services/crew-document-service.js'
import { createSubfolderSchema, uploadExtrasSchema } from '../schemas/crew-documents.js'

export async function crewDocumentsRoutes(app: FastifyInstance): Promise<void> {
  // ─── Folder list ─────────────────────────────────────────
  // GET /crew/:crewId/document-folders?parentId=<optional>
  //   null/undefined parentId → return the 4 system roots for the operator,
  //   each with document+subfolder counts for the specific crew member.
  //   parentId set → if the parent is a system folder whose slug has a
  //   mapped expiry category, return *virtual* sub-folders from ExpiryCode.
  //   Otherwise return real DB sub-folders.
  app.get('/crew/:crewId/document-folders', async (req, reply) => {
    const { crewId } = req.params as { crewId: string }
    const { parentId } = req.query as { parentId?: string }
    const operatorId = req.operatorId

    // Ensure the crew exists under this operator — enforces tenancy.
    const member = await CrewMember.exists({ _id: crewId, operatorId })
    if (!member) return reply.code(404).send({ error: 'Crew not found' })

    // Make sure the 4 system folders are seeded for this operator.
    await ensureSystemFolders(operatorId)

    if (!parentId) {
      const systemFolders = await CrewDocumentFolder.find({
        operatorId,
        parentId: null,
        isSystem: true,
      })
        .sort({ sortOrder: 1 })
        .lean()

      const userRootFolders = await CrewDocumentFolder.find({
        operatorId,
        parentId: null,
        isSystem: false,
      })
        .sort({ sortOrder: 1, name: 1 })
        .lean()

      const categories = await ExpiryCodeCategory.find({ operatorId }).lean()
      const categoriesByKey = new Map(categories.map((c) => [c.key, c._id as string]))

      const roots = [...systemFolders, ...userRootFolders]
      const rootDocCounts = await countDocsPerFolder(
        crewId,
        roots.map((f) => f._id as string),
      )

      const result = await Promise.all(
        roots.map(async (f) => {
          let subfolderCount = 0
          if (f.isSystem && FOLDER_EXPIRY_CATEGORIES[f.slug as SystemFolderSlug]) {
            const keys = FOLDER_EXPIRY_CATEGORIES[f.slug as SystemFolderSlug]
            const categoryIds = keys.map((k) => categoriesByKey.get(k)).filter(Boolean) as string[]
            if (categoryIds.length > 0) {
              subfolderCount = await ExpiryCode.countDocuments({
                operatorId,
                isActive: true,
                categoryId: { $in: categoryIds },
              })
            }
          } else {
            subfolderCount = await CrewDocumentFolder.countDocuments({
              operatorId,
              parentId: f._id,
            })
          }
          return {
            ...f,
            documentCount: rootDocCounts.get(f._id as string) ?? 0,
            subfolderCount,
            isVirtual: false,
          }
        }),
      )
      return result
    }

    // Sub-folder fetch.
    const parent = await CrewDocumentFolder.findOne({ _id: parentId, operatorId }).lean()
    if (!parent) return reply.code(404).send({ error: 'Parent folder not found' })

    const categoryKeys = FOLDER_EXPIRY_CATEGORIES[parent.slug as SystemFolderSlug] ?? []
    if (parent.isSystem && categoryKeys.length > 0) {
      // Virtual sub-folders from expiry codes.
      const categories = await ExpiryCodeCategory.find({
        operatorId,
        key: { $in: categoryKeys },
      }).lean()
      const categoryIds = categories.map((c) => c._id as string)
      if (categoryIds.length === 0) return []
      const codes = await ExpiryCode.find({
        operatorId,
        isActive: true,
        categoryId: { $in: categoryIds },
      })
        .sort({ sortOrder: 1, code: 1 })
        .lean()

      const codeIds = codes.map((c) => c._id as string)
      const codeDocCounts = codeIds.length
        ? await CrewDocument.aggregate([
            { $match: { crewId, operatorId, expiryCodeId: { $in: codeIds } } },
            { $group: { _id: '$expiryCodeId', n: { $sum: 1 } } },
          ])
        : []
      const byCode = new Map<string, number>(codeDocCounts.map((r) => [r._id as string, r.n as number]))

      return codes.map((c) => ({
        _id: c._id as string,
        operatorId,
        parentId: parent._id,
        name: c.name,
        slug: c.code,
        isSystem: true,
        isVirtual: true,
        sortOrder: c.sortOrder ?? 0,
        createdAt: c.createdAt ?? null,
        updatedAt: c.updatedAt ?? null,
        documentCount: byCode.get(c._id as string) ?? 0,
        subfolderCount: 0,
        expiryCodeId: c._id as string,
        expiryCategoryKey: categories.find((cat) => (cat._id as string) === c.categoryId)?.key ?? null,
      }))
    }

    // Real DB sub-folders.
    const subs = await CrewDocumentFolder.find({ operatorId, parentId: parent._id })
      .sort({ sortOrder: 1, name: 1 })
      .lean()
    const docCounts = await countDocsPerFolder(
      crewId,
      subs.map((s) => s._id as string),
    )
    return subs.map((s) => ({
      ...s,
      documentCount: docCounts.get(s._id as string) ?? 0,
      subfolderCount: 0,
      isVirtual: false,
    }))
  })

  // ─── Create user sub-folder ──────────────────────────────
  app.post('/crew/:crewId/document-folders', async (req, reply) => {
    const operatorId = req.operatorId
    const parsed = createSubfolderSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    const parent = await CrewDocumentFolder.findOne({
      _id: parsed.data.parentId,
      operatorId,
    }).lean()
    if (!parent) return reply.code(404).send({ error: 'Parent folder not found' })
    if (FOLDER_EXPIRY_CATEGORIES[parent.slug as SystemFolderSlug]?.length) {
      return reply.code(400).send({ error: 'Cannot create sub-folders under a virtual-subfolder parent' })
    }
    const now = new Date().toISOString()
    const doc = await CrewDocumentFolder.create({
      _id: crypto.randomUUID(),
      operatorId,
      parentId: parsed.data.parentId,
      name: parsed.data.name,
      slug: parsed.data.name.replace(/\s+/g, '-').toLowerCase(),
      isSystem: false,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    })
    return reply.code(201).send(doc.toObject())
  })

  // ─── List documents ──────────────────────────────────────
  app.get('/crew/:crewId/documents', async (req, reply) => {
    const { crewId } = req.params as { crewId: string }
    const { folderId, expiryCodeId } = req.query as { folderId?: string; expiryCodeId?: string }
    const operatorId = req.operatorId
    const member = await CrewMember.exists({ _id: crewId, operatorId })
    if (!member) return reply.code(404).send({ error: 'Crew not found' })

    const filter: Record<string, unknown> = { crewId, operatorId }
    if (folderId) filter.folderId = folderId
    if (expiryCodeId) filter.expiryCodeId = expiryCodeId
    return CrewDocument.find(filter).sort({ uploadedAt: -1 }).lean()
  })

  // ─── Upload ──────────────────────────────────────────────
  app.post('/crew/:crewId/documents', async (req, reply) => {
    const { crewId } = req.params as { crewId: string }
    const operatorId = req.operatorId
    const member = await CrewMember.exists({ _id: crewId, operatorId })
    if (!member) return reply.code(404).send({ error: 'Crew not found' })

    const mp = await req.file()
    if (!mp) return reply.code(400).send({ error: 'No file uploaded' })

    // Multipart fields come back as AsyncIterable on .fields in @fastify/multipart,
    // but when using req.file() the non-file fields are on mp.fields.
    const raw: Record<string, string | null | undefined> = {}
    for (const [key, value] of Object.entries(mp.fields ?? {})) {
      if (!value) continue
      // Field can be an array or a single field — pick first scalar.
      const entry = Array.isArray(value) ? value[0] : value
      if (entry && typeof entry === 'object' && 'value' in entry) {
        raw[key] = (entry as { value: string }).value || null
      }
    }

    const parsed = uploadExtrasSchema.safeParse({
      folderId: raw.folderId ?? '',
      expiryCodeId: raw.expiryCodeId || null,
      description: raw.description || null,
      lastDone: raw.lastDone || null,
      expiryDate: raw.expiryDate || null,
    })
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })

    const extras: UploadExtras = {
      folderId: parsed.data.folderId,
      expiryCodeId: parsed.data.expiryCodeId ?? null,
      description: parsed.data.description ?? null,
      lastDone: parsed.data.lastDone ?? null,
      expiryDate: parsed.data.expiryDate ?? null,
    }

    try {
      const uploadedBy = (req.user as { _id?: string } | undefined)?._id ?? null
      const result = await persistUploadedCrewDocument(mp, {
        crewId,
        operatorId,
        uploadedBy,
        extras,
      })
      return reply.code(201).send(result)
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message })
    }
  })

  // ─── Delete ──────────────────────────────────────────────
  app.delete('/crew/:crewId/documents/:docId', async (req, reply) => {
    const { crewId, docId } = req.params as { crewId: string; docId: string }
    const operatorId = req.operatorId
    const doc = await CrewDocument.findOne({ _id: docId, crewId, operatorId }).lean()
    if (!doc) return reply.code(404).send({ error: 'Document not found' })
    await deleteDocService({ docId, crewId, operatorId })
    return { success: true }
  })

  // ─── Right-pane status list ──────────────────────────────
  // GET /crew-document-status — paginated list of crew with coverage summary,
  // respecting the same filters as /crew. Multi-select `documentStatus` is
  // accepted as a comma-separated list. `expiryFrom`/`expiryTo` narrow the
  // list to crew whose soonest training expiry falls in that range.
  app.get('/crew-document-status', async (req, reply) => {
    const operatorId = req.operatorId
    const q = req.query as {
      base?: string
      position?: string
      status?: string
      groupId?: string
      documentStatus?: string // comma-separated
      expiryFrom?: string // ISO YYYY-MM-DD
      expiryTo?: string
      search?: string
    }
    const documentStatusList = q.documentStatus
      ? q.documentStatus
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []

    // Reuse the same crew filter shape as GET /crew.
    const crewFilter: Record<string, unknown> = { operatorId }
    if (q.base) crewFilter.base = q.base
    if (q.position) crewFilter.position = q.position
    if (q.status) crewFilter.status = q.status
    if (q.groupId) {
      const assigns = await CrewGroupAssignment.find({ operatorId, groupId: q.groupId }, { crewId: 1 }).lean()
      crewFilter._id = { $in: assigns.map((x) => x.crewId) }
    }

    const crewDocs = await CrewMember.find(crewFilter).sort({ seniority: 1, lastName: 1, firstName: 1 }).lean()
    const crewIds = crewDocs.map((c) => c._id as string)

    // Fetch all documents for this cohort in one sweep.
    const docs = crewIds.length
      ? await CrewDocument.find(
          { operatorId, crewId: { $in: crewIds } },
          {
            crewId: 1,
            folderId: 1,
            expiryCodeId: 1,
            documentType: 1,
          },
        ).lean()
      : []

    // Resolve folder slugs so we can classify docs.
    const folderIds = Array.from(new Set(docs.map((d) => d.folderId)))
    const folders = folderIds.length
      ? await CrewDocumentFolder.find({ _id: { $in: folderIds } }, { slug: 1 }).lean()
      : []
    const folderSlug = new Map<string, string>(folders.map((f) => [f._id as string, f.slug]))

    // Training/recency code ids — for hasTraining
    const trainingCategories = await ExpiryCodeCategory.find({
      operatorId,
      key: { $in: FOLDER_EXPIRY_CATEGORIES[SYSTEM_FOLDER_SLUGS.TRAINING_DOCUMENTS] },
    }).lean()
    const trainingCategoryIds = new Set(trainingCategories.map((c) => c._id as string))
    const trainingCodes = trainingCategoryIds.size
      ? await ExpiryCode.find({ operatorId, categoryId: { $in: Array.from(trainingCategoryIds) } }, { _id: 1 }).lean()
      : []
    const trainingCodeIds = new Set(trainingCodes.map((c) => c._id as string))

    // Aggregate per-crew flags.
    type Flags = { hasPhoto: boolean; hasPassport: boolean; hasMedical: boolean; hasTraining: boolean }
    const flagsByCrew = new Map<string, Flags>()
    for (const c of crewIds) {
      flagsByCrew.set(c, { hasPhoto: false, hasPassport: false, hasMedical: false, hasTraining: false })
    }
    for (const d of docs) {
      const f = flagsByCrew.get(d.crewId)
      if (!f) continue
      const slug = folderSlug.get(d.folderId)
      if (slug === SYSTEM_FOLDER_SLUGS.CREW_PHOTOS || d.documentType === 'photo') f.hasPhoto = true
      if (slug === SYSTEM_FOLDER_SLUGS.PASSPORTS) f.hasPassport = true
      if (slug === SYSTEM_FOLDER_SLUGS.MEDICAL_CERTIFICATES) f.hasMedical = true
      if (d.expiryCodeId && trainingCodeIds.has(d.expiryCodeId)) f.hasTraining = true
    }

    // Training expiry rollup per crew — drives the soonest-expiry column
    // and lets the client filter by an expiry date range.
    const expiryRows =
      crewIds.length && trainingCodeIds.size
        ? await CrewExpiryDate.find(
            { operatorId, crewId: { $in: crewIds }, expiryCodeId: { $in: Array.from(trainingCodeIds) } },
            { crewId: 1, expiryCodeId: 1, expiryDate: 1 },
          ).lean()
        : []
    const codeWarningDays = new Map<string, number>()
    for (const c of trainingCodes)
      codeWarningDays.set(c._id as string, (c as { warningDays?: number | null }).warningDays ?? 90)
    const today = new Date()
    type ExpirySummary = { soonest: string | null; expiredCount: number; warningCount: number }
    const expiryByCrew = new Map<string, ExpirySummary>()
    for (const id of crewIds) expiryByCrew.set(id, { soonest: null, expiredCount: 0, warningCount: 0 })
    for (const e of expiryRows) {
      if (!e.expiryDate) continue
      const entry = expiryByCrew.get(e.crewId)
      if (!entry) continue
      if (!entry.soonest || e.expiryDate < entry.soonest) entry.soonest = e.expiryDate
      const days = (new Date(e.expiryDate).getTime() - today.getTime()) / 86_400_000
      const warn = codeWarningDays.get(e.expiryCodeId) ?? 90
      if (days < 0) entry.expiredCount += 1
      else if (days <= warn) entry.warningCount += 1
    }

    // Resolve base airports for label
    const baseIds = crewDocs.map((c) => c.base).filter(Boolean) as string[]
    const bases = baseIds.length ? await Airport.find({ _id: { $in: baseIds } }, { _id: 1, iataCode: 1 }).lean() : []
    const baseLabel = new Map<string, string | null>(bases.map((b) => [b._id as string, b.iataCode ?? null]))
    const positionDocs = await CrewPosition.find({ operatorId }, { _id: 1, code: 1 }).lean()
    const positionCode = new Map<string, string>(positionDocs.map((p) => [p._id as string, p.code]))

    let results = crewDocs.map((c) => {
      const id = c._id as string
      const flags = flagsByCrew.get(id) ?? {
        hasPhoto: false,
        hasPassport: false,
        hasMedical: false,
        hasTraining: false,
      }
      const coverage = Math.round(
        ([flags.hasPhoto, flags.hasPassport, flags.hasMedical, flags.hasTraining].filter(Boolean).length / 4) * 100,
      )
      const summary = expiryByCrew.get(id) ?? { soonest: null, expiredCount: 0, warningCount: 0 }
      return {
        _id: id,
        employeeId: c.employeeId,
        firstName: c.firstName,
        middleName: c.middleName,
        lastName: c.lastName,
        position: c.position ? (positionCode.get(c.position) ?? null) : null,
        status: c.status,
        photoUrl: c.photoUrl ?? null,
        baseLabel: c.base ? (baseLabel.get(c.base) ?? null) : null,
        hasPhoto: flags.hasPhoto,
        hasPassport: flags.hasPassport,
        hasMedical: flags.hasMedical,
        hasTraining: flags.hasTraining,
        coverage,
        soonestTrainingExpiry: summary.soonest,
        expiredTrainingCount: summary.expiredCount,
        warningTrainingCount: summary.warningCount,
      }
    })

    if (q.search && q.search.trim()) {
      const needle = q.search.trim().toLowerCase()
      results = results.filter((r) => {
        const full = `${r.firstName} ${r.middleName ?? ''} ${r.lastName}`.toLowerCase()
        return full.includes(needle) || r.employeeId.toLowerCase().includes(needle)
      })
    }

    if (documentStatusList.length > 0) {
      // OR-semantics across multiple status buckets.
      results = results.filter((r) =>
        documentStatusList.some((key) => {
          switch (key) {
            case 'missing_photo':
              return !r.hasPhoto
            case 'missing_passport':
              return !r.hasPassport
            case 'missing_medical':
              return !r.hasMedical
            case 'missing_training':
              return !r.hasTraining
            case 'complete':
              return r.hasPhoto && r.hasPassport && r.hasMedical && r.hasTraining
            default:
              return false
          }
        }),
      )
    }

    if (q.expiryFrom || q.expiryTo) {
      const from = q.expiryFrom ?? null
      const to = q.expiryTo ?? null
      results = results.filter((r) => {
        if (!r.soonestTrainingExpiry) return false
        if (from && r.soonestTrainingExpiry < from) return false
        if (to && r.soonestTrainingExpiry > to) return false
        return true
      })
    }

    return results
  })
}

// Helper — count documents per folderId for a single crew.
async function countDocsPerFolder(crewId: string, folderIds: string[]): Promise<Map<string, number>> {
  if (folderIds.length === 0) return new Map()
  const agg = await CrewDocument.aggregate([
    { $match: { crewId, folderId: { $in: folderIds } } },
    { $group: { _id: '$folderId', n: { $sum: 1 } } },
  ])
  return new Map(agg.map((r) => [r._id as string, r.n as number]))
}
