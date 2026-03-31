import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const airportSchema = new Schema(
  {
    _id: { type: String, required: true }, // Supabase UUID preserved
    icaoCode: { type: String, required: true, unique: true },
    iataCode: { type: String, default: null },
    name: { type: String, required: true },
    city: { type: String, default: null },
    country: { type: String, default: null },
    countryId: { type: String, default: null },
    timezone: { type: String, required: true },
    utcOffsetHours: { type: Number, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    elevationFt: { type: Number, default: null },

    // Operational flags
    isActive: { type: Boolean, default: true },
    isHomeBase: { type: Boolean, default: false },
    isCrewBase: { type: Boolean, default: false },

    // Crew timing
    crewReportingTimeMinutes: { type: Number, default: null },
    crewDebriefTimeMinutes: { type: Number, default: null },

    // Runway info
    numberOfRunways: { type: Number, default: null },
    longestRunwayFt: { type: Number, default: null },

    // Fuel & ops
    hasFuelAvailable: { type: Boolean, default: false },
    hasCrewFacilities: { type: Boolean, default: false },

    // Fire & rescue category
    fireCategory: { type: Number, default: null },

    // Curfew
    hasCurfew: { type: Boolean, default: false },
    curfewStart: { type: String, default: null },
    curfewEnd: { type: String, default: null },

    // Slot control
    isSlotControlled: { type: Boolean, default: false },

    // Weather monitoring
    weatherMonitored: { type: Boolean, default: false },
    weatherStation: { type: String, default: null },

    // Gate info
    numberOfGates: { type: Number, default: null },

    // Joined data (denormalized for MongoDB)
    countryName: { type: String, default: null },
    countryIso2: { type: String, default: null },
    countryFlag: { type: String, default: null },
    ianaTimezone: { type: String, default: null },

    createdAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'airports',
  }
)

airportSchema.index({ iataCode: 1 })
airportSchema.index({ isActive: 1 })
airportSchema.index({ isCrewBase: 1 })
airportSchema.index({ countryId: 1 })

export type AirportDoc = InferSchemaType<typeof airportSchema>
export const Airport = mongoose.model('Airport', airportSchema)
