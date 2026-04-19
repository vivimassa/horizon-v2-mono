import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * ManpowerPlan — a scenario for Crew Manpower Planning (4.1.4).
 *
 * One per operator starts as the "Base Plan" (`isBasePlan=true`), auto-
 * created on first access by `ensureManpowerBasePlan`. Additional plans are
 * scenarios the user clones from the base to model different assumptions
 * (BH targets, non-availability %, fleet overrides, events).
 */
const manpowerPlanSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    color: { type: String, default: '#0F766E' }, // teal-700 default
    isBasePlan: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    year: { type: Number, default: () => new Date().getFullYear() + 1 },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'manpowerPlans' },
)

manpowerPlanSchema.index({ operatorId: 1, isBasePlan: 1 })
manpowerPlanSchema.index({ operatorId: 1, sortOrder: 1 })

export type ManpowerPlanDoc = InferSchemaType<typeof manpowerPlanSchema>
export const ManpowerPlan = mongoose.model('ManpowerPlan', manpowerPlanSchema)
