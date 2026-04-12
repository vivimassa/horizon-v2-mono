import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const maintenanceWindowSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    base: { type: String, required: true },
    windowStartUtc: { type: String, required: true },
    windowEndUtc: { type: String, required: true },
    windowDurationHours: { type: Number, default: null },
    isManualOverride: { type: Boolean, default: true },
    notes: { type: String, default: null },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'maintenanceWindows',
  },
)

maintenanceWindowSchema.index({ operatorId: 1, base: 1 }, { unique: true })

export type MaintenanceWindowDoc = InferSchemaType<typeof maintenanceWindowSchema>
export const MaintenanceWindow = mongoose.model('MaintenanceWindow', maintenanceWindowSchema)
