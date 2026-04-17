import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * Per-consumer delivery record for an outbound ASM/SSM message.
 *
 *   - pending:   queued, not yet attempted (or awaiting next retry)
 *   - delivered: consumer acknowledged (API 200, SMTP accepted, SFTP upload ok)
 *   - failed:    terminal failure after retry budget exhausted
 *   - retrying:  transient failure, will retry on next worker tick
 *
 * For pull_api mode the delivery stays `pending` until the consumer calls
 * GET /integration/asm-ssm/outbox and receives the payload.
 */
const deliverySchema = new Schema(
  {
    consumerId: { type: String, required: true },
    consumerName: { type: String, default: null },
    deliveryMode: { type: String, enum: ['pull_api', 'sftp', 'smtp'], required: true },
    status: {
      type: String,
      enum: ['pending', 'delivered', 'failed', 'retrying'],
      default: 'pending',
    },
    attemptCount: { type: Number, default: 0 },
    lastAttemptAtUtc: { type: String, default: null },
    deliveredAtUtc: { type: String, default: null },
    errorDetail: { type: String, default: null },
    externalRef: { type: String, default: null },
  },
  { _id: false },
)

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
      enum: ['held', 'pending', 'sent', 'partial', 'failed', 'applied', 'rejected', 'discarded', 'neutralized'],
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

    // 7.1.5.1 — per-consumer delivery fan-out. Empty [] while status='held'.
    // Populated when an admin releases the message; each consumer gets one row.
    deliveries: { type: [deliverySchema], default: () => [] },

    _schemaVersion: { type: Number, default: 2 },
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
// Pull-API delivery lookup (consumer pulling their pending deliveries)
scheduleMessageLogSchema.index({ 'deliveries.consumerId': 1, 'deliveries.status': 1 })

export type ScheduleMessageLogDoc = InferSchemaType<typeof scheduleMessageLogSchema>
export const ScheduleMessageLog = mongoose.model('ScheduleMessageLog', scheduleMessageLogSchema)
