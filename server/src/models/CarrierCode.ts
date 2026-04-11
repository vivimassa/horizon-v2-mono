import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const reportDebriefSchema = new Schema(
  {
    reportMinutes: { type: Number, default: null },
    debriefMinutes: { type: Number, default: null },
  },
  { _id: false },
)

const carrierCodeSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    iataCode: { type: String, required: true },
    icaoCode: { type: String, default: null },
    name: { type: String, required: true },
    category: { type: String, enum: ['Air', 'Ground', 'Other'], default: 'Air' },
    vendorNumber: { type: String, default: null },
    contactName: { type: String, default: null },
    contactPosition: { type: String, default: null },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    sita: { type: String, default: null },
    website: { type: String, default: null },
    defaultCurrency: { type: String, default: null },
    capacity: { type: Number, default: null },
    cockpitTimes: { type: reportDebriefSchema, default: null },
    cabinTimes: { type: reportDebriefSchema, default: null },
    isActive: { type: Boolean, default: true },
    createdAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'carrierCodes',
  },
)

carrierCodeSchema.index({ operatorId: 1, iataCode: 1 }, { unique: true })

export type CarrierCodeDoc = InferSchemaType<typeof carrierCodeSchema>
export const CarrierCode = mongoose.model('CarrierCode', carrierCodeSchema)
