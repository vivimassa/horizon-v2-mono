'use client'

import { create } from 'zustand'
import type { FlightGridColumnKey } from '@/components/crew-ops/pairing/text-view/flight-grid/flight-grid-columns'

/**
 * Excel-like selection state for the 4.1.5.1 Flight Pool grid.
 *
 * Three selection primitives coexist:
 *  1. `selectedRowIds` — the canonical "rows picked for pairing" set. The
 *     Inspector reads this to run live FDTL legality. Surviving operation.
 *  2. `rangeStart / rangeEnd` — transient cell-range while the user drags.
 *     On mouseUp the corresponding rows get folded into `selectedRowIds`.
 *  3. `activeCell` — the single focused cell (Excel's green outline).
 *
 * Plus `highlightedCol` — purely visual column-header highlight.
 *
 * Pattern lifted from apps/web/src/stores/use-schedule-grid-store.ts:267-356.
 */
interface CellCoord {
  rowIdx: number
  col: FlightGridColumnKey
}

interface FlightGridSelectionState {
  // ── Canonical selection (rows that feed the Inspector) ──
  selectedRowIds: Set<string>

  // ── Transient cell focus + range ──
  activeCell: CellCoord | null
  rangeAnchor: CellCoord | null
  rangeCurrent: CellCoord | null

  // ── Column highlight (visual only) ──
  highlightedCol: FlightGridColumnKey | null

  // ── Actions ──
  clearAll: () => void
  clearSelection: () => void

  /** Focus + pick a single row (overwrites selection unless additive). */
  selectRow: (rowId: string, rowIdx: number, additive?: boolean) => void
  toggleRow: (rowId: string, rowIdx: number) => void
  /** Replace the selected rows by the inclusive row-id list (keeps order
   *  determined by the caller — usually grid order). */
  setSelectedRows: (rowIds: string[]) => void

  /** Focus a single cell without changing selection (like Excel click). */
  focusCell: (coord: CellCoord, additive?: boolean) => void

  /** Begin a drag-select range. */
  beginRange: (anchor: CellCoord, rowId: string, preserveSelection: boolean) => void
  /** Extend the drag range as the user moves. */
  extendRange: (coord: CellCoord, rowId: string) => void
  /** End the drag and persist the selected rows. */
  endRange: () => void

  /** Column-header click — highlights the whole column visually. */
  selectColumn: (col: FlightGridColumnKey) => void

  /** Ctrl+A — all visible rows. */
  selectAll: (allRowIds: string[]) => void

  /** Used by the grid when the pool reloads — drop selections that no
   *  longer correspond to a flight in the pool. */
  pruneTo: (validRowIds: Set<string>) => void

  // Internal range bookkeeping
  _dragRowIdSetAtStart: Set<string>
}

export const useFlightGridSelection = create<FlightGridSelectionState>((set, get) => ({
  selectedRowIds: new Set(),
  activeCell: null,
  rangeAnchor: null,
  rangeCurrent: null,
  highlightedCol: null,
  _dragRowIdSetAtStart: new Set(),

  clearAll: () =>
    set({
      selectedRowIds: new Set(),
      activeCell: null,
      rangeAnchor: null,
      rangeCurrent: null,
      highlightedCol: null,
    }),

  clearSelection: () =>
    set({
      selectedRowIds: new Set(),
      rangeAnchor: null,
      rangeCurrent: null,
    }),

  selectRow: (rowId, rowIdx, additive = false) => {
    const { selectedRowIds } = get()
    const next = additive ? new Set(selectedRowIds) : new Set<string>()
    next.add(rowId)
    set({
      selectedRowIds: next,
      activeCell: { rowIdx, col: 'ac' },
      rangeAnchor: null,
      rangeCurrent: null,
      highlightedCol: null,
    })
  },

  toggleRow: (rowId, rowIdx) => {
    const { selectedRowIds } = get()
    const next = new Set(selectedRowIds)
    if (next.has(rowId)) next.delete(rowId)
    else next.add(rowId)
    set({
      selectedRowIds: next,
      activeCell: { rowIdx, col: 'ac' },
      highlightedCol: null,
    })
  },

  setSelectedRows: (rowIds) => set({ selectedRowIds: new Set(rowIds) }),

  focusCell: (coord, additive = false) => {
    set((s) => ({
      activeCell: coord,
      highlightedCol: null,
      // Single-cell click without additive clears the row selection (Excel default)
      selectedRowIds: additive ? s.selectedRowIds : new Set(),
    }))
  },

  beginRange: (anchor, rowId, preserveSelection) => {
    const { selectedRowIds } = get()
    const base = preserveSelection ? new Set(selectedRowIds) : new Set<string>()
    base.add(rowId)
    set({
      activeCell: anchor,
      rangeAnchor: anchor,
      rangeCurrent: anchor,
      selectedRowIds: base,
      highlightedCol: null,
      _dragRowIdSetAtStart: preserveSelection ? new Set(selectedRowIds) : new Set(),
    })
  },

  extendRange: (coord, rowId) => {
    const { rangeAnchor, _dragRowIdSetAtStart } = get()
    if (!rangeAnchor) return
    // Rebuild selection from the baseline + all rows between anchor and coord
    const start = Math.min(rangeAnchor.rowIdx, coord.rowIdx)
    const end = Math.max(rangeAnchor.rowIdx, coord.rowIdx)
    // We need the grid to tell us which rowIds are in that span.
    // Simpler: caller passes the currently hovered rowId; we accumulate on the
    // fly. For correctness across scrolling, the grid also supplies a resolver
    // via `resolveRangeIds` — see grid component.
    const next = new Set(_dragRowIdSetAtStart)
    next.add(rowId)
    set({
      rangeCurrent: coord,
      activeCell: coord,
      selectedRowIds: next,
    })
    // NOTE: grid component re-invokes setSelectedRows with the correct
    // row ids for the current range via a useEffect on rangeCurrent.
    void start
    void end
  },

  endRange: () => set({ rangeAnchor: null, rangeCurrent: null, _dragRowIdSetAtStart: new Set() }),

  selectColumn: (col) =>
    set({
      highlightedCol: col,
      activeCell: null,
      // Column-select is visual only — don't wipe row selection.
    }),

  selectAll: (allRowIds) => set({ selectedRowIds: new Set(allRowIds), highlightedCol: null }),

  pruneTo: (validRowIds) => {
    const { selectedRowIds } = get()
    const next = new Set<string>()
    for (const id of selectedRowIds) if (validRowIds.has(id)) next.add(id)
    if (next.size !== selectedRowIds.size) set({ selectedRowIds: next })
  },
}))
