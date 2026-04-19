import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const crewPairingSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    crewId: { type: String, required: true, index: true },
    type: { type: String, enum: ['Same', 'Not same'], required: true },
    what: { type: String, enum: ['Flights', 'Offs'], required: true },
    pairedCrewId: { type: String, required: true, index: true },
    startDate: { type: String, default: null },
    endDate: { type: String, default: null },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'crewPairings' },
)

export type CrewPairingDoc = InferSchemaType<typeof crewPairingSchema>
export const CrewPairing = mongoose.model('CrewPairing', crewPairingSchema)
