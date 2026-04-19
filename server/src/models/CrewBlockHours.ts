import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const crewBlockHoursSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    crewId: { type: String, required: true, index: true },
    aircraftType: { type: String, required: true },
    position: { type: String, required: true },
    blockHours: { type: String, default: null },
    trainingHours: { type: String, default: null },
    firstFlight: { type: String, default: null },
    lastFlight: { type: String, default: null },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'crewBlockHours' },
)

crewBlockHoursSchema.index({ crewId: 1, aircraftType: 1, position: 1 }, { unique: true })

export type CrewBlockHoursDoc = InferSchemaType<typeof crewBlockHoursSchema>
export const CrewBlockHours = mongoose.model('CrewBlockHours', crewBlockHoursSchema)
