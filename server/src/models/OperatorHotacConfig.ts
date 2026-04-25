import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * 4.1.8.3 HOTAC Configurations — per-operator policy for crew accommodation.
 *
 * Sections:
 *  - layoverRule: when does a layover qualify for a hotel? (default: ≥6h
 *    block-to-block AND not at crew home base)
 *  - roomAllocation: occupancy defaults + contract-cap behaviour
 *  - dispatch: auto-dispatch toggle, rooming-list send timing, SLA threshold
 *  - checkIn: auto check-in / no-show grace windows
 *  - email: SMTP From/Reply-To, signature, hold-by-default toggle
 *
 * One document per operator. Mirrors the pattern in OperatorSchedulingConfig.
 */

const layoverRuleSchema = new Schema(
  {
    layoverMinHours: { type: Number, default: 6, min: 1, max: 24 },
    excludeHomeBase: { type: Boolean, default: true },
    minSpanMidnightHours: { type: Number, default: 0, min: 0, max: 12 },
  },
  { _id: false },
)

const roomAllocationSchema = new Schema(
  {
    defaultOccupancy: { type: String, enum: ['single', 'double'], default: 'single' },
    /** Position codes allowed to share a room (e.g. ['CCM', 'CSM']). */
    doubleOccupancyPositions: { type: [String], default: [] },
    contractCapBehaviour: { type: String, enum: ['reject', 'supplement'], default: 'supplement' },
  },
  { _id: false },
)

const dispatchSchema = new Schema(
  {
    autoDispatchEnabled: { type: Boolean, default: false },
    /** Local "HH:MM" daily run; null = manual only. */
    autoDispatchTime: { type: String, default: null },
    /** Send rooming list this many hours before crew arrival. */
    sendBeforeHours: { type: Number, default: 24, min: 0, max: 96 },
    /** Flag a sent email overdue-confirmation if no reply this many hours later. */
    confirmationSlaHours: { type: Number, default: 2, min: 1, max: 24 },
  },
  { _id: false },
)

const checkInSchema = new Schema(
  {
    /** Auto-mark check-in if not already done by ARR + N min after STA. 0 = disabled. */
    autoCheckInOnArrivalDelayMinutes: { type: Number, default: 60, min: 0, max: 240 },
    /** Mark no-show if no check-in this many hours after STA. */
    noShowAfterHours: { type: Number, default: 4, min: 1, max: 24 },
  },
  { _id: false },
)

const emailSchema = new Schema(
  {
    fromAddress: { type: String, default: '' },
    replyTo: { type: String, default: null },
    signature: { type: String, default: '' },
    /** When true, new outbound emails start as 'held' (require explicit Release). */
    holdByDefault: { type: Boolean, default: true },
  },
  { _id: false },
)

const operatorHotacConfigSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true, unique: true },

    layoverRule: { type: layoverRuleSchema, default: () => ({}) },
    roomAllocation: { type: roomAllocationSchema, default: () => ({}) },
    dispatch: { type: dispatchSchema, default: () => ({}) },
    checkIn: { type: checkInSchema, default: () => ({}) },
    email: { type: emailSchema, default: () => ({}) },

    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    _id: false,
    collection: 'operatorHotacConfig',
    timestamps: false,
  },
)

export type OperatorHotacConfigDoc = InferSchemaType<typeof operatorHotacConfigSchema>
export const OperatorHotacConfig = mongoose.model('OperatorHotacConfig', operatorHotacConfigSchema)
