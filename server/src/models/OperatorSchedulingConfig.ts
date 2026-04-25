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
    codes: { type: [String], default: [] },
    /** @deprecated retained for legacy doc reads — migrated to codes[] in app code. */
    code: { type: String, default: null },
    maxLayoversPerPeriod: { type: Number, default: null },
    minSeparationDays: { type: Number, default: null },
    enabled: { type: Boolean, default: true },
  },
  { _id: false },
)

// Soft-rule toggle: planner picks whether the solver penalises violations
// and how heavily. Weight 1 = nudge, 10 = strong preference (short of hard).
const softRuleSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    /** 1-10. Scales the per-violation penalty added to the solver objective. */
    weight: { type: Number, default: 5, min: 1, max: 10 },
  },
  { _id: false },
)

const daysOffSchema = new Schema(
  {
    minPerPeriodDays: { type: Number, default: 8, min: 0, max: 31 },
    maxPerPeriodDays: { type: Number, default: 10, min: 0, max: 31 },
    /** Hard cap on consecutive OFF days placed by auto-roster. Day-off pass
     *  deterministic — respects the cap structurally, no penalty needed. */
    maxConsecutiveDaysOff: { type: Number, default: 3, min: 1, max: 7 },
    maxConsecutiveDutyDays: { type: Number, default: 4, min: 1, max: 14 },
    maxConsecutiveDutyDaysRule: { type: softRuleSchema, default: () => ({}) },
    maxConsecutiveMorningDuties: { type: Number, default: 4, min: 1, max: 14 },
    maxConsecutiveMorningDutiesRule: { type: softRuleSchema, default: () => ({}) },
    maxConsecutiveAfternoonDuties: { type: Number, default: 4, min: 1, max: 14 },
    maxConsecutiveAfternoonDutiesRule: { type: softRuleSchema, default: () => ({}) },
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

// Quality-of-Life rule. Soft preferences that shape duty placement around
// designated activities (typically vacation / leave codes) so crew can wind
// down before, and ease back into work after, those blocks.
//
//   direction='before_activity' + timeHHMM='12:00'
//     → duty ENDING the day before the activity must end before 12:00 local
//   direction='after_activity'  + timeHHMM='12:00'
//     → duty STARTING the day after the activity must start after 12:00 local
//
// Per-rule weight 1-10 (same scale as soft duty rules). Solver penalises
// violations but never blocks coverage.
const qolRuleSchema = new Schema(
  {
    _id: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    direction: { type: String, enum: ['before_activity', 'after_activity'], required: true },
    activityCodeIds: { type: [String], default: [] },
    timeHHMM: { type: String, required: true },
    weight: { type: Number, default: 5, min: 1, max: 10 },
    notes: { type: String, default: null },
  },
  { _id: false },
)

// Birthday-off rule. Standalone soft preference: on a crew's birthday, place
// OFF (or rest) instead of any duty. Honoured by the solver when it can
// satisfy coverage without breaking it. Weight 1-10.
const qolBirthdaySchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
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
    qolRules: { type: [qolRuleSchema], default: [] },
    qolBirthday: { type: qolBirthdaySchema, default: () => ({}) },
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
