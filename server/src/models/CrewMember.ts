import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const crewMemberSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },

    // Identity
    employeeId: { type: String, required: true },
    firstName: { type: String, required: true },
    middleName: { type: String, default: null },
    lastName: { type: String, required: true },
    shortCode: { type: String, default: null },
    gender: { type: String, enum: ['male', 'female', 'other', null], default: null },
    dateOfBirth: { type: String, default: null },
    nationality: { type: String, default: null },

    // Assignment — base → Airport._id, position → CrewPosition._id
    base: { type: String, default: null },
    position: { type: String, default: null },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'terminated'],
      default: 'active',
    },
    employmentDate: { type: String, default: null },
    exitDate: { type: String, default: null },
    exitReason: { type: String, default: null },
    contractType: { type: String, default: null },
    seniority: { type: Number, default: null },
    seniorityGroup: { type: Number, default: 0 },
    languages: [{ type: String }],
    apisAlias: { type: String, default: null },

    // Residence & contact
    countryOfResidence: { type: String, default: null },
    residencePermitNo: { type: String, default: null },
    emailPrimary: { type: String, default: null },
    emailSecondary: { type: String, default: null },
    addressLine1: { type: String, default: null },
    addressLine2: { type: String, default: null },
    addressCity: { type: String, default: null },
    addressState: { type: String, default: null },
    addressZip: { type: String, default: null },
    addressCountry: { type: String, default: null },

    // Emergency / next-of-kin
    emergencyName: { type: String, default: null },
    emergencyRelationship: { type: String, default: null },
    emergencyPhone: { type: String, default: null },

    // Operational flags
    noAccommodationAirports: [{ type: String }],
    transportRequired: { type: Boolean, default: false },
    hotelAtHomeBase: { type: Boolean, default: false },
    travelTimeMinutes: { type: Number, default: null },
    payrollNumber: { type: String, default: null },
    minGuarantee: { type: String, default: null },
    flyWithSeniorUntil: { type: String, default: null },
    doNotScheduleAltPosition: { type: String, default: null },
    standbyExempted: { type: Boolean, default: false },
    crewUnderTraining: { type: Boolean, default: false },
    noDomesticFlights: { type: Boolean, default: false },
    noInternationalFlights: { type: Boolean, default: false },
    maxLayoverStops: { type: Number, default: null },

    // Media
    photoUrl: { type: String, default: null },

    /**
     * Per-crew publish-visibility flag. When true, the crew member sees
     * their own duties in the mobile app. When false, planner hasn't
     * committed yet and the crew's rostered duties are hidden client-side.
     *
     * Toggled from 4.1.6 Crew Schedule → right-click crew name → "Toggle
     * published schedule" (distinct from the global F10 snapshot overlay).
     */
    isScheduleVisible: { type: Boolean, default: true },

    /** Free-text HR notes — read-only in the Crew Schedule "extra info"
     *  dialog; owned by the Crew Master Data module. */
    hrNotes: { type: String, default: null },

    // ── SkyHub Crew mobile app auth ─────────────────────────────────────
    // PIN is 6 digits, bcrypt-hashed (salt 12 — same cost factor as User).
    // pinHash is null until the crew member completes first-login set-PIN
    // flow. tempPinHash is the one-time temp PIN issued by Crew Ops.
    crewApp: {
      pinHash: { type: String, default: null },
      pinSetAt: { type: String, default: null },
      tempPinHash: { type: String, default: null },
      tempPinExpiresAt: { type: String, default: null },
      pinFailedAttempts: { type: Number, default: 0 },
      pinLockedUntil: { type: String, default: null },
      lastLoginAt: { type: String, default: null },
      pushTokens: [
        {
          _id: false,
          token: { type: String, required: true },
          platform: { type: String, enum: ['ios', 'android'], required: true },
          registeredAt: { type: String, required: true },
          lastUsedAt: { type: String, default: null },
        },
      ],
    },

    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'crewMembers' },
)

crewMemberSchema.index({ operatorId: 1, employeeId: 1 }, { unique: true })
crewMemberSchema.index({ operatorId: 1, base: 1 })
crewMemberSchema.index({ operatorId: 1, status: 1 })
crewMemberSchema.index({ operatorId: 1, position: 1 })

export type CrewMemberDoc = InferSchemaType<typeof crewMemberSchema>
export const CrewMember = mongoose.model('CrewMember', crewMemberSchema)
