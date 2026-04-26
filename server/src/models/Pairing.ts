import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * Operating pairing — a sequence of flights worked as one duty trip,
 * with live FDTL legality checks.  Module 4.1.5 Crew Pairing.
 *
 * NOTE: The sibling model `CrewPairing.ts` represents buddy-pairing
 * (Same/Not-same flights or offs between two crew members) — a totally
 * different concept used by roster assignment. Do not confuse the two.
 */
const pairingLegSchema = new Schema(
  {
    flightId: { type: String, required: true },
    flightDate: { type: String, required: true }, // 'YYYY-MM-DD'
    legOrder: { type: Number, required: true },
    isDeadhead: { type: Boolean, default: false },
    dutyDay: { type: Number, required: true }, // 1..N within pairing
    depStation: { type: String, required: true },
    arrStation: { type: String, required: true },
    flightNumber: { type: String, required: true },
    stdUtcIso: { type: String, required: true },
    staUtcIso: { type: String, required: true },
    blockMinutes: { type: Number, required: true },
    aircraftTypeIcao: { type: String, default: null },
    /** Registration the leg was operated by when the pairing was saved.
     *  Source cascade at create time: virtual placement (Gantt layout) →
     *  flight pool `tailNumber` → null. Persisting here means the pairing
     *  shows the correct tail even when the pool loses its overlay. */
    tailNumber: { type: String, default: null },
  },
  { _id: false },
)

const pairingSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    scenarioId: { type: String, default: null, index: true }, // null = production
    seasonCode: { type: String, default: null },
    pairingCode: { type: String, required: true },
    baseAirport: { type: String, required: true },
    baseId: { type: String, default: null },
    aircraftTypeIcao: { type: String, default: null },
    aircraftTypeId: { type: String, default: null },
    fdtlStatus: { type: String, enum: ['legal', 'warning', 'violation'], default: 'legal' },
    workflowStatus: { type: String, enum: ['draft', 'committed'], default: 'draft' },
    totalBlockMinutes: { type: Number, default: 0 },
    totalDutyMinutes: { type: Number, default: 0 },
    pairingDays: { type: Number, default: 1 },
    startDate: { type: String, required: true }, // 'YYYY-MM-DD' UTC
    endDate: { type: String, required: true },
    reportTime: { type: String, default: null }, // ISO UTC
    releaseTime: { type: String, default: null },
    numberOfDuties: { type: Number, default: 1 },
    numberOfSectors: { type: Number, default: 0 },
    layoverAirports: { type: [String], default: [] },
    complementKey: { type: String, default: 'standard' },
    cockpitCount: { type: Number, default: 2 },
    facilityClass: { type: String, default: null },
    crewCounts: { type: Schema.Types.Mixed, default: null },
    legs: { type: [pairingLegSchema], default: [] },
    lastLegalityResult: { type: Schema.Types.Mixed, default: null },
    routeChain: { type: String, default: '' },
    createdBy: { type: String, required: true },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'pairings' },
)

// Hot: 4.1.6 Crew Schedule aggregator + auto-roster scope load.
//   Pairing.find({ operatorId, scenarioId, endDate: { $gte: from }, startDate: { $lte: to } }).
// Equality on (operatorId, scenarioId) prefix; first range column is startDate.
pairingSchema.index({ operatorId: 1, scenarioId: 1, startDate: 1, endDate: 1 })
pairingSchema.index({ operatorId: 1, pairingCode: 1 })
pairingSchema.index({ 'legs.flightId': 1, 'legs.flightDate': 1 })
// Used when the aggregator is called with ?baseAirport=… (filter panel).
pairingSchema.index({ operatorId: 1, baseAirport: 1, startDate: 1 })

export type PairingDoc = InferSchemaType<typeof pairingSchema>
export type PairingLegDoc = InferSchemaType<typeof pairingLegSchema>
export const Pairing = mongoose.model('Pairing', pairingSchema)
