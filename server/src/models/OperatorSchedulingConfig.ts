import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * 4.1.6.3 Scheduling Configurations — per-operator soft-rule policy for
 * crew schedule production. These are NOT FDTL rules (regulatory hard law).
 * They are company-specific planning conventions that shape auto-roster
 * output and surface as amber warnings in the Gantt crew row headers.
 *
 * Rules covered:
 *  - carrierMode: LCC (standby > day-off priority) vs Legacy
 *  - daysOff: max period days-off, max consecutive duty days, morning/afternoon rotation limits
 *  - standby: daily quota method, home vs airport ratio, timing, duration, rest
 *  - destinationRules: per-airport/country max layovers + min separation days
 *  - objectives: gender balance weighting for auto-roster optimizer
 */

const destinationRuleSchema = new Schema(
  {
    _id: { type: String, required: true },
    scope: { type: String, enum: ['airport', 'country'], required: true },
    code: { type: String, required: true },
    maxLayoversPerPeriod: { type: Number, default: null },
    minSeparationDays: { type: Number, default: null },
    enabled: { type: Boolean, default: true },
  },
  { _id: false },
)

const daysOffSchema = new Schema(
  {
    minPerPeriodDays: { type: Number, default: 8, min: 0, max: 31 },
    maxPerPeriodDays: { type: Number, default: 10, min: 0, max: 31 },
    maxConsecutiveDutyDays: { type: Number, default: 4, min: 1, max: 14 },
    maxConsecutiveMorningDuties: { type: Number, default: 4, min: 1, max: 14 },
    maxConsecutiveAfternoonDuties: { type: Number, default: 4, min: 1, max: 14 },
  },
  { _id: false },
)

const standbySchema = new Schema(
  {
    usePercentage: { type: Boolean, default: true },
    minPerDayFlat: { type: Number, default: 2, min: 0, max: 100 },
    minPerDayPct: { type: Number, default: 10, min: 0, max: 100 },
    homeStandbyRatioPct: { type: Number, default: 80, min: 0, max: 100 },
    startTimeMode: { type: String, enum: ['auto', 'fixed'], default: 'auto' },
    autoLeadTimeMin: { type: Number, default: 120, min: 0, max: 480 },
    fixedStartTimes: { type: [String], default: [] },
    minDurationMin: { type: Number, default: 360, min: 60, max: 1440 },
    maxDurationMin: { type: Number, default: 600, min: 60, max: 1440 },
    requireLegalRestAfter: { type: Boolean, default: true },
    extraRestAfterMin: { type: Number, default: 0, min: 0, max: 480 },
  },
  { _id: false },
)

const objectivesSchema = new Schema(
  {
    genderBalanceOnLayovers: { type: Boolean, default: true },
    genderBalanceWeight: { type: Number, default: 80, min: 0, max: 100 },
    priorityOrder: { type: [String], default: [] },
  },
  { _id: false },
)

const operatorSchedulingConfigSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    /** null = operator-wide default. string = per-user override. */
    userId: { type: String, default: null, index: true },

    carrierMode: { type: String, enum: ['lcc', 'legacy'], default: 'lcc' },

    daysOff: { type: daysOffSchema, default: () => ({}) },
    standby: { type: standbySchema, default: () => ({}) },
    destinationRules: { type: [destinationRuleSchema], default: [] },
    objectives: { type: objectivesSchema, default: () => ({}) },

    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    _id: false,
    collection: 'operatorSchedulingConfig',
    timestamps: false,
  },
)

// Composite uniqueness: one row per (operator, user). `userId = null` = operator default.
operatorSchedulingConfigSchema.index({ operatorId: 1, userId: 1 }, { unique: true })

export type OperatorSchedulingConfigDoc = InferSchemaType<typeof operatorSchedulingConfigSchema>
export const OperatorSchedulingConfig = mongoose.model('OperatorSchedulingConfig', operatorSchedulingConfigSchema)
