import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const crewAirportRestrictionSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    crewId: { type: String, required: true, index: true },
    airport: { type: String, required: true }, // ICAO
    type: { type: String, enum: ['RESTRICTED', 'PREFERRED'], required: true },
    startDate: { type: String, default: null },
    endDate: { type: String, default: null },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'crewAirportRestrictions' },
)

crewAirportRestrictionSchema.index({ crewId: 1, airport: 1 })

export type CrewAirportRestrictionDoc = InferSchemaType<typeof crewAirportRestrictionSchema>
export const CrewAirportRestriction = mongoose.model('CrewAirportRestriction', crewAirportRestrictionSchema)
