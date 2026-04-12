import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const maintenanceCheckTypeSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    amosCode: { type: String, default: null },
    applicableAircraftTypeIds: { type: [String], default: [] },
    defaultHoursInterval: { type: Number, default: null },
    defaultCyclesInterval: { type: Number, default: null },
    defaultDaysInterval: { type: Number, default: null },
    defaultDurationHours: { type: Number, default: null },
    defaultStation: { type: String, default: null },
    requiresGrounding: { type: Boolean, default: true },
    resetsCheckCodes: { type: [String], default: null },
    color: { type: String, default: null },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'maintenanceCheckTypes',
  },
)

maintenanceCheckTypeSchema.index({ operatorId: 1, code: 1 }, { unique: true })

export type MaintenanceCheckTypeDoc = InferSchemaType<typeof maintenanceCheckTypeSchema>
export const MaintenanceCheckType = mongoose.model('MaintenanceCheckType', maintenanceCheckTypeSchema)
