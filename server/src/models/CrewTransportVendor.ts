import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * 4.1.8.2 Crew Transport — vendor master data.
 *
 * Mirrors CrewHotel shape (per-airport master, contracts, contacts) so the
 * admin UI can host both behind a single segment toggle. Transport-specific
 * additions: contracts have vehicle tiers + SLA, plus an optional driver
 * roster.
 */

const contactSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, default: null },
    telephone: { type: String, default: null },
    email: { type: String, default: null },
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

const vehicleTierSchema = new Schema(
  {
    _id: { type: String, required: true },
    tierName: { type: String, required: true }, // e.g. 'Sedan-4', 'Van-8', 'Minibus-16'
    paxCapacity: { type: Number, default: 0 },
    ratePerTrip: { type: Number, default: 0 },
    ratePerHour: { type: Number, default: 0 },
  },
  { _id: false, timestamps: false },
)

const contractSchema = new Schema(
  {
    _id: { type: String, required: true },
    contractNo: { type: String, default: null },
    priority: { type: Number, default: 1 },
    startDateUtcMs: { type: Number, default: null },
    endDateUtcMs: { type: Number, default: null },
    weekdayMask: { type: [Boolean], default: () => [true, true, true, true, true, true, true] },
    currency: { type: String, default: 'USD' },
    /** Operator must dispatch at least this many minutes ahead. */
    minLeadTimeMin: { type: Number, default: 30 },
    /** Vendor confirmation SLA in minutes (default 15). */
    slaMin: { type: Number, default: 15 },
    vehicleTiers: { type: [vehicleTierSchema], default: [] },
  },
  { _id: false, timestamps: false },
)

const driverSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String, default: null },
    vehiclePlate: { type: String, default: null },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { _id: false, timestamps: false },
)

const crewTransportVendorSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true },

    vendorName: { type: String, required: true },
    /** Primary airport this vendor serves (groups in the admin list). */
    baseAirportIcao: { type: String, required: true },
    priority: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },

    addressLine1: { type: String, default: null },
    addressLine2: { type: String, default: null },
    addressLine3: { type: String, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },

    /** Additional airports the vendor covers via the same contract. */
    serviceAreaIcaos: { type: [String], default: [] },

    contacts: { type: [contactSchema], default: [] },
    emails: { type: [emailSchema], default: [] },

    contracts: { type: [contractSchema], default: [] },

    /** Optional driver roster — some operators manage drivers vendor-side,
     *  others maintain their own pool. */
    drivers: { type: [driverSchema], default: [] },

    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'crew_transport_vendors',
  },
)

crewTransportVendorSchema.index({ operatorId: 1, baseAirportIcao: 1 })
crewTransportVendorSchema.index({ operatorId: 1, baseAirportIcao: 1, priority: 1 })
crewTransportVendorSchema.index({ operatorId: 1, isActive: 1 })
crewTransportVendorSchema.index({ operatorId: 1, baseAirportIcao: 1, vendorName: 1 }, { unique: true })

export type CrewTransportVendorDoc = InferSchemaType<typeof crewTransportVendorSchema>
export const CrewTransportVendor = mongoose.model('CrewTransportVendor', crewTransportVendorSchema)
