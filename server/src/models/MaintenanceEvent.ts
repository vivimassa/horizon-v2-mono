import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const maintenanceEventSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    aircraftId: { type: String, required: true },
    checkTypeId: { type: String, required: true },
    plannedStartUtc: { type: String, required: true },
    plannedEndUtc: { type: String, default: null },
    actualStartUtc: { type: String, default: null },
    actualEndUtc: { type: String, default: null },
    station: { type: String, required: true },
    hangar: { type: String, default: null },
    status: {
      type: String,
      required: true,
      enum: ['planned', 'confirmed', 'in_progress', 'completed', 'cancelled', 'deferred'],
      default: 'planned',
    },
    phase: {
      type: String,
      enum: ['planned', 'arrived', 'inducted', 'in_work', 'qa', 'released', 'return_to_flight'],
      default: 'planned',
    },
    phaseUpdatedAtUtc: { type: String, default: null },
    source: {
      type: String,
      required: true,
      enum: ['manual', 'auto_proposed', 'amos_sync'],
      default: 'manual',
    },
    completionHours: { type: Number, default: null },
    completionCycles: { type: Number, default: null },
    workItems: { type: Schema.Types.Mixed, default: null },
    notes: { type: String, default: null },
    createdBy: { type: String, default: null },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'maintenanceEvents',
  },
)

maintenanceEventSchema.index({ operatorId: 1, aircraftId: 1 })
maintenanceEventSchema.index({ operatorId: 1, status: 1 })
maintenanceEventSchema.index({ plannedStartUtc: 1 })

export type MaintenanceEventDoc = InferSchemaType<typeof maintenanceEventSchema>
export const MaintenanceEvent = mongoose.model('MaintenanceEvent', maintenanceEventSchema)
