/**
 * Client-side SSIM parse wrapper for the Comparison page. The parser in
 * @skyhub/logic is pure string ops — no need for a server round-trip
 * since we don't import, we only analyze.
 */

import { parseSSIM, type SSIMParseResult } from '@skyhub/logic'

export async function parseSsimFile(file: File): Promise<SSIMParseResult> {
  const text = await file.text()
  if (!text || text.trim().length === 0) {
    throw new Error('File is empty')
  }
  const result = parseSSIM(text)
  if (result.flights.length === 0) {
    const reason = result.errors.length > 0 ? result.errors[0].message : 'No Type 3 flight records found'
    throw new Error(`No flights parsed — ${reason}`)
  }
  return result
}
