// Classifies an ActivityCode's `flags[]` into FDTL-relevant behavior.
//
// The Activity Codes master data carries `flags: string[]` (see
// `server/src/routes/reference.ts → DEFAULT_ACTIVITY_CODES`). Two
// orthogonal dimensions:
//
//   • What the activity represents — duty, off, leave, rest, standby…
//   • Which FDTL counters it feeds — `counts_duty_time`,
//     `counts_block_hours`, `counts_fdp`.
//
// Classification rule:
//   category = 'rest' iff flags include an off/leave/rest indicator AND
//     do NOT include `counts_duty_time`. Otherwise 'duty'.
//
// `rest` activities:
//   - contribute 0 to dutyMinutes / blockMinutes / fdpMinutes
//   - are treated as *rest* by rest evaluators (not duty-to-duty gap breakers)
//
// `duty` activities:
//   - blockMinutes = span when `counts_block_hours`
//   - fdpMinutes   = span when `counts_fdp`
//   - dutyMinutes  = span when `counts_duty_time` (or, legacy: always for duty activities)

export interface ActivityCategorization {
  category: 'duty' | 'rest'
  countsDuty: boolean
  countsBlock: boolean
  countsFdp: boolean
}

const REST_FLAGS = new Set([
  'is_day_off',
  'is_annual_leave',
  'is_sick_leave',
  'is_rest_period',
  'is_home_standby',
  'is_reserve',
])

export function categorizeActivityFlags(flags: readonly string[] | null | undefined): ActivityCategorization {
  const f = new Set(flags ?? [])
  const countsDuty = f.has('counts_duty_time')
  const countsBlock = f.has('counts_block_hours')
  const countsFdp = f.has('counts_fdp')
  const hasRestMarker = [...f].some((x) => REST_FLAGS.has(x))
  const category: 'duty' | 'rest' = hasRestMarker && !countsDuty ? 'rest' : 'duty'
  return { category, countsDuty, countsBlock, countsFdp }
}
