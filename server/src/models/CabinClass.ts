import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const cabinClassSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    color: { type: String, default: null },
    sortOrder: { type: Number, default: 0 },
    seatLayout: { type: String, default: null },
    seatPitchIn: { type: Number, default: null },
    seatWidthIn: { type: Number, default: null },
    seatType: { type: String, enum: ['standard', 'premium', 'lie-flat', 'suite', null], default: null },
    hasIfe: { type: Boolean, default: false },
    hasPower: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'cabinClasses',
  },
)

cabinClassSchema.index({ operatorId: 1, code: 1 }, { unique: true })
cabinClassSchema.index({ operatorId: 1, sortOrder: 1 })

export type CabinClassDoc = InferSchemaType<typeof cabinClassSchema>
export const CabinClass = mongoose.model('CabinClass', cabinClassSchema)
