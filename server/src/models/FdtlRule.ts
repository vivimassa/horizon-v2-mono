import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const fdtlRuleSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    frameworkCode: { type: String, required: true },
    crewType: { type: String, enum: ['all', 'cockpit', 'cabin'], default: 'all' },
    category: { type: String, required: true }, // 'duty_rest', 'schedule', 'operations', etc.
    subcategory: { type: String, required: true }, // 'minimum_rest', 'split_duty', etc.
    ruleCode: { type: String, required: true }, // 'FDP_MAX_HOURS', 'REST_MIN_HOURS', etc.
    tabKey: { type: String, default: null }, // UI tab grouping
    label: { type: String, required: true },
    description: { type: String, default: null },
    legalReference: { type: String, default: null },
    value: { type: String, required: true },
    valueType: { type: String, enum: ['duration', 'integer', 'decimal', 'boolean', 'text'], required: true },
    unit: { type: String, default: null }, // 'hours', 'minutes', 'days', '%', etc.
    directionality: { type: String, enum: ['MAX_LIMIT', 'MIN_LIMIT', 'BOOLEAN', 'ENUM', 'FORMULA', null], default: null },
    source: { type: String, enum: ['government', 'company'], default: 'government' },
    templateValue: { type: String, default: null }, // original regulatory value
    isTemplateDefault: { type: Boolean, default: true },
    verificationStatus: { type: String, enum: ['verified', 'unverified', 'disputed'], default: 'unverified' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'fdtlRules',
  }
)

fdtlRuleSchema.index({ operatorId: 1, frameworkCode: 1, ruleCode: 1, crewType: 1 }, { unique: true })

export type FdtlRuleDoc = InferSchemaType<typeof fdtlRuleSchema>
export const FdtlRule = mongoose.model('FdtlRule', fdtlRuleSchema)
