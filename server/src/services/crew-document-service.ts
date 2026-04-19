import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import type { MultipartFile } from '@fastify/multipart'
import { CrewDocument } from '../models/CrewDocument.js'
import { CrewDocumentFolder, SYSTEM_FOLDER_SLUGS } from '../models/CrewDocumentFolder.js'
import { CrewExpiryDate } from '../models/CrewExpiryDate.js'
import { CrewMember } from '../models/CrewMember.js'
import { syncCrewExpiries } from './sync-crew-expiries.js'

const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf']
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx']

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads')

export interface UploadExtras {
  folderId: string
  expiryCodeId: string | null
  description: string | null
  lastDone: string | null
  expiryDate: string | null
}

export interface UploadResult {
  document: Record<string, unknown>
  updatedExpiry: Record<string, unknown> | null
}

/**
 * Accept a multipart file and persist it. Enforces:
 *  - folder exists and is owned by the operator
 *  - photo folder: one-per-crew (previous doc + file deleted)
 *  - if expiryCodeId is set and lastDone/expiryDate provided, upsert
 *    `CrewExpiryDate` and run `syncCrewExpiries` so fixed-validity formulas
 *    recompute derived expiries
 */
export async function persistUploadedCrewDocument(
  file: MultipartFile,
  opts: {
    crewId: string
    operatorId: string
    uploadedBy: string | null
    extras: UploadExtras
  },
): Promise<UploadResult> {
  const { crewId, operatorId, uploadedBy, extras } = opts

  // Validate folder
  const folder = await CrewDocumentFolder.findOne({ _id: extras.folderId, operatorId }).lean()
  if (!folder) throw new Error('Folder not found')

  // Validate file type
  const ext = path.extname(file.filename).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`Unsupported file type: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`)
  }
  const mimeType = file.mimetype || null
  if (mimeType && !ALLOWED_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) {
    // Accept application/msword and excel variants too — just warn on other types
    if (!/(word|excel|spreadsheet|msword)/i.test(mimeType)) {
      throw new Error(`Unsupported MIME type: ${mimeType}`)
    }
  }

  const isPhotoFolder = folder.slug === SYSTEM_FOLDER_SLUGS.CREW_PHOTOS
  const isPassportFolder = folder.slug === SYSTEM_FOLDER_SLUGS.PASSPORTS && !extras.expiryCodeId

  // Enforce one-per-crew for photo folder; wipe any prior doc + file.
  if (isPhotoFolder || isPassportFolder) {
    const prior = await CrewDocument.find({
      crewId,
      operatorId,
      folderId: extras.folderId,
      ...(isPassportFolder ? { expiryCodeId: null } : {}),
    }).lean()
    for (const d of prior) {
      const abs = path.resolve(UPLOADS_DIR, d.storagePath)
      if (fs.existsSync(abs)) {
        try {
          fs.unlinkSync(abs)
        } catch {
          /* ignore — best effort */
        }
      }
    }
    await CrewDocument.deleteMany({
      _id: { $in: prior.map((d) => d._id as string) },
    })
  }

  // Compute destination path
  const docId = crypto.randomUUID()
  const relDir = path.posix.join('crew-documents', operatorId, crewId)
  const absDir = path.resolve(UPLOADS_DIR, relDir)
  if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true })
  const storedName = `${docId}${ext}`
  const relPath = path.posix.join(relDir, storedName)
  const absPath = path.resolve(UPLOADS_DIR, relPath)
  await pipeline(file.file, fs.createWriteStream(absPath))

  // Determine documentType from folder slug and expiry code
  const documentType: 'photo' | 'passport' | 'license' | 'medical' | 'training' | 'other' =
    folder.slug === SYSTEM_FOLDER_SLUGS.CREW_PHOTOS
      ? 'photo'
      : folder.slug === SYSTEM_FOLDER_SLUGS.PASSPORTS
        ? 'passport'
        : folder.slug === SYSTEM_FOLDER_SLUGS.MEDICAL_CERTIFICATES
          ? 'medical'
          : folder.slug === SYSTEM_FOLDER_SLUGS.TRAINING_DOCUMENTS
            ? 'training'
            : 'other'

  // Read file size after write (Fastify stream does not expose size up front)
  let fileSize = 0
  try {
    fileSize = fs.statSync(absPath).size
  } catch {
    /* ignore */
  }

  const now = new Date().toISOString()
  const created = await CrewDocument.create({
    _id: docId,
    operatorId,
    crewId,
    folderId: extras.folderId,
    expiryCodeId: extras.expiryCodeId,
    documentType,
    fileName: file.filename,
    storagePath: relPath,
    fileUrl: `/uploads/${relPath}`,
    fileSize,
    mimeType,
    description: extras.description,
    uploadedAt: now,
    uploadedBy,
    createdAt: now,
    updatedAt: now,
  })

  // Mirror photo URL onto the crew member so Crew Profile avatars stay in sync.
  if (isPhotoFolder) {
    await CrewMember.findOneAndUpdate(
      { _id: crewId, operatorId },
      { $set: { photoUrl: `/uploads/${relPath}`, updatedAt: now } },
    )
  }

  // Smart linkage to CrewExpiryDate — only when the doc lives in a virtual
  // sub-folder (has expiryCodeId) AND the caller provided dates.
  let updatedExpiry: Record<string, unknown> | null = null
  if (extras.expiryCodeId && (extras.lastDone || extras.expiryDate)) {
    const patch: Record<string, unknown> = { updatedAt: now }
    if (extras.lastDone) patch.lastDone = extras.lastDone
    if (extras.expiryDate) {
      patch.expiryDate = extras.expiryDate
      patch.isManualOverride = true
    }

    await CrewExpiryDate.updateOne(
      { crewId, operatorId, expiryCodeId: extras.expiryCodeId, aircraftType: '' },
      {
        $set: patch,
        $setOnInsert: {
          _id: crypto.randomUUID(),
          operatorId,
          crewId,
          expiryCodeId: extras.expiryCodeId,
          aircraftType: '',
          baseMonth: null,
          nextPlanned: null,
          notes: null,
          isManualOverride: !!extras.expiryDate,
          createdAt: now,
        },
      },
      { upsert: true },
    )

    // Re-run the sync so fixed-validity formulas pick up the new lastDone.
    await syncCrewExpiries(crewId, operatorId)

    updatedExpiry = await CrewExpiryDate.findOne({
      crewId,
      operatorId,
      expiryCodeId: extras.expiryCodeId,
      aircraftType: '',
    }).lean()
  }

  return { document: created.toObject(), updatedExpiry }
}

/** Remove a crew document + its on-disk file. Clears photoUrl on CrewMember if
 *  the doc was the active photo. */
export async function deleteCrewDocument(opts: { docId: string; crewId: string; operatorId: string }): Promise<void> {
  const { docId, crewId, operatorId } = opts
  const doc = await CrewDocument.findOne({ _id: docId, crewId, operatorId }).lean()
  if (!doc) return
  const abs = path.resolve(UPLOADS_DIR, doc.storagePath)
  if (fs.existsSync(abs)) {
    try {
      fs.unlinkSync(abs)
    } catch {
      /* ignore */
    }
  }
  await CrewDocument.deleteOne({ _id: docId, crewId, operatorId })
  if (doc.documentType === 'photo') {
    await CrewMember.findOneAndUpdate(
      { _id: crewId, operatorId, photoUrl: doc.fileUrl },
      { $set: { photoUrl: null, updatedAt: new Date().toISOString() } },
    )
  }
}
