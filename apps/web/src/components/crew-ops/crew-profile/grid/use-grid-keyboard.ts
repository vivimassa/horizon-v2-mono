'use client'

import { useEffect, useRef } from 'react'

export type GridCellCoord = { row: number; col: number }

/**
 * Keyboard helper for the Aircraft Qualifications Excel grid.
 *
 * Handles Tab / Shift+Tab / Enter / Arrow / Esc / Copy / Paste for a
 * single table at `rootRef`. Cell focus uses DOM attribute
 * `data-cell="row,col"` so cells can be any focusable element.
 */
interface Handlers {
  rowCount: number
  colCount: number
  copyRow: (row: number) => void
  pasteRow: (row: number) => void
  removeRowIfEmpty: (row: number) => boolean
  onAppendRow: () => void
}

export function useGridKeyboard(rootRef: React.RefObject<HTMLDivElement | null>, handlers: Handlers) {
  const h = useRef(handlers)
  h.current = handlers

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement
      if (!target || !root.contains(target)) return
      const coord = parseCoord(target)
      if (!coord) return
      const { row, col } = coord
      const mod = ev.ctrlKey || ev.metaKey

      if (mod && (ev.key === 'c' || ev.key === 'C')) {
        ev.preventDefault()
        h.current.copyRow(row)
        return
      }
      if (mod && (ev.key === 'v' || ev.key === 'V')) {
        ev.preventDefault()
        h.current.pasteRow(row)
        return
      }
      if (ev.key === 'Tab') {
        ev.preventDefault()
        const nextCol = col + (ev.shiftKey ? -1 : 1)
        if (nextCol >= h.current.colCount) {
          const isLast = row === h.current.rowCount - 1
          if (isLast) h.current.onAppendRow()
          focusCell(root, row + 1, 0)
        } else if (nextCol < 0) {
          if (row > 0) focusCell(root, row - 1, h.current.colCount - 1)
        } else {
          focusCell(root, row, nextCol)
        }
        return
      }
      if (ev.key === 'Enter') {
        if (target.tagName === 'SELECT') return
        ev.preventDefault()
        const isLast = row === h.current.rowCount - 1
        if (isLast) h.current.onAppendRow()
        focusCell(root, row + 1, col)
        return
      }
      if (ev.key === 'ArrowDown') {
        if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'date') return
        ev.preventDefault()
        focusCell(root, Math.min(row + 1, h.current.rowCount - 1), col)
        return
      }
      if (ev.key === 'ArrowUp') {
        if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'date') return
        ev.preventDefault()
        focusCell(root, Math.max(row - 1, 0), col)
        return
      }
      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        // Only act on an empty row when focus is on a cell without text input focus.
        if (target.tagName === 'INPUT' && (target as HTMLInputElement).value !== '') return
        if (target.tagName === 'SELECT' && (target as HTMLSelectElement).value !== '') return
        if (h.current.removeRowIfEmpty(row)) ev.preventDefault()
      }
    }
    root.addEventListener('keydown', onKey)
    return () => root.removeEventListener('keydown', onKey)
  }, [rootRef])
}

function parseCoord(el: HTMLElement): GridCellCoord | null {
  // Walk up until we find a data-cell
  let cur: HTMLElement | null = el
  for (let i = 0; i < 5 && cur; i++) {
    const d = cur.getAttribute('data-cell')
    if (d) {
      const [r, c] = d.split(',').map(Number)
      return Number.isFinite(r) && Number.isFinite(c) ? { row: r, col: c } : null
    }
    cur = cur.parentElement
  }
  return null
}

export function focusCell(root: HTMLElement, row: number, col: number) {
  const el = root.querySelector<HTMLElement>(`[data-cell="${row},${col}"]`)
  if (!el) return
  const focusable = findFocusable(el)
  ;(focusable ?? el).focus()
  if (focusable instanceof HTMLInputElement && focusable.type !== 'checkbox') focusable.select()
}

function findFocusable(el: HTMLElement): HTMLElement | null {
  if (el.matches('input, select, button, [tabindex]')) return el
  return el.querySelector<HTMLElement>('input, select, button, [tabindex]')
}
