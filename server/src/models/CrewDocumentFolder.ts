import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * CrewDocumentFolder — a filing folder for crew documents.
 *
 * The 4 root folders (CrewPhotos / Passports / MedicalCertificates /
 * TrainingDocuments) are `isSystem=true` and cannot be renamed or deleted.
 * Virtual sub-folders under TrainingDocuments / MedicalCertificates /
 * Passports are NOT rows here — they're computed at query-time from the
 * active `ExpiryCode` set (see routes/crew-documents.ts). Users can still
 * create manual sub-folders for ad-hoc grouping; those are rows here with
 * `isSystem=false` and `parentId` set.
 */
const crewDocumentFolderSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    parentId: { type: String, default: null }, // null = root folder
    name: { type: String, required: true },
    slug: { type: String, required: true }, // stable key for system folders
    isSystem: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'crewDocumentFolders' },
)

crewDocumentFolderSchema.index({ operatorId: 1, parentId: 1, sortOrder: 1 })
// Unique slug per operator for system folders; non-system share slug space
// under their parent for uniqueness.
crewDocumentFolderSchema.index(
  { operatorId: 1, slug: 1 },
  { unique: true, partialFilterExpression: { isSystem: true } },
)

export type CrewDocumentFolderDoc = InferSchemaType<typeof crewDocumentFolderSchema>
export const CrewDocumentFolder = mongoose.model('CrewDocumentFolder', crewDocumentFolderSchema)

export const SYSTEM_FOLDER_SLUGS = {
  CREW_PHOTOS: 'CrewPhotos',
  PASSPORTS: 'Passports',
  MEDICAL_CERTIFICATES: 'MedicalCertificates',
  TRAINING_DOCUMENTS: 'TrainingDocuments',
} as const

export type SystemFolderSlug = (typeof SYSTEM_FOLDER_SLUGS)[keyof typeof SYSTEM_FOLDER_SLUGS]

/** Map root-folder slug → expiry-code category keys that drive its virtual
 *  sub-folder list. Matches V1's FOLDER_EXPIRY_CATEGORIES. */
export const FOLDER_EXPIRY_CATEGORIES: Record<SystemFolderSlug, string[]> = {
  CrewPhotos: [],
  Passports: ['document'],
  MedicalCertificates: ['medical'],
  TrainingDocuments: ['training', 'recency'],
}
