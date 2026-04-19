import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * CrewDocument — a single uploaded file tagged to a crew member.
 *
 * `folderId` points at the parent (usually one of the 4 system root folders).
 * `expiryCodeId` is set when the doc lives inside a *virtual* sub-folder
 * (e.g. under TrainingDocuments → CRM Training). When set, the upload flow
 * can also sync the crew's `CrewExpiryDate` row for that code, so training
 * uploads actually drive recency tracking (the V1 page shape is purely
 * organizational — this is the SkyHub enhancement the user asked for).
 */
const crewDocumentSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    crewId: { type: String, required: true, index: true },
    folderId: { type: String, required: true },
    expiryCodeId: { type: String, default: null },
    documentType: {
      type: String,
      enum: ['photo', 'passport', 'license', 'medical', 'training', 'other'],
      default: 'other',
    },
    fileName: { type: String, required: true },
    storagePath: { type: String, required: true }, // relative to uploadsDir
    fileUrl: { type: String, required: true }, // `/uploads/${storagePath}`
    fileSize: { type: Number, default: 0 },
    mimeType: { type: String, default: null },
    description: { type: String, default: null },
    uploadedAt: { type: String, default: () => new Date().toISOString() },
    uploadedBy: { type: String, default: null }, // user._id of uploader
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'crewDocuments' },
)

crewDocumentSchema.index({ crewId: 1, folderId: 1 })
crewDocumentSchema.index({ crewId: 1, expiryCodeId: 1 }, { sparse: true })
crewDocumentSchema.index({ operatorId: 1, uploadedAt: -1 })

export type CrewDocumentDoc = InferSchemaType<typeof crewDocumentSchema>
export const CrewDocument = mongoose.model('CrewDocument', crewDocumentSchema)
