import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const runwaySchema = new Schema(
  {
    _id: { type: String, required: true },
    identifier: { type: String, required: true }, // e.g. "08L/26R"
    lengthM: { type: Number, default: null },
    lengthFt: { type: Number, default: null },
    widthM: { type: Number, default: null },
    widthFt: { type: Number, default: null },
    surface: { type: String, default: null }, // e.g. "ASPHALT", "CONCRETE"
    ilsCategory: { type: String, default: null }, // e.g. "CAT I", "CAT II", "CAT III"
    lighting: { type: Boolean, default: false },
    status: { type: String, default: 'active' }, // active | closed | under-construction
    notes: { type: String, default: null },
  },
  { _id: false, timestamps: false },
)

const curfewSchema = new Schema(
  {
    _id: { type: String, required: true },
    startTime: { type: String, required: true }, // "HH:MM" local time
    endTime: { type: String, required: true }, // "HH:MM" local time
    effectiveFrom: { type: String, default: null }, // "YYYY-MM-DD" or null = always
    effectiveUntil: { type: String, default: null }, // "YYYY-MM-DD" or null = ongoing
    remarks: { type: String, default: null },
  },
  { _id: false, timestamps: false },
)

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

    // Runways — individual runway records
    runways: { type: [runwaySchema], default: [] },

    // Runway summary (derived from runways array or manual entry)
    numberOfRunways: { type: Number, default: null },
    longestRunwayFt: { type: Number, default: null },

    // Fuel & ops
    hasFuelAvailable: { type: Boolean, default: false },
    hasCrewFacilities: { type: Boolean, default: false },

    // Fire & rescue category
    fireCategory: { type: Number, default: null },

    // Curfews — multiple time windows with effective dates
    curfews: { type: [curfewSchema], default: [] },

    // Slot control
    isSlotControlled: { type: Boolean, default: false },
    coordinationLevel: { type: Number, default: null }, // 1 | 2 | 3
    slotsPerHourDay: { type: Number, default: null },
    slotsPerHourNight: { type: Number, default: null },
    coordinatorName: { type: String, default: null },
    coordinatorEmail: { type: String, default: null },

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
  },
)

airportSchema.index({ iataCode: 1 })
airportSchema.index({ isActive: 1 })
airportSchema.index({ isCrewBase: 1 })
airportSchema.index({ countryId: 1 })

export type AirportDoc = InferSchemaType<typeof airportSchema>
export const Airport = mongoose.model('Airport', airportSchema)
