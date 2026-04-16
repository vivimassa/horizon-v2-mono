import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const weatherObservationSchema = new Schema(
  {
    _id: { type: String, required: true },
    icao: { type: String, required: true, index: true },
    observedAt: { type: Date, required: true },
    raw: { type: String, required: true },
    flightCategory: { type: String, required: true, enum: ['VFR', 'MVFR', 'IFR', 'LIFR'] },
    alertTier: { type: String, required: true, enum: ['none', 'caution', 'warn'] },
    windDirectionDeg: { type: Number, default: null },
    windSpeedKts: { type: Number, default: null },
    windGustKts: { type: Number, default: null },
    visibilityMeters: { type: Number, default: null },
    ceilingFeet: { type: Number, default: null },
    temperatureC: { type: Number, default: null },
    dewpointC: { type: Number, default: null },
    weatherPhenomena: { type: [String], default: [] },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, collection: 'weatherObservations', timestamps: false },
)

// Latest-per-station lookup
weatherObservationSchema.index({ icao: 1, observedAt: -1 })
// TTL — purge observations older than 72h (weather-config.METAR_RETENTION_HOURS)
weatherObservationSchema.index({ observedAt: 1 }, { expireAfterSeconds: 72 * 60 * 60 })

export type WeatherObservationDoc = InferSchemaType<typeof weatherObservationSchema>
export const WeatherObservation = mongoose.model('WeatherObservation', weatherObservationSchema)
