// Tail Assignment Optimizer — re-export from shared logic. Single source of
// truth lives in packages/logic/src/utils/tail-optimizer.ts.
export { runOptimizer, serializeResult, generateRunName } from '@skyhub/logic'
export type {
  OptimizerPreset,
  OptimizerMethod,
  OptimizerConfig,
  OptimizerProgress,
  OptimizerStats,
  TypeBreakdown,
  OptimizerResult,
} from '@skyhub/logic'
// ChainBreak is namespaced inside @skyhub/logic to avoid conflict with the
// older tail-assignment module — pull it from the optimizer namespace.
export type { TailOptimizer } from '@skyhub/logic'
import type { TailOptimizer } from '@skyhub/logic'
export type ChainBreak = TailOptimizer.ChainBreak
