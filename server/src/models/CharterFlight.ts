import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const charterFlightSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    contractId: { type: String, required: true, index: true },
    flightNumber: { type: String, required: true },
    flightDate: { type: String, required: true },
    departureIata: { type: String, required: true },
    arrivalIata: { type: String, required: true },
    stdUtc: { type: String, required: true },
    staUtc: { type: String, required: true },
    blockMinutes: { type: Number, required: true },
    arrivalDayOffset: { type: Number, default: 0 },
    aircraftTypeIcao: { type: String, default: null },
    aircraftRegistration: { type: String, default: null },
    legType: {
      type: String,
      enum: ['revenue', 'positioning', 'technical'],
      default: 'revenue',
    },
    paxBooked: { type: Number, default: 0 },
    cargoKg: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['planned', 'confirmed', 'assigned', 'operated', 'cancelled'],
      default: 'planned',
      index: true,
    },
    scheduledFlightId: { type: String, default: null },
    crewNotes: { type: String, default: null },
    slotRequested: { type: Boolean, default: false },
    slotStatus: { type: String, default: null },
    createdAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'charterFlights',
  }
)

charterFlightSchema.index({ contractId: 1, flightDate: 1 })

export type CharterFlightDoc = InferSchemaType<typeof charterFlightSchema>
export const CharterFlight = mongoose.model('CharterFlight', charterFlightSchema)
