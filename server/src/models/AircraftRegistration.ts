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
