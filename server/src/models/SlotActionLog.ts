import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const slotActionLogSchema = new Schema(
  {
    _id: { type: String, required: true },
    seriesId: { type: String, required: true, index: true },
    actionCode: { type: String, required: true },
    actionSource: {
      type: String,
      enum: ['airline', 'coordinator'],
      required: true,
    },
    messageId: { type: String, default: null },
    details: { type: Schema.Types.Mixed, default: null },
    createdAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'slotActionLog',
  }
)

slotActionLogSchema.index({ seriesId: 1, createdAt: 1 })

export type SlotActionLogDoc = InferSchemaType<typeof slotActionLogSchema>
export const SlotActionLog = mongoose.model('SlotActionLog', slotActionLogSchema)
