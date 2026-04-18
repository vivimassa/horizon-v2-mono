import type { GanttFlight } from '@/lib/gantt/types'

const D15_MS = 15 * 60 * 1000

export interface OccKpis {
  /** % of non-cancelled departures that left ≤ 15 min after STD. 0 when nothing to measure. */
  otpPct: number
  /** Completed ÷ scheduled, where completed = not cancelled. */
  completionFactorPct: number
  /** Counts of scheduled flights by lifecycle bucket. */
  totals: { scheduled: number; cancelled: number; diverted: number; completed: number }
  /** Active disruptions grouped by Flight Information Dialog kind. */
  disruptions: {
    total: number
    divert: number
    airReturn: number
    rampReturn: number
    /** Applied with `appliedAt` set = "Resolving". Otherwise = "Open". */
    open: number
    resolving: number
  }
}

export function computeKpis(flights: GanttFlight[]): OccKpis {
  let scheduled = 0
  let cancelled = 0
  let diverted = 0
  let completed = 0
  let otpDenominator = 0
  let otpOnTime = 0

  let divert = 0
  let airReturn = 0
  let rampReturn = 0
  let open = 0
  let resolving = 0

  for (const f of flights) {
    scheduled += 1

    const isCancelled = f.status === 'cancelled'
    if (isCancelled) cancelled += 1
    if (f.disruptionKind === 'divert') diverted += 1

    if (!isCancelled) completed += 1

    // OTP D-15 — only for non-cancelled departures with an actual off-block time.
    if (!isCancelled && typeof f.atdUtc === 'number') {
      otpDenominator += 1
      if (f.atdUtc - f.stdUtc <= D15_MS) otpOnTime += 1
    }

    // Disruptions
    switch (f.disruptionKind) {
      case 'divert':
        divert += 1
        break
      case 'airReturn':
        airReturn += 1
        break
      case 'rampReturn':
        rampReturn += 1
        break
    }
    if (f.disruptionKind && f.disruptionKind !== 'none') {
      if (f.disruptionAppliedAt) resolving += 1
      else open += 1
    }
  }

  const otpPct = otpDenominator > 0 ? (otpOnTime / otpDenominator) * 100 : 0
  const completionFactorPct = scheduled > 0 ? (completed / scheduled) * 100 : 0

  return {
    otpPct,
    completionFactorPct,
    totals: { scheduled, cancelled, diverted, completed },
    disruptions: {
      total: divert + airReturn + rampReturn,
      divert,
      airReturn,
      rampReturn,
      open,
      resolving,
    },
  }
}
