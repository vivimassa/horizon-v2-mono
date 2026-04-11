import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const cabinEntrySchema = new Schema(
  {
    classCode: { type: String, required: true },
    seats: { type: Number, required: true },
  },
  { _id: false },
)

const lopaConfigSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    aircraftType: { type: String, required: true },
    configName: { type: String, required: true },
    cabins: { type: [cabinEntrySchema], default: [] },
    totalSeats: { type: Number, required: true },
    isDefault: { type: Boolean, default: false },
    notes: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'lopaConfigs',
  },
)

lopaConfigSchema.index({ operatorId: 1, aircraftType: 1, configName: 1 }, { unique: true })
lopaConfigSchema.index({ operatorId: 1, aircraftType: 1, isDefault: 1 })

export type LopaConfigDoc = InferSchemaType<typeof lopaConfigSchema>
export const LopaConfig = mongoose.model('LopaConfig', lopaConfigSchema)
