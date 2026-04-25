import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * 4.1.8.2 Crew Transport — vendor email queue.
 *
 * Mirrors HotelEmail: held → pending → sent (or partial/failed/discarded).
 * Outbound dispatch sheets fan-out to recipients[]; inbound webhook captures
 * vendor confirmations against threadId.
 */

const STATUSES = ['draft', 'held', 'pending', 'sent', 'partial', 'failed', 'discarded', 'received'] as const
const DELIVERY_STATUSES = ['pending', 'delivered', 'failed', 'retrying'] as const

const attachmentSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String, default: null },
    sizeBytes: { type: Number, default: null },
  },
  { _id: false },
)

const deliverySchema = new Schema(
  {
    recipient: { type: String, required: true },
    status: { type: String, enum: DELIVERY_STATUSES, default: 'pending' },
    attemptCount: { type: Number, default: 0 },
    lastAttemptAtUtcMs: { type: Number, default: null },
    deliveredAtUtcMs: { type: Number, default: null },
    errorDetail: { type: String, default: null },
    externalRef: { type: String, default: null },
  },
  { _id: false },
)

const transportEmailSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },

    direction: { type: String, enum: ['outbound', 'inbound'], required: true },
    status: { type: String, enum: STATUSES, default: 'held', index: true },

    vendorId: { type: String, default: null }, // → CrewTransportVendor._id
    vendorName: { type: String, default: '' },

    /** CrewTransportTrip._id list — the dispatch-sheet scope. */
    tripIds: { type: [String], default: [] },

    subject: { type: String, default: '' },
    body: { type: String, default: '' },
    attachments: { type: [attachmentSchema], default: [] },

    recipients: { type: [String], default: [] },
    rawSource: { type: String, default: null },
    threadId: { type: String, default: null, index: true },

    deliveries: { type: [deliverySchema], default: [] },

    heldAtUtcMs: { type: Number, default: null },
    heldByUserId: { type: String, default: null },
    releasedAtUtcMs: { type: Number, default: null },
    releasedByUserId: { type: String, default: null },
    discardedAtUtcMs: { type: Number, default: null },
    discardedByUserId: { type: String, default: null },

    createdAtUtcMs: { type: Number, default: () => Date.now() },
    updatedAtUtcMs: { type: Number, default: () => Date.now() },
    createdByUserId: { type: String, default: null },
  },
  {
    _id: false,
    collection: 'transportEmails',
    timestamps: false,
  },
)

transportEmailSchema.index({ operatorId: 1, status: 1, direction: 1 })
transportEmailSchema.index({ operatorId: 1, threadId: 1 })
transportEmailSchema.index({ operatorId: 1, vendorId: 1, updatedAtUtcMs: -1 })

export type TransportEmailStatus = (typeof STATUSES)[number]
export type TransportEmailDeliveryStatus = (typeof DELIVERY_STATUSES)[number]
export type TransportEmailDoc = InferSchemaType<typeof transportEmailSchema>
export const TransportEmail = mongoose.model('TransportEmail', transportEmailSchema)
