// Shared SBY-window resolution for auto-roster passes (standby + gap-fill).
//
// Strategy (in candidate priority order):
//   1. Histogram-derived peaks — scan the day's base-local departure histogram
//      with a 90-min sliding window, pick top-3 density peaks above 10% of
//      day total. Each peak yields one SBY candidate at `peak − leadMin`,
//      rounded DOWN to the whole hour (planner directive).
//   2. Operator-configured fixed times — every entry in `standby.fixedStartTimes`
//      treated as base-local HH:MM. All entries iterated, not just `[0]`.
//   3. Canonical fallback peaks — 07:00 / 14:00 / 18:00 base-local.
//      Aviation-typical peaks: morning bank, midday crew/AC swap, evening
//      replacement-crew callouts. Used when histogram is empty / sparse.
//
// Multi-window retry happens at the call site: the per-day loop iterates
// the returned array and picks the first window that clears the rest-buffer
// + overlap check. Single-window resolution is what produced "blank days
// despite SBY quota allowed" before this helper.

const MS_PER_MIN = 60_000
const MS_PER_HOUR = 3_600_000
const BINS_PER_DAY = 48 // 30-min bins
const BIN_MIN = 30
const PEAK_WINDOW_BINS = 3 // 90-min sliding window
const PEAK_DENSITY_THRESHOLD_PCT = 10
const TOP_N_PEAKS = 3
const CANONICAL_PEAK_LOCAL_HOURS = [7, 14, 18]

export type SbyCandidate = { startMs: number; endMs: number; label: string }

export type DepHistEntry = {
  baseIata: string
  localDay: string // YYYY-MM-DD in base-local
  localMinOfDay: number // 0..1439
}

/**
 * Build per `${baseIata}|${localDay}` 30-min bin histograms from departure
 * entries. Caller pre-converts STD UTC ms → base-local day + minute-of-day.
 */
export function buildDepHistograms(entries: DepHistEntry[]): Map<string, number[]> {
  const out = new Map<string, number[]>()
  for (const e of entries) {
    const key = `${e.baseIata}|${e.localDay}`
    let bins = out.get(key)
    if (!bins) {
      bins = new Array(BINS_PER_DAY).fill(0)
      out.set(key, bins)
    }
    const binIdx = Math.min(BINS_PER_DAY - 1, Math.max(0, Math.floor(e.localMinOfDay / BIN_MIN)))
    bins[binIdx]++
  }
  return out
}

/**
 * Find top-N peak window-start local minutes from a 30-min-bin histogram.
 * Slides a 90-min window, ranks windows by total density, keeps windows
 * whose sum ≥ `PEAK_DENSITY_THRESHOLD_PCT`% of day total. Applies non-max
 * suppression so two adjacent windows don't both surface as peaks (the
 * second would be a near-duplicate of the first). Returns empty when
 * histogram is undefined or has zero deps.
 */
export function findPeakLocalMins(hist: number[] | undefined): number[] {
  if (!hist || hist.length !== BINS_PER_DAY) return []
  const total = hist.reduce((s, n) => s + n, 0)
  if (total === 0) return []
  const minWindowSum = Math.max(1, Math.ceil((total * PEAK_DENSITY_THRESHOLD_PCT) / 100))
  const windows: Array<{ startBin: number; sum: number }> = []
  let curSum = 0
  for (let k = 0; k < PEAK_WINDOW_BINS; k++) curSum += hist[k] ?? 0
  windows.push({ startBin: 0, sum: curSum })
  for (let i = 1; i + PEAK_WINDOW_BINS - 1 < BINS_PER_DAY; i++) {
    curSum += (hist[i + PEAK_WINDOW_BINS - 1] ?? 0) - (hist[i - 1] ?? 0)
    windows.push({ startBin: i, sum: curSum })
  }
  windows.sort((a, b) => b.sum - a.sum || a.startBin - b.startBin)
  const picked: number[] = []
  for (const w of windows) {
    if (w.sum < minWindowSum) continue
    if (picked.some((p) => Math.abs(p - w.startBin) < PEAK_WINDOW_BINS)) continue
    picked.push(w.startBin)
    if (picked.length >= TOP_N_PEAKS) break
  }
  return picked.map((b) => b * BIN_MIN)
}

function localMidnightUtcMs(dayIso: string, offsetHours: number): number {
  return (
    Date.UTC(Number(dayIso.slice(0, 4)), Number(dayIso.slice(5, 7)) - 1, Number(dayIso.slice(8, 10))) -
    offsetHours * MS_PER_HOUR
  )
}

function roundDownToHour(localMin: number): number {
  return Math.floor(localMin / 60) * 60
}

function formatHH(min: number): string {
  return Math.floor(min / 60)
    .toString()
    .padStart(2, '0')
}

/**
 * Build the ordered SBY candidate list for one (base, dayIso). Caller
 * iterates and picks the first window that clears its overlap + rest-buffer
 * checks. Duplicates (e.g. histogram peak == canonical peak − lead) are
 * deduped by start ms.
 */
export function buildSbyCandidates(args: {
  baseIata: string
  dayIso: string
  baseOffsetHours: number
  hist: number[] | undefined
  fixedTimes: string[]
  leadMin: number
  durationMin: number
}): SbyCandidate[] {
  const { dayIso, baseOffsetHours, hist, fixedTimes, leadMin, durationMin } = args
  const dayMidnightMs = localMidnightUtcMs(dayIso, baseOffsetHours)
  const out: SbyCandidate[] = []
  const seen = new Set<number>()
  const push = (startMs: number, label: string) => {
    if (!Number.isFinite(startMs) || seen.has(startMs)) return
    seen.add(startMs)
    out.push({ startMs, endMs: startMs + durationMin * MS_PER_MIN, label })
  }

  // 1. Histogram-derived peaks → SBY = peak − lead, whole-hour rounded down.
  const peakMins = findPeakLocalMins(hist)
  for (let p = 0; p < peakMins.length; p++) {
    const sbyStart = roundDownToHour(peakMins[p] - leadMin)
    if (sbyStart < 0) continue // pre-midnight start spills to previous day
    push(dayMidnightMs + sbyStart * MS_PER_MIN, `peak${p + 1}-${formatHH(sbyStart)}00`)
  }

  // 2. Operator-configured fixed times (base-local HH:MM, all entries).
  for (const t of fixedTimes) {
    const hm = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
    if (!hm) continue
    const hh = Math.min(23, parseInt(hm[1], 10))
    const mm = Math.min(59, parseInt(hm[2], 10))
    push(dayMidnightMs + (hh * 60 + mm) * MS_PER_MIN, `fixed-${t}`)
  }

  // 3. Canonical aviation-typical peaks (morning / midday / evening).
  for (const peakHour of CANONICAL_PEAK_LOCAL_HOURS) {
    const sbyStart = roundDownToHour(peakHour * 60 - leadMin)
    if (sbyStart < 0) continue
    push(dayMidnightMs + sbyStart * MS_PER_MIN, `canon-${peakHour.toString().padStart(2, '0')}00`)
  }
  return out
}
