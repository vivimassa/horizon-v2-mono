import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const activityCodeGroupSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    color: { type: String, required: true },
    sortOrder: { type: Number, required: true },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'activityCodeGroups',
  }
)

activityCodeGroupSchema.index({ operatorId: 1, code: 1 }, { unique: true })

const activityCodeSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    groupId: { type: String, required: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    shortLabel: { type: String, default: null },
    color: { type: String, default: null },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },

    // Behavioral flags
    flags: [{ type: String }],

    // Credit hours
    creditRatio: { type: Number, default: null },
    creditFixedMin: { type: Number, default: null },
    payRatio: { type: Number, default: null },

    // Rest periods
    minRestBeforeMin: { type: Number, default: null },
    minRestAfterMin: { type: Number, default: null },

    // Duration & time
    defaultDurationMin: { type: Number, default: null },
    requiresTime: { type: Boolean, default: false },
    defaultStartTime: { type: String, default: null },
    defaultEndTime: { type: String, default: null },

    // Simulator
    simPlatform: { type: String, default: null },
    simDurationMin: { type: Number, default: null },

    // Position filtering
    applicablePositions: [{ type: String }],

    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'activityCodes',
  }
)

activityCodeSchema.index({ operatorId: 1, code: 1 }, { unique: true })
activityCodeSchema.index({ groupId: 1 })

export type ActivityCodeGroupDoc = InferSchemaType<typeof activityCodeGroupSchema>
export type ActivityCodeDoc = InferSchemaType<typeof activityCodeSchema>

export const ActivityCodeGroup = mongoose.model('ActivityCodeGroup', activityCodeGroupSchema)
export const ActivityCode = mongoose.model('ActivityCode', activityCodeSchema)
