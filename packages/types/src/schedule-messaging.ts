// Schedule Messaging types — ASM/SSM message management

export const ASM_ACTION_CODES = [
  'NEW', 'TIM', 'CNL', 'EQT', 'RRT', 'RIN', 'CON', 'RPL', 'FLT', 'SKD',
] as const

export type AsmActionCode = typeof ASM_ACTION_CODES[number]

export type MessageDirection = 'inbound' | 'outbound'
export type MessageType = 'ASM' | 'SSM'

export type MessageStatus =
  | 'held'
  | 'pending'
  | 'sent'
  | 'applied'
  | 'rejected'
  | 'discarded'
  | 'neutralized'

/** A schedule message log document (returned by API, matches Mongoose shape) */
export interface ScheduleMessageLogRef {
  _id: string
  operatorId: string
  messageType: MessageType
  actionCode: AsmActionCode | string
  direction: MessageDirection
  status: MessageStatus
  flightNumber: string | null
  flightDate: string | null
  depStation: string | null
  arrStation: string | null
  seasonCode: string | null
  summary: string | null
  rawMessage: string | null
  changes: Record<string, { from?: string; to: string }> | null
  rejectReason: string | null
  processedAtUtc: string | null
  createdAtUtc: string
  updatedAtUtc: string
}

/** Filters for querying the message log */
export interface MessageLogFilters {
  direction?: MessageDirection
  actionCodes?: string[]
  messageTypes?: string[]
  status?: MessageStatus
  flightNumber?: string
  flightDateFrom?: string
  flightDateTo?: string
  search?: string
  limit?: number
  offset?: number
}

/** Aggregate message statistics */
export interface MessageStats {
  total: number
  held: number
  pending: number
  sent: number
  applied: number
  rejected: number
  thisWeek: number
}

/** Snapshot of a flight instance for ASM diff comparison */
export interface InstanceSnapshot {
  id: string
  flightNumber: string
  instanceDate: string
  depStation: string
  arrStation: string
  stdUtc: string
  staUtc: string
  aircraftTypeIcao: string
  status: string
}

/** Result of comparing two snapshots — one detected change */
export interface AsmDiffResult {
  actionCode: AsmActionCode | string
  flightNumber: string
  flightDate: string
  changes: Record<string, { from?: string; to: string }>
  summary: string
}

/** Parsed inbound ASM/SSM message */
export interface AsmParsed {
  messageType: MessageType
  actionCode: AsmActionCode | string
  airline: string
  flightNumber: string
  flightDate: string
  changes: Record<string, { from?: string; to: string }>
  rawMessage: string
  errors: string[]
}

/** Input for generating an outbound ASM message */
export interface AsmGenerateInput {
  actionCode: string
  airline: string
  flightNumber: string
  flightDate: string
  changes: Record<string, { from?: string; to: string }>
}

/** Minimal reference for held messages (used in neutralization and grouping) */
export interface HeldMessageRef {
  id: string
  actionCode: string
  flightNumber: string
  flightDate: string
  changes: Record<string, unknown>
}

/** Grouped held messages for the ASM Review Dialog */
export interface GroupedMessage {
  key: string
  actionCode: string
  flightNumber: string
  dateFrom: string
  dateTo: string
  instanceCount: number
  summary: string
  messageIds: string[]
  messages: ScheduleMessageLogRef[]
}
