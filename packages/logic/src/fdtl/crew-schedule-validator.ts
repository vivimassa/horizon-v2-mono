// ─── 4.1.6 Crew-Schedule FDTL Validator — data-driven ───────────────────────
// Thin dispatcher. All rule logic lives in evaluators.ts, keyed by each rule's
// computation_type. Adding an airline's framework = DB rows with a
// computation_type + params. No validator code changes for 90% of rules.
//
// Custom / bespoke checks (e.g. per-country split-duty formulas) can be
// added as new evaluator functions + a new RuleComputationType enum value.

import type { SerializedRuleSet } from './engine-types'
import { runAllEvaluators, type EvaluatorContext } from './evaluators'
import type { CheckStatus, ScheduleDuty, ScheduleLegalityCheck } from './crew-schedule-validator-types'

export type { ScheduleDuty, ScheduleLegalityCheck, CheckStatus } from './crew-schedule-validator-types'

export interface ValidateAssignInput {
  candidate: ScheduleDuty
  existing: ScheduleDuty[]
  homeBase: string
  ruleSet: SerializedRuleSet | null
}

export interface ValidateAssignResult {
  checks: ScheduleLegalityCheck[]
  overall: CheckStatus
  headline: string | null
}

export function validateCrewAssignment(input: ValidateAssignInput): ValidateAssignResult {
  if (!input.ruleSet) {
    return { checks: [], overall: 'pass', headline: null }
  }
  const ctx: EvaluatorContext = {
    candidate: input.candidate,
    existing: input.existing,
    ruleSet: input.ruleSet,
    homeBase: input.homeBase,
  }
  const checks = runAllEvaluators(ctx)

  const violation = checks.find((c) => c.status === 'violation')
  const warning = checks.find((c) => c.status === 'warning')
  const overall: CheckStatus = violation ? 'violation' : warning ? 'warning' : 'pass'
  const headline = violation?.shortReason ?? warning?.shortReason ?? null
  return { checks, overall, headline }
}
