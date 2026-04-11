import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const fdtlAuditLogSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    entityType: { type: String, required: true }, // 'fdtlScheme', 'fdtlRule', 'fdtlTable'
    entityId: { type: String, required: true },
    action: { type: String, required: true }, // 'update', 'reset', 'seed', 'delete'
    fieldChanged: { type: String, default: null },
    oldValue: { type: String, default: null },
    newValue: { type: String, default: null },
    changedBy: { type: String, default: null },
    changedAt: { type: String, required: true },
    reason: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'fdtlAuditLog',
  },
)

fdtlAuditLogSchema.index({ operatorId: 1, entityType: 1, entityId: 1 })
fdtlAuditLogSchema.index({ changedAt: -1 })

export type FdtlAuditLogDoc = InferSchemaType<typeof fdtlAuditLogSchema>
export const FdtlAuditLog = mongoose.model('FdtlAuditLog', fdtlAuditLogSchema)
