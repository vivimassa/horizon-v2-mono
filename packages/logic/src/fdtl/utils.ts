// ─── FDTL Utility Helpers ────────────────────────────────────────────────────


/**
 * Convert minutes to "H:MM" display string.
 * e.g. 840 → "14:00", 570 → "9:30"
 */
export function minutesToDisplay(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${m.toString().padStart(2, '0')}`
}

/**
 * Parse "H:MM" or "HH:MM" display string to total minutes.
 * e.g. "14:00" → 840, "9:30" → 570
 * Returns NaN if the input is not a valid duration string.
 */
export function displayToMinutes(display: string): number {
  const match = display.trim().match(/^(\d+):(\d{2})$/)
  if (!match) return NaN
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  if (m >= 60) return NaN
  return h * 60 + m
}

/**
 * Determine whether a new rule value is more restrictive than the government value.
 *
 * For **maximum limits** (most rules): more restrictive = lower value.
 * For **minimum rest** rules (identified by `rule_code` containing "REST" or "FREE"):
 *   more restrictive = higher value.
 *
 * Returns:
 *   true  — new value is more restrictive (compliant or stricter than regulation)
 *   false — new value is less restrictive (potential compliance issue — warn the user)
 *   null  — cannot determine (e.g. boolean / text types)
 */
export function isMoreRestrictive(
  newValue: string,
  govValue: string,
  valueType: string,
  ruleCode: string,
): boolean | null {
  if (valueType === 'boolean' || valueType === 'text') return null

  const isRestRule = /REST|FREE|SLEEP|RECOV/i.test(ruleCode)

  if (valueType === 'duration') {
    const newMin = displayToMinutes(newValue)
    const govMin = displayToMinutes(govValue)
    if (isNaN(newMin) || isNaN(govMin)) return null
    // For rest rules: higher is more restrictive (more rest = more protection)
    // For duty/FDP limits: lower is more restrictive (less duty = more protection)
    return isRestRule ? newMin >= govMin : newMin <= govMin
  }

  if (valueType === 'integer' || valueType === 'decimal') {
    const newNum = parseFloat(newValue)
    const govNum = parseFloat(govValue)
    if (isNaN(newNum) || isNaN(govNum)) return null
    return isRestRule ? newNum >= govNum : newNum <= govNum
  }

  return null
}

// Aliases used by engine / validator consumers
export const parseDuration  = displayToMinutes   // "H:MM" → minutes
export const formatDuration = minutesToDisplay   // minutes → "H:MM"

/**
 * Group an array of rule parameters by their subcategory field.
 * Returns an object mapping subcategory → array of rules, in insertion order.
 */
export function groupBySubcategory<T extends { subcategory: string }>(
  rules: T[],
): Record<string, T[]> {
  const groups: Record<string, T[]> = {}
  for (const rule of rules) {
    const key = rule.subcategory || 'general'
    ;(groups[key] ??= []).push(rule)
  }
  return groups
}

/**
 * Format a duration value for display.
 * If valueType is 'duration', normalizes to "H:MM".
 * Otherwise returns the raw value.
 */
export function formatRuleValue(value: string, valueType: string, unit: string): string {
  if (valueType === 'duration') {
    const mins = displayToMinutes(value)
    return isNaN(mins) ? value : `${minutesToDisplay(mins)} ${unit}`.trim()
  }
  if (valueType === 'boolean') return value === 'true' ? 'Yes' : 'No'
  return unit ? `${value} ${unit}` : value
}
