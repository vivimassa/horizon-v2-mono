/** All 18 behavioral flags for activity codes */
export const ACTIVITY_FLAGS = [
  'is_flight_duty',
  'is_ground_duty',
  'is_deadhead',
  'counts_fdp',
  'counts_block_hours',
  'counts_duty_time',
  'is_airport_standby',
  'is_home_standby',
  'is_reserve',
  'is_day_off',
  'is_annual_leave',
  'is_sick_leave',
  'is_simulator',
  'is_training',
  'is_medical',
  'is_credit_only',
  'is_pay_eligible',
  'is_rest_period',
] as const

export type ActivityFlag = (typeof ACTIVITY_FLAGS)[number]

/** Flag categories for UI grouping (6 groups of 3) */
export const FLAG_CATEGORIES: { label: string; flags: ActivityFlag[] }[] = [
  {
    label: 'Duty Classification',
    flags: ['is_flight_duty', 'is_ground_duty', 'is_deadhead'],
  },
  {
    label: 'FDTL Counters',
    flags: ['counts_fdp', 'counts_block_hours', 'counts_duty_time'],
  },
  {
    label: 'Standby',
    flags: ['is_airport_standby', 'is_home_standby', 'is_reserve'],
  },
  {
    label: 'Leave & Off',
    flags: ['is_day_off', 'is_annual_leave', 'is_sick_leave'],
  },
  {
    label: 'Training & Medical',
    flags: ['is_simulator', 'is_training', 'is_medical'],
  },
  {
    label: 'Credits & Pay',
    flags: ['is_credit_only', 'is_pay_eligible', 'is_rest_period'],
  },
]

/** Human-readable labels for each flag */
export const FLAG_LABELS: Record<ActivityFlag, string> = {
  is_flight_duty: 'Flight Duty',
  is_ground_duty: 'Ground Duty',
  is_deadhead: 'Deadhead',
  counts_fdp: 'Counts FDP',
  counts_block_hours: 'Counts Block Hours',
  counts_duty_time: 'Counts Duty Time',
  is_airport_standby: 'Airport Standby',
  is_home_standby: 'Home Standby',
  is_reserve: 'Reserve',
  is_day_off: 'Day Off',
  is_annual_leave: 'Annual Leave',
  is_sick_leave: 'Sick Leave',
  is_simulator: 'Simulator',
  is_training: 'Training',
  is_medical: 'Medical',
  is_credit_only: 'Credit Only',
  is_pay_eligible: 'Pay Eligible',
  is_rest_period: 'Rest Period',
}
