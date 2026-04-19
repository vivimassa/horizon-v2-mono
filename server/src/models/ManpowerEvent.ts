import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * ManpowerEvent — a manpower-affecting event for a plan (AOC hire, CUG
 * upgrade, CCQ re-qualification, ACMI wet-lease, DRY lease, DOWNSIZE cut,
 * RESIGN attrition batch, DELIVERY new aircraft). Event effects are
 * cascaded by the engine using `leadMonths` (smart-defaulted from the
 * MPP Lead Time catalog at 5.4.9).
 */
const manpowerEventSchema = new Schema(
  {
    _id: { type: String, required: true },
    planId: { type: String, required: true, index: true },
    operatorId: { type: String, required: true, index: true },
    eventType: {
      type: String,
      enum: ['AOC', 'CUG', 'CCQ', 'ACMI', 'DRY', 'DOWNSIZE', 'RESIGN', 'DELIVERY'],
      required: true,
    },
    monthIndex: { type: Number, required: true }, // 0-11
    planYear: { type: Number, required: true },
    count: { type: Number, default: 1 },
    fleetIcao: { type: String, default: null },
    positionName: { type: String, default: null },
    leadMonths: { type: Number, default: 0 },
    notes: { type: String, default: null },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'manpowerEvents' },
)

manpowerEventSchema.index({ planId: 1, planYear: 1 })

export type ManpowerEventDoc = InferSchemaType<typeof manpowerEventSchema>
export const ManpowerEvent = mongoose.model('ManpowerEvent', manpowerEventSchema)
