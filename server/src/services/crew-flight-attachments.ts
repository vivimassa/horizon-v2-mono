import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import type { MultipartFile } from '@fastify/multipart'

/** Allowed MIME prefixes for crew flight booking attachments. */
const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf']
/** Allowed file extensions — image OR PDF only (per Phase D scope). */
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf']

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads')

export interface AttachmentSaveResult {
  _id: string
  name: string
  url: string
  mimeType: string | null
  sizeBytes: number | null
  uploadedAtUtcMs: number
  uploadedByUserId: string | null
}

/**
 * Persist a multipart file under uploads/crew-flight-bookings/<operator>/<bookingId>/<docId><ext>.
 * Returns the metadata to push onto CrewFlightBooking.attachments[].
 */
export async function persistFlightBookingAttachment(
  file: MultipartFile,
  opts: {
    operatorId: string
    bookingId: string
    uploadedBy: string | null
  },
): Promise<AttachmentSaveResult> {
  const ext = path.extname(file.filename).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`Unsupported file type: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`)
  }
  const mimeType = file.mimetype || null
  if (mimeType && !ALLOWED_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) {
    throw new Error(`Unsupported MIME type: ${mimeType}`)
  }

  const docId = crypto.randomUUID()
  const relDir = path.posix.join('crew-flight-bookings', opts.operatorId, opts.bookingId)
  const absDir = path.resolve(UPLOADS_DIR, relDir)
  if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true })
  const storedName = `${docId}${ext}`
  const relPath = path.posix.join(relDir, storedName)
  const absPath = path.resolve(UPLOADS_DIR, relPath)
  await pipeline(file.file, fs.createWriteStream(absPath))

  let fileSize: number | null = null
  try {
    fileSize = fs.statSync(absPath).size
  } catch {
    fileSize = null
  }

  return {
    _id: docId,
    name: file.filename,
    url: `/uploads/${relPath}`,
    mimeType,
    sizeBytes: fileSize,
    uploadedAtUtcMs: Date.now(),
    uploadedByUserId: opts.uploadedBy,
  }
}

/** Best-effort delete from disk. Mongo cleanup is the caller's responsibility. */
export function deleteFlightBookingAttachmentFile(opts: {
  operatorId: string
  bookingId: string
  attachmentUrl: string
}): void {
  // url shape: /uploads/crew-flight-bookings/<operator>/<bookingId>/<docId><ext>
  const stripped = opts.attachmentUrl.replace(/^\/uploads\//, '')
  if (!stripped.startsWith(`crew-flight-bookings/${opts.operatorId}/${opts.bookingId}/`)) return
  const abs = path.resolve(UPLOADS_DIR, stripped)
  if (fs.existsSync(abs)) {
    try {
      fs.unlinkSync(abs)
    } catch {
      /* ignore — best effort */
    }
  }
}
