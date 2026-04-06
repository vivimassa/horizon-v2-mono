import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const dutyPatternSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    code: { type: String, required: true },
    description: { type: String, default: null },
    sequence: { type: [Number], required: true },
    cycleDays: { type: Number, required: true },
    offCode: { type: String, default: 'DO' },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'dutyPatterns',
  }
)

dutyPatternSchema.index({ operatorId: 1, code: 1 }, { unique: true })

export type DutyPatternDoc = InferSchemaType<typeof dutyPatternSchema>
export const DutyPattern = mongoose.model('DutyPattern', dutyPatternSchema)
