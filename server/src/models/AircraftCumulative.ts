import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const aircraftCumulativeSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    aircraftId: { type: String, required: true },
    totalFlightHours: { type: Number, default: 0 },
    totalCycles: { type: Number, default: 0 },
    totalBlockHours: { type: Number, default: 0 },
    todayFlightHours: { type: Number, default: 0 },
    todayCycles: { type: Number, default: 0 },
    avgDailyFlightHours: { type: Number, default: 0 },
    avgDailyCycles: { type: Number, default: 0 },
    anchorDate: { type: String, default: null },
    anchorFlightHours: { type: Number, default: 0 },
    anchorCycles: { type: Number, default: 0 },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'aircraftCumulatives',
  },
)

aircraftCumulativeSchema.index({ operatorId: 1, aircraftId: 1 }, { unique: true })

export type AircraftCumulativeDoc = InferSchemaType<typeof aircraftCumulativeSchema>
export const AircraftCumulative = mongoose.model('AircraftCumulative', aircraftCumulativeSchema)
