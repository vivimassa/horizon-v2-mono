import type { AircraftCargoConfig } from '@/types/cargo'

export const AIRCRAFT_CARGO_CONFIGS: Record<string, AircraftCargoConfig> = {
  A321: {
    type: 'A321',
    zones: [
      {
        holdKey: 'fwd',
        imageHalf: 'fwd',
        top: '16%',
        left: '46%',
        width: '12%',
        height: '28%',
      },
      {
        holdKey: 'aft',
        imageHalf: 'aft',
        top: '55%',
        left: '46%',
        width: '12%',
        height: '15%',
      },
      {
        holdKey: 'bulk',
        imageHalf: 'aft',
        top: '70%',
        left: '43%',
        width: '18%',
        height: '8%',
      },
    ],
  },
  A320: {
    type: 'A320',
    zones: [
      {
        holdKey: 'fwd',
        imageHalf: 'fwd',
        top: '30%',
        left: '28%',
        width: '44%',
        height: '36%',
      },
      {
        holdKey: 'aft',
        imageHalf: 'aft',
        top: '22%',
        left: '28%',
        width: '44%',
        height: '28%',
      },
      {
        holdKey: 'bulk',
        imageHalf: 'aft',
        top: '55%',
        left: '33%',
        width: '34%',
        height: '16%',
      },
    ],
  },
}

export function getAircraftImage(_type: string) {
  return `/assets/aircraft/aircraft-a321.png`
}
