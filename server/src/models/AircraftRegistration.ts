import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const aircraftRegistrationSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    registration: { type: String, required: true },
    aircraftTypeId: { type: String, required: true },
    lopaConfigId: { type: String, default: null },

    // Manufacturing & identity
    serialNumber: { type: String, default: null },
    variant: { type: String, default: null },

    // Status
    status: { type: String, default: 'active' },

    // Location
    homeBaseIcao: { type: String, default: null },
    currentLocationIcao: { type: String, default: null },
    currentLocationUpdatedAt: { type: String, default: null },

    // Dates
    dateOfManufacture: { type: String, default: null },
    dateOfDelivery: { type: String, default: null },
    leaseExpiryDate: { type: String, default: null },

    // Comms
    selcal: { type: String, default: null },

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

    // Fuel
    fuelBurnRateKgPerHour: { type: Number, default: null },

    // ETOPS
    etopsCapable: { type: Boolean, default: false },
    etopsRatingMinutes: { type: Number, default: null },

    // Weather limitations (per-airframe — avionics/certification dependent)
    weatherLimitations: {
      minCeilingFt: { type: Number, default: null },
      minRvrM: { type: Number, default: null },
      minVisibilityM: { type: Number, default: null },
      maxCrosswindKt: { type: Number, default: null },
      maxWindKt: { type: Number, default: null },
    },

    // Approach capabilities (per-airframe — avionics/certification dependent)
    approach: {
      ilsCategoryRequired: { type: String, default: null },
      autolandCapable: { type: Boolean, default: false },
    },

    // Noise & emissions
    noiseCategory: { type: String, default: null },
    emissionsCategory: { type: String, default: null },

    // Media & notes
    imageUrl: { type: String, default: null },
    notes: { type: String, default: null },

    // State
    isActive: { type: Boolean, default: true },

    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'aircraftRegistrations',
  }
)

aircraftRegistrationSchema.index({ operatorId: 1, registration: 1 }, { unique: true })
aircraftRegistrationSchema.index({ operatorId: 1, aircraftTypeId: 1 })

export type AircraftRegistrationDoc = InferSchemaType<typeof aircraftRegistrationSchema>
export const AircraftRegistration = mongoose.model('AircraftRegistration', aircraftRegistrationSchema)
