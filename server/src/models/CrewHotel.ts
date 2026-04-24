import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const contactSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, default: null },
    telephone: { type: String, default: null },
    fax: { type: String, default: null },
  },
  { _id: false, timestamps: false },
)

const emailSchema = new Schema(
  {
    _id: { type: String, required: true },
    address: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false, timestamps: false },
)

const dailyRateRuleSchema = new Schema(
  {
    _id: { type: String, required: true },
    stayType: { type: String, default: null },
    fromDays: { type: Number, default: null },
    toDays: { type: Number, default: null },
    operation: { type: String, default: null },
    durationHrs: { type: Number, default: null },
    percentage: { type: Number, default: null },
    rate: { type: Number, default: null },
  },
  { _id: false, timestamps: false },
)

const contractSchema = new Schema(
  {
    _id: { type: String, required: true },
    priority: { type: Number, default: 1 },
    startDateUtcMs: { type: Number, default: null },
    endDateUtcMs: { type: Number, default: null },
    weekdayMask: { type: [Boolean], default: () => [true, true, true, true, true, true, true] },
    checkInLocal: { type: String, default: null },
    checkOutLocal: { type: String, default: null },
    contractNo: { type: String, default: null },
    contractRate: { type: Number, default: null },
    currency: { type: String, default: 'EUR' },
    roomsPerNight: { type: Number, default: 0 },
    releaseTime: { type: String, default: '00:00' },
    roomRate: { type: Number, default: 0 },
    dailyRateRules: { type: [dailyRateRuleSchema], default: [] },
  },
  { _id: false, timestamps: false },
)

const shuttleSchema = new Schema(
  {
    _id: { type: String, required: true },
    fromDateUtcMs: { type: Number, default: null },
    toDateUtcMs: { type: Number, default: null },
    fromTimeLocal: { type: String, default: null },
    toTimeLocal: { type: String, default: null },
    weekdayMask: { type: [Boolean], default: () => [false, false, false, false, false, false, false] },
  },
  { _id: false, timestamps: false },
)

const criteriaSchema = new Schema(
  {
    blockToBlockRestMinutes: { type: Number, default: null },
    crewPositions: { type: [String], default: [] },
    aircraftTypes: { type: [String], default: [] },
    crewCategories: { type: [String], default: [] },
    charterers: { type: [String], default: [] },
  },
  { _id: false, timestamps: false },
)

const crewHotelSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true },
    airportIcao: { type: String, required: true },
    hotelName: { type: String, required: true },
    priority: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },

    effectiveFromUtcMs: { type: Number, default: null },
    effectiveUntilUtcMs: { type: Number, default: null },

    isTrainingHotel: { type: Boolean, default: false },
    isAllInclusive: { type: Boolean, default: false },
    addressLine1: { type: String, default: null },
    addressLine2: { type: String, default: null },
    addressLine3: { type: String, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    distanceFromAirportMinutes: { type: Number, default: null },
    shuttleAlwaysAvailable: { type: Boolean, default: false },
    standardCheckInLocal: { type: String, default: '10:00' },
    standardCheckOutLocal: { type: String, default: '18:00' },

    criteria: { type: criteriaSchema, default: () => ({}) },

    contacts: { type: [contactSchema], default: [] },
    emails: { type: [emailSchema], default: [] },

    contracts: { type: [contractSchema], default: [] },
    shuttles: { type: [shuttleSchema], default: [] },

    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'crew_hotels',
  },
)

crewHotelSchema.index({ operatorId: 1, airportIcao: 1 })
crewHotelSchema.index({ operatorId: 1, airportIcao: 1, priority: 1 })
crewHotelSchema.index({ operatorId: 1, isActive: 1 })
crewHotelSchema.index({ operatorId: 1, airportIcao: 1, hotelName: 1 }, { unique: true })

export type CrewHotelDoc = InferSchemaType<typeof crewHotelSchema>
export const CrewHotel = mongoose.model('CrewHotel', crewHotelSchema)
