// @skyhub/constants — barrel export
export * from './airport-countries'
export * from './crew-positions'
export * from './country-flags'
export * from './operators'
export * from './module-registry'

// gantt-settings and movement-settings both export AC_TYPE_COLOR_PALETTE,
// so re-export them as namespaces to avoid collision
export * as GanttSettings from './gantt-settings'
export * as MovementSettings from './movement-settings'
