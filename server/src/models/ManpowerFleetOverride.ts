import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * ManpowerFleetOverride — aircraft-count override per plan × aircraft-type ×
 * month. Drives the Fleet Plan tab's editable grid. One row per
 * (plan, icao, month, year); absence of a row means "use default".
 */
const manpowerFleetOverrideSchema = new Schema(
  {
    _id: { type: String, required: true },
    planId: { type: String, required: true, index: true },
    operatorId: { type: String, required: true, index: true },
    aircraftTypeIcao: { type: String, required: true },
    monthIndex: { type: Number, required: true }, // 0-11
    planYear: { type: Number, required: true },
    acCount: { type: Number, default: 0 },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'manpowerFleetOverrides' },
)

manpowerFleetOverrideSchema.index({ planId: 1, aircraftTypeIcao: 1, monthIndex: 1, planYear: 1 }, { unique: true })

export type ManpowerFleetOverrideDoc = InferSchemaType<typeof manpowerFleetOverrideSchema>
export const ManpowerFleetOverride = mongoose.model('ManpowerFleetOverride', manpowerFleetOverrideSchema)
