import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const scheduledFlightSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    seasonCode: { type: String, default: '' },
    airlineCode: { type: String, required: true },
    flightNumber: { type: String, required: true },
    suffix: { type: String, default: null },
    depStation: { type: String, required: true },
    arrStation: { type: String, required: true },
    depAirportId: { type: String, default: null },
    arrAirportId: { type: String, default: null },
    stdUtc: { type: String, required: true },
    staUtc: { type: String, required: true },
    stdLocal: { type: String, default: null },
    staLocal: { type: String, default: null },
    blockMinutes: { type: Number, default: null },
    departureDayOffset: { type: Number, default: 1 },
    arrivalDayOffset: { type: Number, default: 1 },
    daysOfWeek: { type: String, required: true },
    aircraftTypeId: { type: String, default: null },
    aircraftTypeIcao: { type: String, default: null },
    aircraftReg: { type: String, default: null },
    serviceType: { type: String, default: 'J' },
    status: {
      type: String,
      enum: ['draft', 'active', 'suspended', 'cancelled'],
      default: 'draft',
      index: true,
    },
    previousStatus: { type: String, default: null },
    effectiveFrom: { type: String, required: true },
    effectiveUntil: { type: String, required: true },
    cockpitCrewRequired: { type: Number, default: null },
    cabinCrewRequired: { type: Number, default: null },
    isEtops: { type: Boolean, default: false },
    isOverwater: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    scenarioId: { type: String, default: null, index: true },
    rotationId: { type: String, default: null },
    rotationSequence: { type: Number, default: null },
    rotationLabel: { type: String, default: null },
    source: {
      type: String,
      enum: ['manual', 'ssim_import', 'migration'],
      default: 'manual',
    },
    sortOrder: { type: Number, default: 0 },
    formatting: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'scheduledFlights',
  }
)

scheduledFlightSchema.index({ operatorId: 1, seasonCode: 1, scenarioId: 1 })
scheduledFlightSchema.index({ operatorId: 1, flightNumber: 1, effectiveFrom: 1 })
scheduledFlightSchema.index({ operatorId: 1, rotationId: 1 })

export type ScheduledFlightDoc = InferSchemaType<typeof scheduledFlightSchema>
export const ScheduledFlight = mongoose.model('ScheduledFlight', scheduledFlightSchema)
