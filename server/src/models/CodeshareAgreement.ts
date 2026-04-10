import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const codeshareAgreementSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    partnerAirlineCode: { type: String, required: true },
    partnerAirlineName: { type: String, required: true },
    partnerNumericCode: { type: String, default: null },
    agreementType: {
      type: String,
      enum: ['free_sale', 'block_space', 'hard_block'],
      required: true,
    },
    effectiveFrom: { type: String, required: true },
    effectiveUntil: { type: String, default: null },
    status: {
      type: String,
      enum: ['active', 'pending', 'suspended', 'terminated'],
      default: 'pending',
      index: true,
    },
    brandColor: { type: String, default: null },
    notes: { type: String, default: null },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'codeshareAgreements',
  }
)

codeshareAgreementSchema.index({ operatorId: 1, partnerAirlineCode: 1 }, { unique: true })

export type CodeshareAgreementDoc = InferSchemaType<typeof codeshareAgreementSchema>
export const CodeshareAgreement = mongoose.model('CodeshareAgreement', codeshareAgreementSchema)
