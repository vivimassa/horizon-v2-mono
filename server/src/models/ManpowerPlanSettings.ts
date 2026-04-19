import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * ManpowerPlanSettings — per-plan global toggles. Position-level settings
 * live in `ManpowerPositionSettings`. One row per plan (unique planId).
 */
const manpowerPlanSettingsSchema = new Schema(
  {
    _id: { type: String, required: true }, // same as planId for clarity
    planId: { type: String, required: true, unique: true },
    operatorId: { type: String, required: true, index: true },
    wetLeaseActive: { type: Boolean, default: false },
    /** When true, `naOther` is modelled as a permanent headcount drain
     *  (same bucket as attrition). When false, it's a temporary
     *  non-availability reduction applied to effective capacity. */
    naOtherIsDrain: { type: Boolean, default: false },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'manpowerPlanSettings' },
)

export type ManpowerPlanSettingsDoc = InferSchemaType<typeof manpowerPlanSettingsSchema>
export const ManpowerPlanSettings = mongoose.model('ManpowerPlanSettings', manpowerPlanSettingsSchema)
