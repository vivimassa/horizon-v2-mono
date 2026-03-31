/**
 * Expiry formula definitions for crew qualification tracking.
 *
 * Icon references are stored as string keys (matching lucide icon names)
 * for platform-agnostic usage. Map to actual icon components in the UI layer.
 */

export interface FormulaField {
  key: string
  label: string
  type: 'number' | 'text' | 'select'
  unit?: string
  placeholder?: string
  options?: { value: string; label: string }[]
}

export interface ExpiryFormulaDefinition {
  id: string
  label: string
  description: string
  /** Lucide icon name — resolve to platform icon in UI layer */
  icon: string
  fields: FormulaField[]
  supportsAcType: boolean
}

export const EXPIRY_FORMULAS: ExpiryFormulaDefinition[] = [
  {
    id: 'manual',
    label: 'Manual Date',
    description: 'Admin manually sets and renews. No auto calculation.',
    icon: 'pen-line',
    fields: [],
    supportsAcType: false,
  },
  {
    id: 'fixed_validity',
    label: 'Fixed Validity',
    description: 'Expires X months after last completion. Most common.',
    icon: 'calendar-clock',
    fields: [
      { key: 'validity_months', label: 'Validity Period', type: 'number', unit: 'months' },
    ],
    supportsAcType: false,
  },
  {
    id: 'easa_ops',
    label: 'EASA OPS Window',
    description: 'Renewal within window preserves base month. Grace period allowed.',
    icon: 'shield-check',
    fields: [
      { key: 'validity_months', label: 'Validity Period', type: 'number', unit: 'months' },
      { key: 'window_months', label: 'Renewal Window', type: 'number', unit: 'months before' },
      { key: 'grace_days', label: 'Grace Period', type: 'number', unit: 'days after' },
    ],
    supportsAcType: true,
  },
  {
    id: 'age_variation',
    label: 'Age-Based Variation',
    description: 'Validity changes based on crew age (e.g., medicals).',
    icon: 'cake',
    fields: [
      { key: 'age_threshold', label: 'Age Threshold', type: 'number', unit: 'years' },
      { key: 'validity_under', label: 'Validity Under Age', type: 'number', unit: 'months' },
      { key: 'validity_over', label: 'Validity Over Age', type: 'number', unit: 'months' },
    ],
    supportsAcType: false,
  },
  {
    id: 'takeoff_landing',
    label: 'T/O & Landing Recency',
    description: 'Min takeoffs and landings within a rolling period.',
    icon: 'plane-landing',
    fields: [
      { key: 'required_takeoffs', label: 'Required Takeoffs', type: 'number' },
      { key: 'required_landings', label: 'Required Landings', type: 'number' },
      { key: 'rolling_days', label: 'Rolling Period', type: 'number', unit: 'days' },
    ],
    supportsAcType: true,
  },
  {
    id: 'ac_type_recency',
    label: 'Aircraft Type Recency',
    description: 'Must operate on a specific type within a rolling period.',
    icon: 'plane',
    fields: [
      { key: 'min_sectors', label: 'Min Sectors', type: 'number' },
      { key: 'rolling_days', label: 'Rolling Period', type: 'number', unit: 'days' },
    ],
    supportsAcType: true,
  },
  {
    id: 'airport_category',
    label: 'Airport Category',
    description: 'Tracks visits to CAT-B/C airports. Auto-recorded.',
    icon: 'mountain',
    fields: [
      {
        key: 'airport_cat', label: 'Airport Category', type: 'select',
        options: [{ value: 'B', label: 'CAT-B' }, { value: 'C', label: 'CAT-C' }],
      },
      { key: 'rolling_days', label: 'Rolling Period', type: 'number', unit: 'days' },
    ],
    supportsAcType: false,
  },
  {
    id: 'accumulated_hours',
    label: 'Accumulated Hours',
    description: 'Min block hours within a preceding period.',
    icon: 'timer',
    fields: [
      { key: 'min_hours', label: 'Minimum Hours', type: 'number', unit: 'block hours' },
      { key: 'rolling_days', label: 'Rolling Period', type: 'number', unit: 'days' },
    ],
    supportsAcType: false,
  },
  {
    id: 'opc_alternating',
    label: 'Alternating Checks',
    description: 'Two training codes alternate (OPC/LPC). Either renews.',
    icon: 'refresh-cw',
    fields: [
      { key: 'validity_months', label: 'Validity Period', type: 'number', unit: 'months' },
      { key: 'primary_code', label: 'Primary Code', type: 'text', placeholder: 'e.g. OPC' },
      { key: 'alternate_code', label: 'Alternate Code', type: 'text', placeholder: 'e.g. LPC' },
    ],
    supportsAcType: true,
  },
  {
    id: 'route_check',
    label: 'Route / Line Check',
    description: 'En-route check events. Multi-qual crew can alternate.',
    icon: 'map-pin',
    fields: [
      { key: 'validity_months', label: 'Validity Period', type: 'number', unit: 'months' },
    ],
    supportsAcType: true,
  },
  {
    id: 'instrument_flying',
    label: 'Instrument Flying',
    description: 'IFR hours within a rolling period.',
    icon: 'cloud-fog',
    fields: [
      { key: 'min_hours', label: 'Minimum Hours', type: 'number', unit: 'IFR hours' },
      { key: 'rolling_days', label: 'Rolling Period', type: 'number', unit: 'days' },
    ],
    supportsAcType: false,
  },
  {
    id: 'citypairs',
    label: 'City Pair Recency',
    description: 'Must operate to specific stations within the period.',
    icon: 'globe',
    fields: [
      { key: 'validity_months', label: 'Validity Period', type: 'number', unit: 'months' },
    ],
    supportsAcType: false,
  },
  {
    id: 'country_visa',
    label: 'Country / Visa',
    description: 'Visa validity for specific countries. Warns before rostering.',
    icon: 'stamp',
    fields: [
      { key: 'validity_months', label: 'Validity Period', type: 'number', unit: 'months' },
    ],
    supportsAcType: false,
  },
]
