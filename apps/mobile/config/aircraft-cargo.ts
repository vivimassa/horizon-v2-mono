import type { AircraftCargoConfig, HoldKey } from '../types/cargo'

export const AIRCRAFT_CARGO_CONFIGS: Record<string, AircraftCargoConfig> = {
  A321: {
    type: 'A321',
    zones: [
      { holdKey: 'fwd', top: 23.5, left: 46, width: 12, height: 21 },
      { holdKey: 'aft', top: 54, left: 46, width: 12, height: 12.5 },
      { holdKey: 'bulk', top: 66, left: 45, width: 14, height: 6 },
    ],
  },
}

/** Image translateY as percentage of image height per hold */
export const HOLD_IMAGE_OFFSETS: Record<HoldKey, number> = {
  fwd: 10,
  aft: -8,
  bulk: -15,
}

/** Overview mode scale + translateY */
export const OVERVIEW_SCALE = 0.28
export const OVERVIEW_TRANSLATE_Y = -15 // percent
