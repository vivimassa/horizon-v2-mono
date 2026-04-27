import { create } from 'zustand'
import type { OperatorOption } from '../lib/api-client'

interface CrewOperatorState {
  selectedOperator: OperatorOption | null
  accentColor: string
  setOperator(op: OperatorOption | null): void
}

export const useCrewOperatorStore = create<CrewOperatorState>((set) => ({
  selectedOperator: null,
  accentColor: '#1e40af',
  setOperator: (op) =>
    set({
      selectedOperator: op,
      accentColor: op?.accentColor ?? '#1e40af',
    }),
}))
