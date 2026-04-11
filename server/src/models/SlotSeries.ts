import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const slotSeriesSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    airportIata: { type: String, required: true },
    seasonCode: { type: String, required: true },
    arrivalFlightNumber: { type: String, default: null },
    departureFlightNumber: { type: String, default: null },
    arrivalOriginIata: { type: String, default: null },
    departureDestIata: { type: String, default: null },
    requestedArrivalTime: { type: Number, default: null },
    requestedDepartureTime: { type: Number, default: null },
    allocatedArrivalTime: { type: Number, default: null },
    allocatedDepartureTime: { type: Number, default: null },
    overnightIndicator: { type: Number, default: 0 },
    periodStart: { type: String, required: true },
    periodEnd: { type: String, required: true },
    daysOfOperation: { type: String, default: '1234567' },
    frequencyRate: { type: Number, default: 1 },
    seats: { type: Number, default: null },
    aircraftTypeIcao: { type: String, default: null },
    arrivalServiceType: { type: String, default: null },
    departureServiceType: { type: String, default: null },
    status: {
      type: String,
      enum: [
        'draft',
        'submitted',
        'confirmed',
        'offered',
        'waitlisted',
        'refused',
        'conditional',
        'cancelled',
        'historic',
      ],
      default: 'draft',
      index: true,
    },
    priorityCategory: {
      type: String,
      enum: ['historic', 'changed_historic', 'new_entrant', 'new', 'adhoc'],
      default: 'new',
    },
    historicEligible: { type: Boolean, default: false },
    lastActionCode: { type: String, default: null },
    lastCoordinatorCode: { type: String, default: null },
    flexibilityArrival: { type: String, default: null },
    flexibilityDeparture: { type: String, default: null },
    minTurnaroundMinutes: { type: Number, default: null },
    coordinatorRef: { type: String, default: null },
    coordinatorReasonArrival: { type: String, default: null },
    coordinatorReasonDeparture: { type: String, default: null },
    waitlistPosition: { type: Number, default: null },
    linkedScheduledFlightId: { type: String, default: null },
    notes: { type: String, default: null },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'slotSeries',
  },
)

slotSeriesSchema.index({ operatorId: 1, airportIata: 1, seasonCode: 1 })
slotSeriesSchema.index({ operatorId: 1, status: 1 })
slotSeriesSchema.index({ linkedScheduledFlightId: 1 })

export type SlotSeriesDoc = InferSchemaType<typeof slotSeriesSchema>
export const SlotSeries = mongoose.model('SlotSeries', slotSeriesSchema)
