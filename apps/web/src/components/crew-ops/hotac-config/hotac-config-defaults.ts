import type {
  HotacCheckInConfig,
  HotacDispatchConfig,
  HotacEmailConfig,
  HotacLayoverRuleConfig,
  HotacRoomAllocationConfig,
  HotacTransportConfig,
  OperatorHotacConfig,
} from '@skyhub/api'

/**
 * Compiled defaults for OperatorHotacConfig — used in two places:
 *   1. 4.1.8.3 UI — initial draft when the operator has no config doc yet (404)
 *      and as the target of the per-section Reset button.
 *   2. 4.1.8.1 derive-bookings — fallback layover rule when config not loaded.
 *
 * Keep these in sync with the Mongoose schema defaults in
 * `server/src/models/OperatorHotacConfig.ts`.
 */

export const DEFAULT_LAYOVER_RULE: HotacLayoverRuleConfig = {
  layoverMinHours: 6,
  excludeHomeBase: true,
  minSpanMidnightHours: 0,
}

export const DEFAULT_ROOM_ALLOCATION: HotacRoomAllocationConfig = {
  defaultOccupancy: 'single',
  doubleOccupancyPositions: [],
  contractCapBehaviour: 'supplement',
}

export const DEFAULT_DISPATCH: HotacDispatchConfig = {
  autoDispatchEnabled: false,
  autoDispatchTime: null,
  sendBeforeHours: 24,
  confirmationSlaHours: 2,
}

export const DEFAULT_CHECK_IN: HotacCheckInConfig = {
  autoCheckInOnArrivalDelayMinutes: 60,
  noShowAfterHours: 4,
}

export const DEFAULT_EMAIL: HotacEmailConfig = {
  fromAddress: '',
  replyTo: null,
  signature: '',
  holdByDefault: true,
}

export const DEFAULT_TRANSPORT: HotacTransportConfig = {
  pickupMode: 'hub-shuttle',
  hubLocation: { name: 'Crew Hub', addressLine: null, lat: null, lng: null },
  bufferMinutes: 15,
  batchingWindowMinutes: 30,
  defaultTravelTimeMinutes: 45,
  defaultVehicleTier: null,
  defaultVendorSlaMinutes: 15,
  taxiVoucherEnabled: false,
  flightBookingMode: 'ticket-preferred',
  layoverTransportProvider: 'vendor',
}

export interface HotacConfigDraft {
  layoverRule: HotacLayoverRuleConfig
  roomAllocation: HotacRoomAllocationConfig
  dispatch: HotacDispatchConfig
  checkIn: HotacCheckInConfig
  transport: HotacTransportConfig
  email: HotacEmailConfig
}

export const DEFAULT_HOTAC_CONFIG_DRAFT: HotacConfigDraft = {
  layoverRule: DEFAULT_LAYOVER_RULE,
  roomAllocation: DEFAULT_ROOM_ALLOCATION,
  dispatch: DEFAULT_DISPATCH,
  checkIn: DEFAULT_CHECK_IN,
  transport: DEFAULT_TRANSPORT,
  email: DEFAULT_EMAIL,
}

export function configToDraft(cfg: OperatorHotacConfig | null): HotacConfigDraft {
  if (!cfg) return DEFAULT_HOTAC_CONFIG_DRAFT
  return {
    layoverRule: { ...DEFAULT_LAYOVER_RULE, ...(cfg.layoverRule ?? {}) },
    roomAllocation: { ...DEFAULT_ROOM_ALLOCATION, ...(cfg.roomAllocation ?? {}) },
    dispatch: { ...DEFAULT_DISPATCH, ...(cfg.dispatch ?? {}) },
    checkIn: { ...DEFAULT_CHECK_IN, ...(cfg.checkIn ?? {}) },
    transport: { ...DEFAULT_TRANSPORT, ...(cfg.transport ?? {}) },
    email: { ...DEFAULT_EMAIL, ...(cfg.email ?? {}) },
  }
}
