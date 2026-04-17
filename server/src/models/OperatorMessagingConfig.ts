import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * Per-operator Communication Deck config. Populated from 7.1.5.2
 * ACARS/MVT/LDM Transmission. Three concerns:
 *
 *   - autoTransmit: when ON, the background scheduler sweeps Held outbound
 *                   messages every `intervalMin` minutes and transmits any
 *                   whose `actionCode` is in the allowlist and whose held
 *                   age ≥ `ageGateMin`. Scheduler state (`lastRunAtUtc`,
 *                   counters) lives inline but is not user-editable.
 *
 *   - validation:   applied to every inbound ACARS/MVT/LDM before ingestion.
 *                   Failing rules mark the message `rejected` with an
 *                   errorReason matching the rule key.
 *
 *   - overwrite:    source-priority matrix. Which automation source may
 *                   overwrite a previously-touched field.
 *
 * Missing fields are valid (= use the default). Route validates with Zod
 * before persisting.
 */

const autoTransmitSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    intervalMin: { type: Number, default: 5, min: 2, max: 15 },
    ageGateMin: { type: Number, default: 1, min: 0, max: 10 },
    actionAllow: {
      type: [String],
      default: () => ['AD', 'AA'],
    },
    respectFilter: { type: Boolean, default: true },

    // Scheduler state (not exposed by PUT; updated by the job itself).
    lastRunAtUtc: { type: Number, default: null },
    lastMatched: { type: Number, default: 0 },
    lastSent: { type: Number, default: 0 },
    lastFailed: { type: Number, default: 0 },
  },
  { _id: false },
)

const validationSchema = new Schema(
  {
    rejectFutureTs: { type: Boolean, default: true },
    futureTsToleranceMin: { type: Number, default: 5, min: 0, max: 60 },
    rejectExcessiveDelay: { type: Boolean, default: true },
    delayThresholdHours: { type: Number, default: 8, min: 1, max: 48 },
    enforceSequence: { type: Boolean, default: true },
    touchAndGoGuardSec: { type: Number, default: 120, min: 0, max: 600 },
    blockTimeDiscrepancyPct: { type: Number, default: 30, min: 5, max: 100 },
    matchByReg: { type: Boolean, default: false },
  },
  { _id: false },
)

const overwriteSchema = new Schema(
  {
    acarsOverwriteManual: { type: Boolean, default: false },
    acarsOverwriteMvt: { type: Boolean, default: false },
    mvtOverwriteManual: { type: Boolean, default: true },
  },
  { _id: false },
)

// ── ASM/SSM block (7.1.5.1) ─────────────────────────────────────────
// Independent of the MVT-side fields above. Two sub-concerns:
//   - generation: which message families/types we emit and on which triggers
//   - autoRelease: background sweep that moves held → released for fan-out
//     to consumers (scheduler state lives inline, not user-editable)

const asmSsmGenerationSchema = new Schema(
  {
    asmEnabled: { type: Boolean, default: true },
    ssmEnabled: { type: Boolean, default: true },
    triggerOnCommit: { type: Boolean, default: true },
    triggerOnPlaygroundCommit: { type: Boolean, default: false },
    messageTypeAllow: {
      type: [String],
      default: () => ['NEW', 'CNL', 'TIM', 'EQT', 'RRT'],
    },
    priority: { type: String, enum: ['high', 'medium', 'low'], default: 'high' },
  },
  { _id: false },
)

const asmSsmAutoReleaseSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    intervalMin: { type: Number, default: 5, min: 2, max: 30 },
    ageGateMin: { type: Number, default: 2, min: 0, max: 60 },
    actionAllow: {
      type: [String],
      default: () => ['TIM'],
    },

    // Scheduler state (not exposed by PUT; updated by the job itself).
    lastRunAtUtc: { type: Number, default: null },
    lastMatched: { type: Number, default: 0 },
    lastReleased: { type: Number, default: 0 },
    lastFailed: { type: Number, default: 0 },
  },
  { _id: false },
)

const asmSsmSchema = new Schema(
  {
    generation: { type: asmSsmGenerationSchema, default: () => ({}) },
    autoRelease: { type: asmSsmAutoReleaseSchema, default: () => ({}) },
  },
  { _id: false },
)

const operatorMessagingConfigSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, unique: true, index: true },

    autoTransmit: { type: autoTransmitSchema, default: () => ({}) },
    validation: { type: validationSchema, default: () => ({}) },
    overwrite: { type: overwriteSchema, default: () => ({}) },
    asmSsm: { type: asmSsmSchema, default: () => ({}) },

    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    _id: false,
    collection: 'operatorMessagingConfig',
    timestamps: false,
  },
)

export type OperatorMessagingConfigDoc = InferSchemaType<typeof operatorMessagingConfigSchema>
export const OperatorMessagingConfig = mongoose.model('OperatorMessagingConfig', operatorMessagingConfigSchema)
