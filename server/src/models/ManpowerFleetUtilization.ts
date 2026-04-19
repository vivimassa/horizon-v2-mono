import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * ManpowerFleetUtilization — average daily block-hour utilisation per plan ×
 * aircraft-type. Used by the engine when no live schedule is available
 * (scenarios) to derive monthly block hours as acCount × days × dailyUtil.
 */
const manpowerFleetUtilizationSchema = new Schema(
  {
    _id: { type: String, required: true },
    planId: { type: String, required: true, index: true },
    operatorId: { type: String, required: true, index: true },
    aircraftTypeIcao: { type: String, required: true },
    dailyUtilizationHours: { type: Number, default: 12 },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'manpowerFleetUtilizations' },
)

manpowerFleetUtilizationSchema.index({ planId: 1, aircraftTypeIcao: 1 }, { unique: true })

export type ManpowerFleetUtilizationDoc = InferSchemaType<typeof manpowerFleetUtilizationSchema>
export const ManpowerFleetUtilization = mongoose.model('ManpowerFleetUtilization', manpowerFleetUtilizationSchema)
