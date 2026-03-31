/**
 * 4.5.4 Activity Codes — Behavioral flag definitions.
 *
 * Flags are stored as JSONB string arrays on activity_codes.flags.
 * 18 flags in 6 groups of 3.
 */

export interface ActivityFlag {
  key: string
  label: string
  description: string
}

export interface ActivityFlagGroup {
  label: string
  flags: ActivityFlag[]
}

export const ACTIVITY_FLAG_GROUPS: ActivityFlagGroup[] = [
  {
    label: 'Duty Classification',
    flags: [
      {
        key: 'is_flight_duty',
        label: 'Flight Duty',
        description: 'Constitutes a flight duty period under FDTL regulations',
      },
      {
        key: 'is_ground_duty',
        label: 'Ground Duty',
        description: 'Ground-based duty activity (briefing, admin, surface positioning)',
      },
      {
        key: 'is_deadhead',
        label: 'Deadhead',
        description: 'Positioning/deadhead flight as a non-operating crew member',
      },
    ],
  },
  {
    label: 'FDTL Counters',
    flags: [
      {
        key: 'counts_fdp',
        label: 'Counts FDP',
        description: 'Counts toward the Flight Duty Period limit',
      },
      {
        key: 'counts_block_hours',
        label: 'Counts Block Hours',
        description: 'Counts toward cumulative block/flying hours totals',
      },
      {
        key: 'counts_duty_time',
        label: 'Counts Duty Time',
        description: 'Counts toward total cumulative duty time',
      },
    ],
  },
  {
    label: 'Standby',
    flags: [
      {
        key: 'is_airport_standby',
        label: 'Airport Standby',
        description: 'Crew is on standby at the airport (counts as reduced FDP)',
      },
      {
        key: 'is_home_standby',
        label: 'Home Standby',
        description: 'Crew is on standby at home (may qualify as reduced rest)',
      },
      {
        key: 'is_reserve',
        label: 'Reserve',
        description: 'Reserve availability period for on-call crew',
      },
    ],
  },
  {
    label: 'Leave & Off',
    flags: [
      {
        key: 'is_day_off',
        label: 'Day Off',
        description: 'Rest/day off — no duty obligations apply',
      },
      {
        key: 'is_annual_leave',
        label: 'Annual Leave',
        description: 'Annual leave entitlement day',
      },
      {
        key: 'is_sick_leave',
        label: 'Sick Leave',
        description: 'Sick or medical leave absence',
      },
    ],
  },
  {
    label: 'Training & Medical',
    flags: [
      {
        key: 'is_simulator',
        label: 'Simulator',
        description:
          'Simulator session (FSTD/FFS) — enables simulator-specific settings below',
      },
      {
        key: 'is_training',
        label: 'Training',
        description: 'Ground or line training activity (non-simulator)',
      },
      {
        key: 'is_medical',
        label: 'Medical',
        description: 'Medical examination, fitness check, or assessment',
      },
    ],
  },
  {
    label: 'Credits & Pay',
    flags: [
      {
        key: 'is_credit_only',
        label: 'Credit Only',
        description: 'Generates credit hours only — does not count as FDP',
      },
      {
        key: 'is_pay_eligible',
        label: 'Pay Eligible',
        description: 'Generates pay allowances or per diem',
      },
      {
        key: 'is_rest_period',
        label: 'Rest Period',
        description: 'Counts as qualifying rest period for FDTL calculations',
      },
    ],
  },
]

/** Flat array of all 18 flags. */
export const ACTIVITY_FLAGS: ActivityFlag[] = ACTIVITY_FLAG_GROUPS.flatMap((g) => g.flags)

/** Map from flag key → flag definition for quick lookup. */
export const ACTIVITY_FLAG_MAP = new Map<string, ActivityFlag>(
  ACTIVITY_FLAGS.map((f) => [f.key, f])
)
