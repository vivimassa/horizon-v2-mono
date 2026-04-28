import type { DutyKind } from '../components/primitives'

/**
 * Map a CrewActivity's `activityCodeId` (which carries the SYS/operator
 * code letters) to a DutyKind for visual classification on roster + home.
 *
 * The crew-db sync envelope sends the activity code id verbatim — it
 * doesn't carry the human-readable code. Phase B will sync an
 * activity-codes lookup table; until then we string-match common stems.
 */
const STBY = ['STBY', 'STAND']
const REST = ['OFF', 'DOFF', 'RES']
const TRAIN = ['SIM', 'TRN', 'TRAIN', 'CBT', 'GRD']

export function classifyActivityCode(code: string): DutyKind {
  const u = code.toUpperCase()
  if (STBY.some((s) => u.includes(s))) return 'standby'
  if (REST.some((s) => u.includes(s))) return 'rest'
  if (TRAIN.some((s) => u.includes(s))) return 'training'
  return 'ground'
}

export function classifyActivityTitle(code: string): string {
  const k = classifyActivityCode(code)
  if (k === 'standby') return 'Standby'
  if (k === 'rest') return 'Rest Day'
  if (k === 'training') return 'Training'
  return code
}
