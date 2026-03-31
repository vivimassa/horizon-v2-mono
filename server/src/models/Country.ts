import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const countrySchema = new Schema(
  {
    _id: { type: String, required: true },
    isoCode2: { type: String, required: true, unique: true },
    isoCode3: { type: String, required: true },
    name: { type: String, required: true },
    officialName: { type: String, default: null },
    region: { type: String, default: null },
    subRegion: { type: String, default: null },
    icaoPrefix: { type: String, default: null },
    currencyCode: { type: String, default: null },
    currencyName: { type: String, default: null },
    currencySymbol: { type: String, default: null },
    phoneCode: { type: String, default: null },
    flagEmoji: { type: String, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    isActive: { type: Boolean, default: true },
    createdAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'countries',
  }
)

countrySchema.index({ name: 1 })
countrySchema.index({ region: 1 })

export type CountryDoc = InferSchemaType<typeof countrySchema>
export const Country = mongoose.model('Country', countrySchema)
