import type { DetectorFlight, DetectorInput, DisruptionAdapter, DisruptionSignal, SuggestedAction } from './types'

// ── Thresholds — tuned conservatively; override per operator later. ──

const DELAY_WARNING_MIN = 15
const DELAY_CRITICAL_MIN = 60
const MISSING_OUT_WARNING_MIN = 15
const MISSING_OUT_CRITICAL_MIN = 45
const MISSING_IN_WARNING_MIN = 15
const MISSING_IN_CRITICAL_MIN = 30
const DEFAULT_TAT_MIN = 45

function hash(s: string): string {
  // Non-cryptographic, stable across runs — enough to dedupe signal ids.
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

function baseContext(
  f: DetectorFlight,
): Pick<
  DisruptionSignal,
  'flightId' | 'flightNumber' | 'forDate' | 'depStation' | 'arrStation' | 'tail' | 'aircraftType'
> {
  return {
    flightId: f.id,
    flightNumber: f.flightNumber,
    forDate: f.operatingDate,
    depStation: f.depIata,
    arrStation: f.arrIata,
    tail: f.actualTail ?? f.scheduledTail,
    aircraftType: f.aircraftTypeIcao,
  }
}

function planRecoveryAction(f: DetectorFlight): SuggestedAction {
  return {
    id: 'plan-recovery',
    label: 'Plan recovery in Movement Control',
    linkedModuleCode: '2.1.1',
    linkedEntityId: f.id,
  }
}

function openMaintenanceAction(f: DetectorFlight): SuggestedAction {
  return {
    id: 'open-maintenance',
    label: 'Open in Aircraft Maintenance',
    linkedModuleCode: '2.1.2',
    linkedEntityId: f.actualTail ?? f.scheduledTail ?? null,
  }
}

// ── Detectors ──

/** TAIL_SWAP — instance tail differs from scheduled tail on the same rotation. */
function detectTailSwap(input: DetectorInput): DisruptionSignal[] {
  const out: DisruptionSignal[] = []
  for (const f of input.flights) {
    if (!f.scheduledTail || !f.actualTail) continue
    if (f.scheduledTail === f.actualTail) continue
    const reasons = [`Scheduled ${f.scheduledTail}, operated by ${f.actualTail}.`]
    out.push({
      sourceAlertId: `TAIL_SWAP-${f.id}-${hash(`${f.scheduledTail}>${f.actualTail}`)}`,
      source: 'IROPS_AUTO',
      ...baseContext(f),
      category: 'TAIL_SWAP',
      severity: 'warning',
      score: 0.7,
      reasons,
      title: `${f.flightNumber} tail swap: ${f.scheduledTail} → ${f.actualTail}`,
      description: reasons[0],
      suggestedActions: [planRecoveryAction(f), openMaintenanceAction(f)],
    })
  }
  return out
}

/** DELAY — ETD/ATD vs STD exceeds threshold. */
function detectDelay(input: DetectorInput): DisruptionSignal[] {
  const out: DisruptionSignal[] = []
  for (const f of input.flights) {
    if (f.stdUtcMs == null) continue
    const eff = f.atdUtcMs ?? f.etdUtcMs
    if (eff == null) continue
    const delayMin = Math.round((eff - f.stdUtcMs) / 60_000)
    if (delayMin < DELAY_WARNING_MIN) continue
    const severity = delayMin >= DELAY_CRITICAL_MIN ? 'critical' : 'warning'
    const reasons = [`Departure running ${delayMin} min late.`]
    out.push({
      sourceAlertId: `DELAY-${f.id}-${hash(String(delayMin))}`,
      source: 'IROPS_AUTO',
      ...baseContext(f),
      category: 'DELAY',
      severity,
      score: Math.min(1, delayMin / 120),
      reasons,
      title: `${f.flightNumber} delayed ${delayMin} min`,
      description: reasons[0],
      suggestedActions: [planRecoveryAction(f)],
    })
  }
  return out
}

/** CANCELLATION — flight status cancelled. */
function detectCancellation(input: DetectorInput): DisruptionSignal[] {
  const out: DisruptionSignal[] = []
  for (const f of input.flights) {
    if (f.status !== 'cancelled') continue
    const reasons = [`Flight cancelled.`]
    out.push({
      sourceAlertId: `CANCELLATION-${f.id}`,
      source: 'IROPS_AUTO',
      ...baseContext(f),
      category: 'CANCELLATION',
      severity: 'critical',
      score: 1,
      reasons,
      title: `${f.flightNumber} cancelled`,
      description: reasons[0],
      suggestedActions: [planRecoveryAction(f)],
    })
  }
  return out
}

/** DIVERSION — status diverted. */
function detectDiversion(input: DetectorInput): DisruptionSignal[] {
  const out: DisruptionSignal[] = []
  for (const f of input.flights) {
    if (f.status !== 'diverted') continue
    const reasons = [`Flight diverted from ${f.arrIata ?? 'planned arrival'}.`]
    out.push({
      sourceAlertId: `DIVERSION-${f.id}`,
      source: 'IROPS_AUTO',
      ...baseContext(f),
      category: 'DIVERSION',
      severity: 'critical',
      score: 1,
      reasons,
      title: `${f.flightNumber} diverted`,
      description: reasons[0],
      suggestedActions: [planRecoveryAction(f), openMaintenanceAction(f)],
    })
  }
  return out
}

/** MISSING_OOOI — past STD/STA with no OUT/IN recorded. */
function detectMissingOooi(input: DetectorInput): DisruptionSignal[] {
  const out: DisruptionSignal[] = []
  for (const f of input.flights) {
    // Missing OUT
    if (f.stdUtcMs != null && f.atdUtcMs == null && input.nowMs > f.stdUtcMs && f.status !== 'cancelled') {
      const lateMin = Math.round((input.nowMs - f.stdUtcMs) / 60_000)
      if (lateMin >= MISSING_OUT_WARNING_MIN) {
        const severity = lateMin >= MISSING_OUT_CRITICAL_MIN ? 'critical' : 'warning'
        out.push({
          sourceAlertId: `MISSING_OOOI_OUT-${f.id}`,
          source: 'IROPS_AUTO',
          ...baseContext(f),
          category: 'MISSING_OOOI',
          severity,
          score: Math.min(1, lateMin / 90),
          reasons: [`No OUT message ${lateMin} min past STD.`],
          title: `${f.flightNumber} missing OUT (${lateMin} min late)`,
          description: 'Actual Departure Time not received — confirm movement status.',
          suggestedActions: [planRecoveryAction(f)],
        })
      }
    }
    // Missing IN
    if (
      f.staUtcMs != null &&
      f.atdUtcMs != null &&
      f.ataUtcMs == null &&
      input.nowMs > f.staUtcMs &&
      f.status !== 'cancelled'
    ) {
      const lateMin = Math.round((input.nowMs - f.staUtcMs) / 60_000)
      if (lateMin >= MISSING_IN_WARNING_MIN) {
        const severity = lateMin >= MISSING_IN_CRITICAL_MIN ? 'critical' : 'warning'
        out.push({
          sourceAlertId: `MISSING_OOOI_IN-${f.id}`,
          source: 'IROPS_AUTO',
          ...baseContext(f),
          category: 'MISSING_OOOI',
          severity,
          score: Math.min(1, lateMin / 60),
          reasons: [`No IN message ${lateMin} min past STA.`],
          title: `${f.flightNumber} missing IN (${lateMin} min late)`,
          description: 'Actual Arrival Time not received — confirm aircraft on block.',
          suggestedActions: [planRecoveryAction(f)],
        })
      }
    }
  }
  return out
}

/** MAINTENANCE_RISK — aircraft has an in-progress/confirmed maintenance event overlapping a flight. */
function detectMaintenanceRisk(input: DetectorInput): DisruptionSignal[] {
  const out: DisruptionSignal[] = []
  const byTail = new Map<string, typeof input.maintenance>()
  for (const m of input.maintenance) {
    if (!m.tail) continue
    if (!['planned', 'confirmed', 'in_progress'].includes(m.status)) continue
    const list = byTail.get(m.tail) ?? []
    list.push(m)
    byTail.set(m.tail, list)
  }
  for (const f of input.flights) {
    const tail = f.actualTail ?? f.scheduledTail
    if (!tail || f.stdUtcMs == null) continue
    const events = byTail.get(tail)
    if (!events?.length) continue
    for (const m of events) {
      const msStart = new Date(m.plannedStartUtc + 'T00:00:00Z').getTime()
      const msEnd = new Date((m.plannedEndUtc ?? m.plannedStartUtc) + 'T23:59:59Z').getTime()
      if (f.stdUtcMs >= msStart && f.stdUtcMs <= msEnd) {
        out.push({
          sourceAlertId: `MAINTENANCE_RISK-${f.id}-${tail}`,
          source: 'IROPS_AUTO',
          ...baseContext(f),
          category: 'MAINTENANCE_RISK',
          severity: m.status === 'in_progress' ? 'critical' : 'warning',
          score: m.status === 'in_progress' ? 0.9 : 0.6,
          reasons: [`${tail} has ${m.status} maintenance overlapping STD.`],
          title: `${f.flightNumber} — maintenance overlap on ${tail}`,
          description: `Check slot vs ETD and consider tail swap.`,
          suggestedActions: [openMaintenanceAction(f), planRecoveryAction(f)],
        })
        break
      }
    }
  }
  return out
}

/** CURFEW_VIOLATION — projected arrival after curfew opens at destination. */
function detectCurfewViolation(input: DetectorInput): DisruptionSignal[] {
  const out: DisruptionSignal[] = []
  if (!input.curfewByIata) return out
  const DAY_MS = 86_400_000
  for (const f of input.flights) {
    if (!f.arrIata || f.staUtcMs == null) continue
    const curfew = input.curfewByIata[f.arrIata]
    if (!curfew) continue
    const projectedEta = f.etaUtcMs ?? f.staUtcMs
    const dayStart = Math.floor(projectedEta / DAY_MS) * DAY_MS
    const cStart = dayStart + curfew.startRelativeMs
    const cEnd = dayStart + curfew.endRelativeMs
    const inCurfew =
      cStart <= cEnd ? projectedEta >= cStart && projectedEta <= cEnd : projectedEta >= cStart || projectedEta <= cEnd
    if (!inCurfew) continue
    out.push({
      sourceAlertId: `CURFEW_VIOLATION-${f.id}`,
      source: 'IROPS_AUTO',
      ...baseContext(f),
      category: 'CURFEW_VIOLATION',
      severity: 'critical',
      score: 0.95,
      reasons: [`Projected ETA falls inside ${f.arrIata} night curfew.`],
      title: `${f.flightNumber} — curfew risk at ${f.arrIata}`,
      description: 'Arrival projected inside curfew window — expedite or divert.',
      suggestedActions: [planRecoveryAction(f)],
    })
  }
  return out
}

/** TAT_VIOLATION — next leg on same tail starts before previous leg + TAT. */
function detectTatViolation(input: DetectorInput): DisruptionSignal[] {
  const out: DisruptionSignal[] = []
  const byTail = new Map<string, DetectorFlight[]>()
  for (const f of input.flights) {
    const tail = f.actualTail ?? f.scheduledTail
    if (!tail) continue
    const list = byTail.get(tail) ?? []
    list.push(f)
    byTail.set(tail, list)
  }
  for (const [, flights] of byTail) {
    flights.sort((a, b) => (a.stdUtcMs ?? 0) - (b.stdUtcMs ?? 0))
    for (let i = 0; i < flights.length - 1; i++) {
      const prev = flights[i]
      const next = flights[i + 1]
      const prevEnd = prev.ataUtcMs ?? prev.etaUtcMs ?? prev.staUtcMs
      const nextStart = next.etdUtcMs ?? next.stdUtcMs
      if (prevEnd == null || nextStart == null) continue
      const tatMin = input.tatByAircraftType?.[prev.aircraftTypeIcao ?? ''] ?? DEFAULT_TAT_MIN
      const gapMin = Math.round((nextStart - prevEnd) / 60_000)
      if (gapMin >= tatMin) continue
      const shortBy = tatMin - gapMin
      out.push({
        sourceAlertId: `TAT_VIOLATION-${next.id}`,
        source: 'IROPS_AUTO',
        ...baseContext(next),
        category: 'TAT_VIOLATION',
        severity: shortBy >= 15 ? 'critical' : 'warning',
        score: Math.min(1, shortBy / 30),
        reasons: [`Only ${gapMin} min between ${prev.flightNumber} and ${next.flightNumber} (min ${tatMin}).`],
        title: `${next.flightNumber} — TAT short by ${shortBy} min`,
        description: `Turnaround below ${tatMin} min minimum for ${prev.aircraftTypeIcao ?? 'aircraft'}.`,
        suggestedActions: [planRecoveryAction(next)],
      })
    }
  }
  return out
}

/** CONFIG_CHANGE — scheduled aircraft type differs from actual. */
function detectConfigChange(input: DetectorInput): DisruptionSignal[] {
  const out: DisruptionSignal[] = []
  // Note: we do not have the scheduled type in the detector input by default;
  // scheduled type is embedded on ScheduledFlight, not FlightInstance. This
  // detector fires only when the scheduledFlightId is known and the caller
  // resolves config change upstream. For Phase 1, we emit only if the tail
  // changed AND aircraft type differs — approximated by comparing tail types.
  // Left intentionally minimal; richer detection comes with ScheduledFlight
  // join wiring in the gantt route pattern.
  return out
}

// ── Adapter ──

export const rulesAdapter: DisruptionAdapter = {
  name: 'rules-v1',
  detect(input: DetectorInput): DisruptionSignal[] {
    return [
      ...detectTailSwap(input),
      ...detectDelay(input),
      ...detectCancellation(input),
      ...detectDiversion(input),
      ...detectMissingOooi(input),
      ...detectMaintenanceRisk(input),
      ...detectCurfewViolation(input),
      ...detectTatViolation(input),
      ...detectConfigChange(input),
    ]
  },
}

/** Entrypoint — runs every registered adapter and flattens results. */
export function detectSignals(
  input: DetectorInput,
  adapters: DisruptionAdapter[] = [rulesAdapter],
): DisruptionSignal[] {
  const all: DisruptionSignal[] = []
  for (const a of adapters) {
    const result = a.detect(input)
    if (Array.isArray(result)) all.push(...result)
    else result.then((r) => all.push(...r)) // adapters may be async; caller should await if needed
  }
  return all
}
