import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * Per-operator Disruption Management config. Populated by 2.1.3.3
 * Disruption Customization. The live module (2.1.3.4 Disruption
 * Management) reads effective values from this doc with fallback to
 * hardcoded defaults — missing sections and missing fields are both
 * valid (= use the default).
 *
 * Shape is nested-section so Phase 2/3 settings (refresh cadence,
 * notifications, coverage, per-user overrides) can slot in without
 * schema migrations. Everything is optional; an empty doc works.
 */

const slaSchema = new Schema(
  {
    critical: { type: Number, default: null }, // minutes
    warning: { type: Number, default: null },
    info: { type: Number, default: null },
  },
  { _id: false },
)

const uiSchema = new Schema(
  {
    defaultFeedStatus: {
      type: String,
      enum: ['active', 'open', 'assigned', 'in_progress', 'resolved', 'closed', 'all'],
      default: null,
    },
    rollingPeriodStops: { type: [Number], default: undefined }, // e.g. [2, 3, 4]
    openBacklogThreshold: { type: Number, default: null },
  },
  { _id: false },
)

const resolutionTypeSchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    hint: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
  },
  { _id: false },
)

const vocabularySchema = new Schema(
  {
    // Overrides only — missing key = use default label.
    categoryLabels: { type: Map, of: String, default: undefined },
    statusLabels: { type: Map, of: String, default: undefined },
    resolutionTypes: { type: [resolutionTypeSchema], default: undefined },
  },
  { _id: false },
)

const operatorDisruptionConfigSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, unique: true, index: true },

    sla: { type: slaSchema, default: undefined },
    ui: { type: uiSchema, default: undefined },
    vocabulary: { type: vocabularySchema, default: undefined },

    // Reserved Phase 2/3 sections — kept as mixed so future fields
    // don't require schema changes. Do not populate from Phase 1 UI.
    refresh: { type: Schema.Types.Mixed, default: undefined },
    notifications: { type: Schema.Types.Mixed, default: undefined },
    coverage: { type: Schema.Types.Mixed, default: undefined },
    overrides: { type: Schema.Types.Mixed, default: undefined },

    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    _id: false,
    collection: 'operatorDisruptionConfig',
    timestamps: false,
  },
)

export type OperatorDisruptionConfigDoc = InferSchemaType<typeof operatorDisruptionConfigSchema>
export const OperatorDisruptionConfig = mongoose.model('OperatorDisruptionConfig', operatorDisruptionConfigSchema)
