import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const expiryCodeCategorySchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    key: { type: String, required: true },
    label: { type: String, required: true },
    description: { type: String, default: null },
    color: { type: String, required: true },
    sortOrder: { type: Number, required: true },
    createdAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'expiryCodeCategories',
  }
)

expiryCodeCategorySchema.index({ operatorId: 1, key: 1 }, { unique: true })

const expiryCodeSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    categoryId: { type: String, required: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    crewCategory: { type: String, enum: ['both', 'cockpit', 'cabin'], default: 'both' },
    applicablePositions: [{ type: String }],
    formula: { type: String, required: true },
    formulaParams: { type: Schema.Types.Mixed, default: {} },
    acTypeScope: { type: String, enum: ['none', 'family', 'variant'], default: 'none' },
    linkedTrainingCode: { type: String, default: null },
    warningDays: { type: Number, default: null },
    severity: [{ type: String }],
    notes: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'expiryCodes',
  }
)

expiryCodeSchema.index({ operatorId: 1, code: 1 }, { unique: true })
expiryCodeSchema.index({ categoryId: 1 })

export type ExpiryCodeCategoryDoc = InferSchemaType<typeof expiryCodeCategorySchema>
export type ExpiryCodeDoc = InferSchemaType<typeof expiryCodeSchema>

export const ExpiryCodeCategory = mongoose.model('ExpiryCodeCategory', expiryCodeCategorySchema)
export const ExpiryCode = mongoose.model('ExpiryCode', expiryCodeSchema)
