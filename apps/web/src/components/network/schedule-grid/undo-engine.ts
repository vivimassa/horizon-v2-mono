// Network Scheduling XL — Undo/Redo Engine
// Snapshot-based: stores changed rows only, not the entire grid.

import type { GridSnapshot } from './types'
import { MAX_UNDO_DEPTH } from './types'

export interface UndoState {
  undoStack: GridSnapshot[][]
  redoStack: GridSnapshot[][]
}

export function createUndoState(): UndoState {
  return { undoStack: [], redoStack: [] }
}

/** Push a snapshot of changed rows before applying edits */
export function pushUndo(state: UndoState, changedRows: GridSnapshot[]): UndoState {
  const undoStack = [...state.undoStack, changedRows]
  if (undoStack.length > MAX_UNDO_DEPTH) undoStack.shift()
  return { undoStack, redoStack: [] }
}

/** Pop from undo stack, push to redo */
export function undo(state: UndoState): { newState: UndoState; snapshot: GridSnapshot[] | null } {
  if (state.undoStack.length === 0) return { newState: state, snapshot: null }
  const undoStack = [...state.undoStack]
  const snapshot = undoStack.pop()!
  return {
    newState: { undoStack, redoStack: [...state.redoStack, snapshot] },
    snapshot,
  }
}

/** Pop from redo stack, push to undo */
export function redo(state: UndoState): { newState: UndoState; snapshot: GridSnapshot[] | null } {
  if (state.redoStack.length === 0) return { newState: state, snapshot: null }
  const redoStack = [...state.redoStack]
  const snapshot = redoStack.pop()!
  return {
    newState: { undoStack: [...state.undoStack, snapshot], redoStack },
    snapshot,
  }
}
