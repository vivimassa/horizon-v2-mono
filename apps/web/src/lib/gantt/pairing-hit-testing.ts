import type { PackedPairing } from './pairing-types'

export interface PairingPillHit {
  pairingId: string
  flightId: string
}

/**
 * Find the pill under a pointer inside the Pairing Zone canvas.
 * Iterates in forward order (topmost lane = lane 0 is visual top).
 * Y is zone-relative (0 = top of zone canvas, including zone topOffset).
 */
export function hitTestPairingPill(
  x: number,
  y: number,
  packed: PackedPairing[],
  topOffset: number,
  pillHeight: number,
  laneHeight: number,
): PairingPillHit | null {
  const laneFromY = Math.floor((y - topOffset) / laneHeight)
  if (laneFromY < 0) return null
  for (const p of packed) {
    if (p.lane !== laneFromY) continue
    // Y range check accounting for pill vertical gap
    const laneTop = topOffset + p.lane * laneHeight + (laneHeight - pillHeight) / 2
    const laneBottom = laneTop + pillHeight
    if (y < laneTop || y > laneBottom) continue
    for (const pill of p.pills) {
      if (x >= pill.x && x <= pill.x + pill.width) {
        return { pairingId: p.pairingId, flightId: pill.flightId }
      }
    }
  }
  return null
}
