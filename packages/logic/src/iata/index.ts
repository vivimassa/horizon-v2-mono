/**
 * IATA Message Parser & Encoder
 *
 * Supports:
 * - MVT (Movement Message) — AHM 780
 * - LDM (Load Distribution Message) — AHM 583
 *
 * Usage:
 *   import { parseMessage, encodeMvtMessage } from '@/logic/iata'
 */

export * from './types'
export { parseMvtMessage, formatMvtTime, getDelayCodeDescription, formatDelayDuration } from './mvt-parser'
export { parseLdmMessage, parseCabinConfig, formatWeight } from './ldm-parser'
export { encodeMvtMessage, buildEnvelope, type MvtEncodeInput } from './mvt-encoder'

import { parseMvtMessage } from './mvt-parser'
import { parseLdmMessage } from './ldm-parser'
import type { ParsedMessage } from './types'

/**
 * Auto-detect message type and parse accordingly.
 * Looks for 'MVT', 'COR MVT', or 'LDM' identifier in the raw text.
 */
export function parseMessage(raw: string): ParsedMessage {
  if (!raw) return { type: 'UNKNOWN', rawLines: [], error: 'Empty message' }

  const upper = raw.toUpperCase()

  if (upper.includes('COR MVT') || upper.includes('\nMVT\n') || upper.includes('\nMVT\r') || /^MVT$/m.test(upper)) {
    const parsed = parseMvtMessage(raw)
    if (parsed) return { type: 'MVT', ...parsed }
    return { type: 'UNKNOWN', rawLines: raw.split('\n'), error: 'Failed to parse MVT' }
  }

  if (/^LDM$/m.test(upper) || upper.includes('\nLDM\n') || upper.includes('\nLDM\r')) {
    const parsed = parseLdmMessage(raw)
    if (parsed) return { type: 'LDM', ...parsed }
    return { type: 'UNKNOWN', rawLines: raw.split('\n'), error: 'Failed to parse LDM' }
  }

  // Fallback: try MVT first (more common), then LDM
  const mvt = parseMvtMessage(raw)
  if (mvt) return { type: 'MVT', ...mvt }

  const ldm = parseLdmMessage(raw)
  if (ldm) return { type: 'LDM', ...ldm }

  return { type: 'UNKNOWN', rawLines: raw.split('\n'), error: 'Unrecognized message format' }
}
