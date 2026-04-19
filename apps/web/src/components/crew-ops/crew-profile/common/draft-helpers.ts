/**
 * Compute the subset of `draft` that differs from `original`, for a partial
 * PATCH payload. Shallow-compare only (Crew Profile member fields are flat).
 * Arrays (languages, noAccommodationAirports) are compared by JSON equality.
 */
export function diffShallow<T extends Record<string, unknown>>(original: T, draft: T): Partial<T> {
  const patch: Partial<T> = {}
  for (const key of Object.keys(draft) as (keyof T)[]) {
    const a = original[key]
    const b = draft[key]
    if (Array.isArray(a) || Array.isArray(b)) {
      if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) patch[key] = b
    } else if (a !== b) {
      patch[key] = b
    }
  }
  return patch
}

/**
 * Crew Ops accent — teal. Two shades for legibility:
 *  - Dark mode : teal-500 `#14B8A6` (bright, pops against #0E0E14)
 *  - Light mode: teal-700 `#0F766E` (darker, passes WCAG AA on white — white
 *    text on teal-500 is only ~3:1, which fails AA for normal text)
 */
export const CREW_OPS_ACCENT_DARK = '#14B8A6' // teal-500
export const CREW_OPS_ACCENT_LIGHT = '#0F766E' // teal-700

/** Theme-aware accent — call from any component with `isDark` in scope:
 *    `const accent = crewAccent(isDark)` */
export function crewAccent(isDark: boolean): string {
  return isDark ? CREW_OPS_ACCENT_DARK : CREW_OPS_ACCENT_LIGHT
}

/** Backward-compat export. Prefer `crewAccent(isDark)` for any usage that
 *  renders against a light background (text color, solid borders). The
 *  constant itself resolves to the dark-mode hex. */
export const CREW_OPS_ACCENT = CREW_OPS_ACCENT_DARK

export function cleanPayload<T extends Record<string, unknown>>(obj: T): T {
  // Drop readonly-ish fields before sending to server.
  const next = { ...obj } as Record<string, unknown>
  delete next._id
  delete next.operatorId
  delete next.crewId
  delete next.createdAt
  delete next.updatedAt
  return next as T
}

export const EMPTY_CREW_DRAFT_FIELDS = ['employeeId', 'firstName', 'lastName'] as const
