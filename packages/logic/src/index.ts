// @skyhub/logic — barrel export

// FDTL
export * from './fdtl/engine'
export * from './fdtl/engine-types'
export * from './fdtl/validator'
export * from './fdtl/crew-schedule-validator'
export * from './fdtl/evaluators'
export * from './fdtl/schedule-duty-builder'
export * from './fdtl/activity-category'
export * from './fdtl/utils'
export * from './fdtl/seed-operator-rules'

// IATA messaging (exports formatWeight — uom also has one, so namespace IATA)
export * as IATA from './iata'

// Weather
export * from './weather/metar-parser'
export * from './weather/taf-parser'
export * from './weather/weather-config'

// Crew
export * from './crew/activity-flags'
export * from './crew/crew-complement-templates'
export * from './crew/expiry-formulas'
export * from './crew/expiry-severity'
export * from './crew/seat-eligibility'
export * from './crew/soft-rules-checker'

// Pairing
export * from './pairing/mpp-engine'

// Messaging
export * from './messaging/slot-message-generator'
export * from './messaging/slot-message-parser'
export * from './messaging/asm-parser'
export * from './messaging/asm-diff-engine'

// Utils — tail-assignment & ops-tail-assignment both export autoAssignFlights
export * from './utils/color-helpers'
export * from './utils/date-format'
export * from './utils/fdp-calc'
export * from './utils/flight-display'
export * from './utils/geo'
export * from './utils/timezone'
export * from './utils/uom'
export * from './utils/route-analysis'
export * from './utils/swap-validation'
export * from './utils/tail-assignment'
export * from './utils/tail-assignment-sa'
export * as OpsTailAssignment from './utils/ops-tail-assignment'
export * as OpsTailAssignmentSA from './utils/ops-tail-assignment-sa'
export * from './utils/ssim-generator'
export * from './utils/ssim-parser'
export * from './utils/ssim-comparison'
// NOTE: utils/rotation-builder and utils/airport-lookup are intentionally
// NOT re-exported here. They depend on Node built-ins (node:crypto,
// node:fs, node:path) and are server-only. Re-exporting from this
// universal barrel would pull them into client bundles via any browser
// code that touches @skyhub/logic. Server code imports them directly:
//   from '@skyhub/logic/src/utils/rotation-builder'
//   from '@skyhub/logic/src/utils/airport-lookup'
export * from './utils/schedule-rule-evaluator'
export * from './utils/virtual-placement'
export * from './utils/gantt-time'
export * from './utils/gantt-colors'
export * from './utils/gantt-hit-testing'
export * from './utils/gantt-layout'
export * from './utils/solver-stream'
export * from './utils/advisor-summary-builder'

// Disruption Center — signal detectors + adapter interface
export * from './disruption'
