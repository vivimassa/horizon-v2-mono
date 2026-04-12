import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const movementMessageLogSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    messageType: {
      type: String,
      enum: ['MVT', 'LDM'],
      required: true,
    },
    actionCode: {
      type: String,
      enum: ['AD', 'AA', 'ED', 'EA', 'NI', 'RR', 'FR'],
      required: true,
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      default: 'outbound',
    },
    status: {
      type: String,
      enum: ['held', 'pending', 'sent', 'applied', 'rejected', 'discarded'],
      default: 'pending',
    },
    flightNumber: { type: String, default: null },
    flightDate: { type: String, default: null },
    registration: { type: String, default: null },
    depStation: { type: String, default: null },
    arrStation: { type: String, default: null },
    summary: { type: String, default: null },
    rawMessage: { type: String, default: null },
    scenarioId: { type: String, default: null },
    flightInstanceId: { type: String, default: null },
    createdAtUtc: { type: String, default: null },
    updatedAtUtc: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'movementMessageLogs',
  },
)

movementMessageLogSchema.index({ operatorId: 1, createdAtUtc: -1 })
movementMessageLogSchema.index({ operatorId: 1, status: 1, direction: 1 })
movementMessageLogSchema.index({ operatorId: 1, scenarioId: 1, status: 1 })

export type MovementMessageLogDoc = InferSchemaType<typeof movementMessageLogSchema>
export const MovementMessageLog = mongoose.model('MovementMessageLog', movementMessageLogSchema)
