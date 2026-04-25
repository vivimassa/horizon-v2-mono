import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * 4.1.8.1 Crew Hotel Management — hotel email queue.
 *
 * Outbound emails follow the held → released pattern: a planner composes a
 * rooming-list email with the booking pre-filled, edits while held, then
 * Releases. Release fans-out to recipients[] and a background SMTP worker
 * drains the deliveries[] array.
 *
 * Inbound emails (hotel replies) land via /hotel-emails/inbound webhook
 * (Phase 3 stub — real parser ships later). Threaded via threadId so a
 * confirmation reply attaches under the original outbound email.
 *
 * Pattern mirrors ScheduleMessageLog (ASM/SSM) but the transport is plain
 * SMTP, completely separate from the IATA Type-B telex pipeline.
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

const hotelEmailSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },

    direction: { type: String, enum: ['outbound', 'inbound'], required: true },
    status: { type: String, enum: STATUSES, default: 'held', index: true },

    hotelId: { type: String, default: null }, // → CrewHotel._id
    hotelName: { type: String, default: '' },

    /** HotelBooking._id list — the rooming-list scope. */
    bookingIds: { type: [String], default: [] },

    subject: { type: String, default: '' },
    body: { type: String, default: '' },
    attachments: { type: [attachmentSchema], default: [] },

    /** Resolved recipients (email addresses) at release time. */
    recipients: { type: [String], default: [] },

    /** Raw payload for inbound — populated only when direction='inbound'. */
    rawSource: { type: String, default: null },

    /** Groups outbound + replies into a conversation. */
    threadId: { type: String, default: null, index: true },

    /** One delivery row per recipient after release. */
    deliveries: { type: [deliverySchema], default: [] },

    // ── Hold/release audit ──
    heldAtUtcMs: { type: Number, default: null },
    heldByUserId: { type: String, default: null },
    releasedAtUtcMs: { type: Number, default: null },
    releasedByUserId: { type: String, default: null },
    discardedAtUtcMs: { type: Number, default: null },
    discardedByUserId: { type: String, default: null },

    // ── Audit ──
    createdAtUtcMs: { type: Number, default: () => Date.now() },
    updatedAtUtcMs: { type: Number, default: () => Date.now() },
    createdByUserId: { type: String, default: null },
  },
  {
    _id: false,
    collection: 'hotelEmails',
    timestamps: false,
  },
)

hotelEmailSchema.index({ operatorId: 1, status: 1, direction: 1 })
hotelEmailSchema.index({ operatorId: 1, threadId: 1 })
hotelEmailSchema.index({ operatorId: 1, hotelId: 1, updatedAtUtcMs: -1 })

export type HotelEmailStatus = (typeof STATUSES)[number]
export type HotelEmailDeliveryStatus = (typeof DELIVERY_STATUSES)[number]
export type HotelEmailDoc = InferSchemaType<typeof hotelEmailSchema>
export const HotelEmail = mongoose.model('HotelEmail', hotelEmailSchema)
