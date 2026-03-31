import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const aircraftTypeSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    icaoType: { type: String, required: true },
    iataType: { type: String, default: null },
    iataTypeCode: { type: String, default: null },
    name: { type: String, required: true },
    family: { type: String, default: null },
    category: { type: String, default: 'narrow_body' },
    manufacturer: { type: String, default: null },

    // Capacity
    paxCapacity: { type: Number, default: null },
    cockpitCrewRequired: { type: Number, default: 2 },
    cabinCrewRequired: { type: Number, default: null },

    // TAT (turnaround times by route type)
    tat: {
      defaultMinutes: { type: Number, default: null },
      domDom: { type: Number, default: null },
      domInt: { type: Number, default: null },
      intDom: { type: Number, default: null },
      intInt: { type: Number, default: null },
      minDd: { type: Number, default: null },
      minDi: { type: Number, default: null },
      minId: { type: Number, default: null },
      minIi: { type: Number, default: null },
    },

    // Performance
    performance: {
      mtowKg: { type: Number, default: null },
      mlwKg: { type: Number, default: null },
      mzfwKg: { type: Number, default: null },
      oewKg: { type: Number, default: null },
      maxFuelCapacityKg: { type: Number, default: null },
      maxRangeNm: { type: Number, default: null },
      cruisingSpeedKts: { type: Number, default: null },
      ceilingFl: { type: Number, default: null },
    },

    // ETOPS
    etopsCapable: { type: Boolean, default: false },
    etopsRatingMinutes: { type: Number, default: null },

    // Noise & emissions
    noiseCategory: { type: String, default: null },
    emissionsCategory: { type: String, default: null },

    // UI
    color: { type: String, default: null },
    isActive: { type: Boolean, default: true },

    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'aircraftTypes',
  }
)

aircraftTypeSchema.index({ operatorId: 1, icaoType: 1 }, { unique: true })

export type AircraftTypeDoc = InferSchemaType<typeof aircraftTypeSchema>
export const AircraftType = mongoose.model('AircraftType', aircraftTypeSchema)
