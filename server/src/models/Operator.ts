import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const operatorSchema = new Schema(
  {
    _id: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    icaoCode: { type: String, default: null },
    iataCode: { type: String, default: null },
    callsign: { type: String, default: null },
    country: { type: String, default: null },
    timezone: { type: String, required: true },
    fdtlRuleset: { type: String, default: null },
    enabledModules: [{ type: String }],
    accentColor: { type: String, default: '#1e40af' },
    logoUrl: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'operators',
  }
)

export type OperatorDoc = InferSchemaType<typeof operatorSchema>
export const Operator = mongoose.model('Operator', operatorSchema)
