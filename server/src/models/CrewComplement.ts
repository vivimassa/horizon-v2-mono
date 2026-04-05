import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const crewComplementSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    aircraftTypeIcao: { type: String, required: true },
    templateKey: { type: String, required: true }, // 'standard', 'aug1', 'aug2', or custom
    counts: { type: Map, of: Number, default: {} }, // position code → count (e.g. { CP: 1, FO: 1, CC: 4 })
    notes: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'crewComplements',
  }
)

crewComplementSchema.index({ operatorId: 1, aircraftTypeIcao: 1, templateKey: 1 }, { unique: true })

export type CrewComplementDoc = InferSchemaType<typeof crewComplementSchema>
export const CrewComplement = mongoose.model('CrewComplement', crewComplementSchema)
