import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * 4.1.7.1 Crew Check-In/Out Configuration — per-operator policy.
 *
 * Sections:
 *   - basic       : when can crew check in (window prior to RRT, scope)
 *   - lateInfo    : late / very-late / standby thresholds
 *   - delayed     : flag crew on delayed flights without amended RRT
 *   - groundDuties: which ground-duty codes require check-in
 *   - precheckIn  : pre-check-in window + late threshold
 *
 * One document per operator. Mirrors OperatorHotacConfig pattern.
 */

const basicSchema = new Schema(
  {
    /** When may a crew member check-in: only at the start of their pairing,
     *  at every duty start, or freely (controller decides). */
    scope: {
      type: String,
      enum: ['pairing-start', 'every-duty', 'free'],
      default: 'pairing-start',
    },
    /** Earliest check-in is this many minutes before Required Reporting Time. */
    earliestCheckInMinutesBeforeRrt: { type: Number, default: 12 * 60, min: 0, max: 24 * 60 },
  },
  { _id: false },
)

const lateInfoSchema = new Schema(
  {
    /** Minutes past RRT before status flips to LATE. */
    lateAfterMinutes: { type: Number, default: 5, min: 1, max: 60 },
    /** Minutes past RRT before status flips to VERY LATE. */
    veryLateAfterMinutes: { type: Number, default: 20, min: 5, max: 120 },
    /** Minutes past Airport Standby start before standby crew flips to LATE. */
    standbyLateAfterMinutes: { type: Number, default: 5, min: 1, max: 60 },
    /** Minutes past RRT before status flips to NO-SHOW. */
    noShowAfterMinutes: { type: Number, default: 60, min: 10, max: 240 },
  },
  { _id: false },
)

const delayedSchema = new Schema(
  {
    /** When true, surface a warning for crew assigned to delayed flights
     *  whose RRT was not amended. */
    flagWhenRrtNotAmended: { type: Boolean, default: false },
    /** Minimum flight delay (minutes) before the warning kicks in. */
    minimumDelayMinutes: { type: Number, default: 60, min: 0, max: 480 },
  },
  { _id: false },
)

const groundDutiesSchema = new Schema(
  {
    /** ActivityCode codes (or 3-letter ground-duty codes) that REQUIRE check-in.
     *  Empty list = no ground duties require check-in. */
    requireCheckInFor: { type: [String], default: [] },
    /** When true, ground duties NOT in the list above are treated as
     *  not-requiring-check-in even when they appear inside a pairing. */
    suppressOthersInPairing: { type: Boolean, default: false },
  },
  { _id: false },
)

const precheckInSchema = new Schema(
  {
    /** Earliest pre-check-in window (minutes prior to RRT). 0 = pre-check-in disabled. */
    windowMinutesBeforeRrt: { type: Number, default: 0, min: 0, max: 24 * 60 },
    /** Pre-check-in flagged as LATE when performed within this many minutes of RRT. */
    lateThresholdMinutesBeforeRrt: { type: Number, default: 240, min: 0, max: 24 * 60 },
  },
  { _id: false },
)

const operatorCheckInConfigSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true, unique: true },

    basic: { type: basicSchema, default: () => ({}) },
    lateInfo: { type: lateInfoSchema, default: () => ({}) },
    delayed: { type: delayedSchema, default: () => ({}) },
    groundDuties: { type: groundDutiesSchema, default: () => ({}) },
    precheckIn: { type: precheckInSchema, default: () => ({}) },

    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    _id: false,
    collection: 'operatorCheckInConfig',
    timestamps: false,
  },
)

export type OperatorCheckInConfigDoc = InferSchemaType<typeof operatorCheckInConfigSchema>
export const OperatorCheckInConfig = mongoose.model('OperatorCheckInConfig', operatorCheckInConfigSchema)
