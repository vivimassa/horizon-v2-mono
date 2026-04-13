import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const flightInstanceSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    scheduledFlightId: { type: String, default: null, index: true },
    flightNumber: { type: String, required: true },
    operatingDate: { type: String, required: true, index: true },

    dep: {
      icao: { type: String, default: null },
      iata: { type: String, default: null },
    },
    arr: {
      icao: { type: String, default: null },
      iata: { type: String, default: null },
    },

    schedule: {
      stdUtc: { type: Number, default: null },
      staUtc: { type: Number, default: null },
    },
    estimated: {
      etdUtc: { type: Number, default: null },
      etaUtc: { type: Number, default: null },
    },
    actual: {
      doorCloseUtc: { type: Number, default: null },
      atdUtc: { type: Number, default: null },
      offUtc: { type: Number, default: null },
      onUtc: { type: Number, default: null },
      ataUtc: { type: Number, default: null },
    },

    depInfo: {
      terminal: { type: String, default: null },
      gate: { type: String, default: null },
      stand: { type: String, default: null },
      ctot: { type: String, default: null },
    },
    arrInfo: {
      terminal: { type: String, default: null },
      gate: { type: String, default: null },
      stand: { type: String, default: null },
    },

    tail: {
      registration: { type: String, default: null },
      icaoType: { type: String, default: null },
    },

    pax: {
      adultExpected: { type: Number, default: null },
      adultActual: { type: Number, default: null },
      childExpected: { type: Number, default: null },
      childActual: { type: Number, default: null },
      infantExpected: { type: Number, default: null },
      infantActual: { type: Number, default: null },
    },

    fuel: {
      initial: { type: Number, default: null },
      uplift: { type: Number, default: null },
      burn: { type: Number, default: null },
      flightPlan: { type: Number, default: null },
    },

    cargo: [
      {
        _id: false,
        category: { type: String, required: true },
        weight: { type: Number, default: null },
        pieces: { type: Number, default: null },
      },
    ],

    crew: [
      {
        _id: false,
        employeeId: { type: String, required: true },
        role: { type: String, required: true },
        name: { type: String, required: true },
      },
    ],

    delays: [
      {
        _id: false,
        code: { type: String, required: true },
        minutes: { type: Number, required: true },
        reason: { type: String, default: '' },
        category: { type: String, default: '' },
      },
    ],

    memos: [
      {
        _id: false,
        id: { type: String, required: true },
        category: { type: String, default: 'general' },
        content: { type: String, required: true },
        author: { type: String, default: '' },
        pinned: { type: Boolean, default: false },
        createdAt: { type: String, default: () => new Date().toISOString() },
      },
    ],

    connections: {
      outgoing: [
        {
          _id: false,
          flightNumber: { type: String, required: true },
          pax: { type: Number, default: 0 },
        },
      ],
      incoming: [
        {
          _id: false,
          flightNumber: { type: String, required: true },
          pax: { type: Number, default: 0 },
        },
      ],
    },

    status: {
      type: String,
      enum: [
        'scheduled',
        'assigned',
        'crewed',
        'departed',
        'onTime',
        'delayed',
        'cancelled',
        'diverted',
        'arrived',
        'completed',
      ],
      default: 'scheduled',
      index: true,
    },

    /** Flight protected from disruption solver — solver will never delay/cancel/swap this flight */
    isProtected: { type: Boolean, default: false },

    /** Fields manually overridden — protected from re-materialization from ScheduledFlight pattern */
    lockedFields: [{ type: String }],

    syncMeta: {
      updatedAt: { type: Number, default: () => Date.now() },
      version: { type: Number, default: 1 },
    },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'flightInstances',
  },
)

flightInstanceSchema.index({ operatorId: 1, operatingDate: 1 })
flightInstanceSchema.index({ operatorId: 1, scheduledFlightId: 1, operatingDate: 1 })

export type FlightInstanceDoc = InferSchemaType<typeof flightInstanceSchema>
export const FlightInstance = mongoose.model('FlightInstance', flightInstanceSchema)
