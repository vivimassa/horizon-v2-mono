// Network Scheduling XL — Shared Types

export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
  bgColor?: string;
  textAlign?: "left" | "center" | "right";
}

export interface CellAddress {
  rowIdx: number;
  colKey: string;
}

export interface SelectionRange {
  start: CellAddress;
  end: CellAddress;
}

export interface ClipboardData {
  cells: { colKey: string; value: string }[];
  rowId: string;
  mode: "copy" | "cut";
}

export interface GridSnapshot {
  rowId: string;
  changes: Record<string, unknown>;
}

export const DEFAULT_FONTS = [
  "System",
  "Mono",
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Georgia",
  "Verdana",
  "Tahoma",
  "Courier New",
] as const;

export const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 36] as const;

export const TEXT_COLORS = [
  "#1C1C28", "#E63535", "#0063F7", "#06C270", "#FF8800",
  "#6600CC", "#0f766e", "#991b1b", "#5B8DEF", "#15803d",
  "#b45309", "#7c3aed", "#1e40af", "#0891b2", "#8F90A6",
] as const;

export const BG_COLORS = [
  "#FFCC00", "#06C270", "#00CFDE", "#be185d", "#0063F7",
  "#1e40af", "#0f766e", "#b45309", "#6600CC", "#FF8800",
  "#39D98A", "#FDAC42", "#5B8DEF", "#AC5DD9", "#FDDD48",
  "#73DFE7", "#f472b6", "#8F90A6", "#E4E4EB", "#C7C9D9",
] as const;

export const MAX_UNDO_DEPTH = 50;
