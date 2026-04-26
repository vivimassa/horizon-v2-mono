import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * 4.1.7.1 Crew Message — outbound message from a crew controller to one or
 * more crew members. MVP delivery channel is `inApp` (queued for the future
 * crew mobile app to pick up); SMS / email gateways plug in later by
 * watching new inserts and writing to `deliveries[]`.
 *
 * One document per send event. `recipientCrewIds[]` plus a parallel
 * `deliveries[]` array (one row per recipient) makes per-crew status
 * tracking cheap without splitting the document.
 */

const deliverySchema = new Schema(
  {
    crewId: { type: String, required: true },
    status: {
      type: String,
      enum: ['queued', 'delivered', 'read', 'failed'],
      default: 'queued',
    },
    deliveredAtUtcMs: { type: Number, default: null },
    readAtUtcMs: { type: Number, default: null },
    error: { type: String, default: null },
  },
  { _id: false },
)

const crewMessageSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    /** Optional pairing context — null when sending crew-scope messages. */
    pairingId: { type: String, default: null, index: true },
    senderUserId: { type: String, required: true },
    recipientCrewIds: { type: [String], required: true, index: true },
    subject: { type: String, default: null },
    body: { type: String, required: true },
    channel: {
      type: String,
      enum: ['inApp', 'sms', 'email'],
      default: 'inApp',
    },
    deliveries: { type: [deliverySchema], default: [] },

    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'crewMessages' },
)

crewMessageSchema.index({ operatorId: 1, pairingId: 1, createdAt: -1 })
crewMessageSchema.index({ operatorId: 1, recipientCrewIds: 1, createdAt: -1 })

export type CrewMessageDoc = InferSchemaType<typeof crewMessageSchema>
export const CrewMessage = mongoose.model('CrewMessage', crewMessageSchema)
