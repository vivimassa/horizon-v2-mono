import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const optimizerRunSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    periodFrom: { type: String, required: true },
    periodTo: { type: String, required: true },

    // Config used for this run
    config: {
      preset: { type: String, required: true },  // quick | normal | deep
      method: { type: String, required: true },   // minimize | balance | fuel
    },

    // Summary stats
    stats: {
      totalFlights: { type: Number, required: true },
      assigned: { type: Number, required: true },
      overflow: { type: Number, required: true },
      chainBreaks: { type: Number, required: true },
      totalFuelKg: { type: Number, default: null },
      baselineFuelKg: { type: Number, default: null },
      fuelSavingsPercent: { type: Number, default: null },
    },

    // Full assignment data (flightId → registration)
    assignments: [{
      _id: false,
      flightId: { type: String, required: true },
      registration: { type: String, required: true },
    }],

    // Overflow flight IDs (couldn't be assigned)
    overflowFlightIds: [{ type: String }],

    // Chain breaks
    chainBreaks: [{
      _id: false,
      flightId: { type: String, required: true },
      prevArr: { type: String, required: true },
      nextDep: { type: String, required: true },
    }],

    // Per-type breakdown
    typeBreakdown: [{
      _id: false,
      icaoType: { type: String, required: true },
      typeName: { type: String, required: true },
      totalFlights: { type: Number, required: true },
      assigned: { type: Number, required: true },
      overflow: { type: Number, required: true },
      totalBlockHours: { type: Number, required: true },
      aircraftCount: { type: Number, required: true },
      avgBhPerDay: { type: Number, required: true },
    }],

    elapsedMs: { type: Number, required: true },
    createdAt: { type: String, required: true },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'optimizerRuns',
  }
)

optimizerRunSchema.index({ operatorId: 1, periodFrom: 1, periodTo: 1 })

export type OptimizerRunDoc = InferSchemaType<typeof optimizerRunSchema>
export const OptimizerRun = mongoose.model('OptimizerRun', optimizerRunSchema)
