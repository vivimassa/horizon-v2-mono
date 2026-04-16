import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const nonCrewPersonSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },

    // Identity
    fullName: {
      first: { type: String, required: true },
      middle: { type: String, default: null },
      last: { type: String, required: true },
    },
    dateOfBirth: { type: String, required: true }, // 'YYYY-MM-DD'
    gender: { type: String, enum: ['M', 'F', 'X'], required: true },
    nationality: { type: String, required: true }, // ISO 3166-1 alpha-3

    // Passport — required for APIS
    passport: {
      number: { type: String, required: true },
      countryOfIssue: { type: String, required: true }, // ISO 3166-1 alpha-3
      expiryDate: { type: String, required: true }, // 'YYYY-MM-DD'
    },

    // Contact — minimum for APIS + operational contact
    contact: {
      email: { type: String, default: null },
      phone: { type: String, default: null },
    },

    // Employer
    company: { type: String, default: null },
    department: { type: String, default: null },

    // Avatar
    avatarUrl: { type: String, default: null },

    // Jump seater flags
    jumpseatPriority: {
      type: String,
      enum: ['low', 'normal', 'high'],
      default: 'normal',
    },
    doNotList: { type: Boolean, default: false },
    terminated: { type: Boolean, default: false },

    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'nonCrewPeople',
  },
)

nonCrewPersonSchema.index({ operatorId: 1, terminated: 1 })
nonCrewPersonSchema.index({ operatorId: 1, 'passport.number': 1 }, { unique: true })

export type NonCrewPersonDoc = InferSchemaType<typeof nonCrewPersonSchema>
export const NonCrewPerson = mongoose.model('NonCrewPerson', nonCrewPersonSchema)
