import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const fdtlTableCellSchema = new Schema(
  {
    rowKey: { type: String, required: true },
    colKey: { type: String, required: true },
    valueMinutes: { type: Number, default: null }, // null = prohibited, -1 = N/A
    displayValue: { type: String, default: null },
    source: { type: String, enum: ['government', 'company'], default: 'government' },
    templateValueMinutes: { type: Number, default: null },
    isTemplateDefault: { type: Boolean, default: true },
    notes: { type: String, default: null },
  },
  { _id: false }
)

const fdtlTableSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    frameworkCode: { type: String, required: true },
    tableCode: { type: String, required: true }, // 'CAAV_TABLE_01', 'FAA_TABLE_B', etc.
    tabKey: { type: String, required: true }, // 'fdp', 'fdp_unacclim', 'fdp_augmented', etc.
    label: { type: String, required: true },
    legalReference: { type: String, default: null },
    tableType: { type: String, enum: ['fdp_matrix', 'augmented_matrix', 'cabin_rest', 'timezone_comp', 'single_pilot', 'custom'], required: true },
    rowAxisLabel: { type: String, default: null },
    colAxisLabel: { type: String, default: null },
    rowKeys: { type: [String], default: [] },
    rowLabels: { type: [String], default: [] },
    colKeys: { type: [String], default: [] },
    colLabels: { type: [String], default: [] },
    cells: { type: [fdtlTableCellSchema], default: [] },
    crewType: { type: String, enum: ['all', 'cockpit', 'cabin'], default: 'all' },
    appliesWhen: { type: Schema.Types.Mixed, default: null }, // conditional metadata
    isActive: { type: Boolean, default: true },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'fdtlTables',
  }
)

fdtlTableSchema.index({ operatorId: 1, frameworkCode: 1, tableCode: 1 }, { unique: true })

export type FdtlTableDoc = InferSchemaType<typeof fdtlTableSchema>
export const FdtlTable = mongoose.model('FdtlTable', fdtlTableSchema)
