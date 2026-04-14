import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const contactSubmissionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    airline: { type: String, default: '', trim: true },
    role: { type: String, default: '', trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    phone: { type: String, default: '', trim: true },
    country: { type: String, default: '', trim: true },
    message: { type: String, required: true },
    source: { type: String, default: '', trim: true },
    consent: { type: Boolean, required: true },
    ipHash: { type: String, default: null },
    userAgent: { type: String, default: null },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'archived'],
      default: 'new',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'contact_submissions',
  },
)

export type ContactSubmissionDoc = InferSchemaType<typeof contactSubmissionSchema>

export const ContactSubmission =
  mongoose.models.ContactSubmission || mongoose.model('ContactSubmission', contactSubmissionSchema)
