import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const flightInstanceSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    flightNumber: { type: String, required: true },
    operatingDate: { type: String, required: true, index: true },

    dep: {
      icao: { type: String, required: true },
      iata: { type: String, required: true },
    },
    arr: {
      icao: { type: String, required: true },
      iata: { type: String, required: true },
    },

    schedule: {
      stdUtc: { type: Number, required: true },
      staUtc: { type: Number, required: true },
    },
    actual: {
      atdUtc: { type: Number, default: null },
      ataUtc: { type: Number, default: null },
    },

    tail: {
      registration: { type: String, default: null },
      icaoType: { type: String, default: null },
    },

    crew: [
      {
        _id: false,
        employeeId: { type: String, required: true },
        role: { type: String, required: true },
        name: { type: String, required: true },
      },
    ],

    delays: [
      {
        _id: false,
        code: { type: String, required: true },
        minutes: { type: Number, required: true },
        reason: { type: String, default: '' },
      },
    ],

    status: {
      type: String,
      enum: ['scheduled', 'departed', 'onTime', 'delayed', 'cancelled', 'diverted'],
      default: 'scheduled',
      index: true,
    },

    syncMeta: {
      updatedAt: { type: Number, default: () => Date.now() },
      version: { type: Number, default: 1 },
    },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'flightInstances',
  }
)

flightInstanceSchema.index({ operatorId: 1, operatingDate: 1 })

export type FlightInstanceDoc = InferSchemaType<typeof flightInstanceSchema>
export const FlightInstance = mongoose.model('FlightInstance', flightInstanceSchema)
