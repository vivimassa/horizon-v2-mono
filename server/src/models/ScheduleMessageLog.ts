import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const scheduleMessageLogSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    messageType: {
      type: String,
      enum: ['ASM', 'SSM'],
      required: true,
    },
    actionCode: {
      type: String,
      enum: ['NEW', 'TIM', 'CNL', 'EQT', 'RRT', 'RIN', 'CON', 'RPL', 'FLT', 'SKD'],
      required: true,
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true,
    },
    status: {
      type: String,
      enum: ['held', 'pending', 'sent', 'applied', 'rejected', 'discarded', 'neutralized'],
      default: 'pending',
    },
    flightNumber: { type: String, default: null },
    flightDate: { type: String, default: null },
    depStation: { type: String, default: null },
    arrStation: { type: String, default: null },
    seasonCode: { type: String, default: null },
    summary: { type: String, default: null },
    rawMessage: { type: String, default: null },
    changes: { type: Schema.Types.Mixed, default: null },
    rejectReason: { type: String, default: null },
    processedAtUtc: { type: String, default: null },
    processedBy: { type: String, default: null },
    _schemaVersion: { type: Number, default: 1 },
    createdAtUtc: { type: String, default: null },
    updatedAtUtc: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'scheduleMessageLogs',
  },
)

// Primary log query: operator + newest first
scheduleMessageLogSchema.index({ operatorId: 1, createdAtUtc: -1 })
// Held message lookup (for 1.1.1 integration)
scheduleMessageLogSchema.index({ operatorId: 1, status: 1, direction: 1 })
// Neutralization lookup (flight+date pairs)
scheduleMessageLogSchema.index({ operatorId: 1, flightNumber: 1, flightDate: 1 })

export type ScheduleMessageLogDoc = InferSchemaType<typeof scheduleMessageLogSchema>
export const ScheduleMessageLog = mongoose.model('ScheduleMessageLog', scheduleMessageLogSchema)
