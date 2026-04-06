// Network Scheduling XL — Conditional Formatting Rules
// Auto-applied visual rules based on cell values

import type { ScheduledFlightRef } from "@skyhub/api";
import type { CellFormat } from "./types";

interface ConditionalRule {
  name: string;
  condition: (row: ScheduledFlightRef) => boolean;
  columns?: string[];
  format: CellFormat;
}

export const CONDITIONAL_RULES: ConditionalRule[] = [
  // Cancelled flights — strikethrough + gray
  {
    name: "Cancelled flight",
    condition: (row) => row.status === "cancelled",
    format: { textColor: "#8F90A6" },
  },

  // Suspended flights — muted orange
  {
    name: "Suspended flight",
    condition: (row) => row.status === "suspended",
    format: { textColor: "#E67A00" },
  },

  // ETOPS flights — blue highlight on DEP/ARR
  {
    name: "ETOPS route",
    condition: (row) => row.isEtops,
    columns: ["depStation", "arrStation"],
    format: { textColor: "#0063F7", bold: true },
  },

  // Short TAT warning (< 45 min) — orange background
  // Note: TAT is computed, not stored. This rule would need TAT passed in.
  // For now, it highlights overwater flights as a proxy.
  {
    name: "Overwater route",
    condition: (row) => row.isOverwater,
    columns: ["depStation", "arrStation"],
    format: { textColor: "#00B7C4" },
  },

  // Draft status — italic
  {
    name: "Draft flight",
    condition: (row) => row.status === "draft",
    columns: ["status"],
    format: { italic: true },
  },
];

/** Get the conditional format for a specific cell */
export function getConditionalFormat(row: ScheduledFlightRef, colKey: string): CellFormat | null {
  for (const rule of CONDITIONAL_RULES) {
    if (!rule.condition(row)) continue;
    if (rule.columns && !rule.columns.includes(colKey)) continue;
    return rule.format;
  }
  return null;
}
