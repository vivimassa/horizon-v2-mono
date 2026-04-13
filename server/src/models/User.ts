import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const userSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },

    // ── Profile ──
    profile: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, default: '' },
      officePhone: { type: String, default: '' },
      dateOfBirth: { type: String, default: '' },
      gender: { type: String, default: '' },
      department: { type: String, default: '' },
      employeeId: { type: String, default: '' },
      avatarUrl: { type: String, default: '' },
      location: { type: String, default: '' },
    },

    // ── Security ──
    security: {
      passwordHash: { type: String, default: '' },
      passwordResetToken: { type: String, default: '' },
      passwordResetExpiry: { type: String, default: '' },
      twoFactorEnabled: { type: Boolean, default: false },
      biometricEnabled: { type: Boolean, default: false },
      lastPasswordChange: { type: String, default: '' },
      sessions: [
        {
          device: { type: String },
          browser: { type: String },
          location: { type: String },
          lastActive: { type: String },
          isCurrent: { type: Boolean, default: false },
        },
      ],
    },

    // ── Preferences ──
    preferences: {
      language: { type: String, default: 'en' },
      timezone: { type: String, default: 'Asia/Ho_Chi_Minh' },
      dateFormat: { type: String, default: 'dd MMM yyyy' },
      timeFormat: { type: String, default: '24h' },
      units: { type: String, default: 'metric' },
      numberFormat: { type: String, default: 'comma' },
    },

    // ── Notifications ──
    notifications: {
      pushEnabled: { type: Boolean, default: true },
      emailEnabled: { type: Boolean, default: true },
      inAppEnabled: { type: Boolean, default: true },
      emailDigest: { type: String, default: 'daily', enum: ['off', 'instant', 'daily', 'weekly'] },
      quietHoursStart: { type: String, default: '' },
      quietHoursEnd: { type: String, default: '' },
      categories: {
        flightUpdates: { type: Boolean, default: true },
        crewChanges: { type: Boolean, default: true },
        systemAlerts: { type: Boolean, default: true },
        maintenance: { type: Boolean, default: false },
        reports: { type: Boolean, default: false },
      },
    },

    // ── Display settings ──
    display: {
      textScale: { type: String, default: 'default', enum: ['small', 'default', 'large', 'xlarge'] },
      contrast: { type: Number, default: 1, min: 0, max: 2 },
      brightness: { type: Number, default: 50, min: 0, max: 100 },
      accentColor: { type: String, default: '#15803d' },
      dynamicBackground: { type: Boolean, default: true },
      backgroundPreset: { type: String, default: 'aurora', enum: ['aurora', 'ember', 'lagoon', 'prism', 'none'] },
      colorMode: { type: String, default: 'light', enum: ['light', 'dark'] },
    },

    // ── Role & status ──
    role: { type: String, required: true, default: 'viewer', enum: ['administrator', 'manager', 'operator', 'viewer'] },
    isActive: { type: Boolean, default: true },
    lastLoginUtc: { type: String, default: '' },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    _id: false,
    collection: 'users',
    timestamps: false,
  },
)

userSchema.index({ email: 1 }, { unique: true, sparse: true })
userSchema.index({ operatorId: 1, role: 1 })

export type UserDoc = InferSchemaType<typeof userSchema>
export const User = mongoose.model('User', userSchema)
