import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const crewPositionSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String, enum: ['cockpit', 'cabin'], required: true },
    rankOrder: { type: Number, required: true },
    isPic: { type: Boolean, default: false },
    canDownrank: { type: Boolean, default: false },
    color: { type: String, default: null },
    description: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'crewPositions',
  },
)

crewPositionSchema.index({ operatorId: 1, code: 1 }, { unique: true })
crewPositionSchema.index({ operatorId: 1, category: 1, rankOrder: 1 })

export type CrewPositionDoc = InferSchemaType<typeof crewPositionSchema>
export const CrewPosition = mongoose.model('CrewPosition', crewPositionSchema)
