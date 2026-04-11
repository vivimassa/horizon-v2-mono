import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const blockHourSchema = new Schema(
  {
    _id: { type: String, required: true },
    aircraftTypeIcao: { type: String, default: null },
    seasonType: { type: String, default: 'annual' }, // annual | summer | winter
    dir1BlockMinutes: { type: Number, required: true },
    dir2BlockMinutes: { type: Number, required: true },
    dir1FlightMinutes: { type: Number, default: null },
    dir2FlightMinutes: { type: Number, default: null },
    dir1FuelKg: { type: Number, default: null },
    dir2FuelKg: { type: Number, default: null },
    notes: { type: String, default: null },
  },
  { _id: false, timestamps: false },
)

const cityPairSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true },

    // Station 1 (alphabetically first ICAO)
    station1Icao: { type: String, required: true },
    station1Iata: { type: String, default: null },
    station1Name: { type: String, default: null },
    station1City: { type: String, default: null },
    station1CountryIso2: { type: String, default: null },
    station1Lat: { type: Number, default: null },
    station1Lon: { type: Number, default: null },

    // Station 2
    station2Icao: { type: String, required: true },
    station2Iata: { type: String, default: null },
    station2Name: { type: String, default: null },
    station2City: { type: String, default: null },
    station2CountryIso2: { type: String, default: null },
    station2Lat: { type: Number, default: null },
    station2Lon: { type: Number, default: null },

    // Distance & classification
    distanceNm: { type: Number, default: null },
    distanceKm: { type: Number, default: null },
    routeType: { type: String, default: 'unknown' }, // domestic | regional | international | long-haul | ultra-long-haul | unknown
    standardBlockMinutes: { type: Number, default: null },

    // ETOPS
    isEtops: { type: Boolean, default: false },
    etopsDiversionTimeMinutes: { type: Number, default: null },
    isOverwater: { type: Boolean, default: false },

    // Block hours by aircraft type
    blockHours: { type: [blockHourSchema], default: [] },

    // Status
    isActive: { type: Boolean, default: true },
    notes: { type: String, default: null },

    createdAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'city_pairs',
  },
)

cityPairSchema.index({ operatorId: 1, station1Icao: 1, station2Icao: 1 }, { unique: true })
cityPairSchema.index({ operatorId: 1, routeType: 1 })
cityPairSchema.index({ operatorId: 1, isActive: 1 })

export type CityPairDoc = InferSchemaType<typeof cityPairSchema>
export const CityPair = mongoose.model('CityPair', cityPairSchema)
