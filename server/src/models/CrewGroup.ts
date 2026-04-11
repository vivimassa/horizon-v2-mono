import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const crewGroupSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'crewGroups',
  },
)

crewGroupSchema.index({ operatorId: 1, name: 1 }, { unique: true })

export type CrewGroupDoc = InferSchemaType<typeof crewGroupSchema>
export const CrewGroup = mongoose.model('CrewGroup', crewGroupSchema)
