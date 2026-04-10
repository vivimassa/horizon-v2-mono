/** Cell address in the grid */
export interface CellAddress {
  rowIdx: number
  colKey: string
}

/** Per-cell visual formatting */
export interface CellFormat {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  fontFamily?: string
  fontSize?: number
  textColor?: string
  bgColor?: string
  textAlign?: 'left' | 'center' | 'right'
}

/** Clipboard buffer */
export interface ClipboardData {
  cells: { colKey: string; value: string }[]
  rowId: string
  rowIds: string[]
  colKeys: string[]
  mode: 'copy' | 'cut'
}

/** Undo snapshot — stores dirty state at a point in time */
export interface UndoSnapshot {
  dirtyMap: Map<string, Record<string, unknown>>
}

/** Text color palette (15 colors) */
export const TEXT_COLORS = [
  '#1C1C28', '#E63535', '#0063F7', '#06C270', '#FF8800',
  '#6600CC', '#0f766e', '#991b1b', '#5B8DEF', '#15803d',
  '#b45309', '#7c3aed', '#1e40af', '#0891b2', '#8F90A6',
]

/** Background color palette (20 colors) */
export const BG_COLORS = [
  '#FFCC00', '#06C270', '#00CFDE', '#be185d', '#0063F7',
  '#1e40af', '#0f766e', '#b45309', '#6600CC', '#FF8800',
  '#39D98A', '#FDAC42', '#5B8DEF', '#AC5DD9', '#FDDD48',
  '#73DFE7', '#f472b6', '#8F90A6', '#E4E4EB', '#C7C9D9',
]

/** Default font families */
export const DEFAULT_FONTS = [
  'System', 'Mono', 'Arial', 'Helvetica', 'Times New Roman',
  'Georgia', 'Verdana', 'Tahoma', 'Courier New',
]

/** Font size options */
export const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 36]

export const MAX_UNDO_DEPTH = 50
export const EMPTY_BUFFER_ROWS = 20
