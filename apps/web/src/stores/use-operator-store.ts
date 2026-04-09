"use client";

import { create } from "zustand";
import { api, setApiBaseUrl } from "@skyhub/api";
import type { OperatorRef } from "@skyhub/api";
import type { DateFormatType } from "@/lib/date-format";

setApiBaseUrl("http://localhost:3002");

interface OperatorState {
  operator: OperatorRef | null;
  dateFormat: DateFormatType;
  loaded: boolean;
  /** Shared scenario ID — null = production, string = viewing a scenario. Used by both 1.1.1 and 1.1.2. */
  activeScenarioId: string | null;
  setActiveScenarioId: (id: string | null) => void;
  loadOperator: (operatorId?: string) => Promise<void>;
}

export const useOperatorStore = create<OperatorState>((set, get) => ({
  operator: null,
  dateFormat: "DD-MMM-YY",
  loaded: false,
  activeScenarioId: null,
  setActiveScenarioId: (id) => set({ activeScenarioId: id }),

  loadOperator: async (operatorId?: string) => {
    if (get().loaded) return;
    try {
      const operators = await api.getOperators();
      const op = operators.find((o) => o.code === operatorId) ?? operators[0];
      if (op) {
        set({
          operator: op,
          dateFormat: (op.dateFormat as DateFormatType) ?? "DD-MMM-YY",
          loaded: true,
        });
      }
    } catch (e) {
      console.error("Failed to load operator:", e);
    }
  },
}));

/** Get the current operator's _id. Use this instead of hardcoding "horizon". */
export function getOperatorId(): string {
  return useOperatorStore.getState().operator?._id ?? '';
}
