import mongoose, { Schema, type InferSchemaType } from 'mongoose'

// ── Lead Time Group ──

const mppLeadTimeGroupSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    label: { type: String, required: true },
    description: { type: String, default: null },
    color: { type: String, required: true },
    code: { type: String, required: true },
    crewType: { type: String, enum: ['cockpit', 'cabin', 'other'], default: 'cockpit' },
    sortOrder: { type: Number, default: 0 },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  { _id: false, timestamps: false, collection: 'mppLeadTimeGroups' }
)

mppLeadTimeGroupSchema.index({ operatorId: 1, code: 1 }, { unique: true })

export type MppLeadTimeGroupDoc = InferSchemaType<typeof mppLeadTimeGroupSchema>
export const MppLeadTimeGroup = mongoose.model('MppLeadTimeGroup', mppLeadTimeGroupSchema)

// ── Lead Time Item ──

const mppLeadTimeItemSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    groupId: { type: String, required: true, index: true },
    label: { type: String, required: true },
    valueMonths: { type: Number, required: true },
    note: { type: String, default: null },
    consumedBy: { type: String, default: null },
    sortOrder: { type: Number, default: 0 },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  { _id: false, timestamps: false, collection: 'mppLeadTimeItems' }
)

mppLeadTimeItemSchema.index({ operatorId: 1, groupId: 1 })

export type MppLeadTimeItemDoc = InferSchemaType<typeof mppLeadTimeItemSchema>
export const MppLeadTimeItem = mongoose.model('MppLeadTimeItem', mppLeadTimeItemSchema)
