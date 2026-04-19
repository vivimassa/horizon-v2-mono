import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * ManpowerPositionSettings — BH target + non-availability % per plan × crew
 * position. Drives the Required-headcount formula in the engine.
 */
const manpowerPositionSettingsSchema = new Schema(
  {
    _id: { type: String, required: true },
    planId: { type: String, required: true },
    positionId: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    bhTarget: { type: Number, default: 75 }, // block hours per crew per month
    naSick: { type: Number, default: 3 }, // %
    naAnnual: { type: Number, default: 10 },
    naTraining: { type: Number, default: 6 },
    naMaternity: { type: Number, default: 1.5 },
    naAttrition: { type: Number, default: 4 },
    naOther: { type: Number, default: 1 },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'manpowerPositionSettings' },
)

manpowerPositionSettingsSchema.index({ planId: 1, positionId: 1 }, { unique: true })

export type ManpowerPositionSettingsDoc = InferSchemaType<typeof manpowerPositionSettingsSchema>
export const ManpowerPositionSettings = mongoose.model('ManpowerPositionSettings', manpowerPositionSettingsSchema)
