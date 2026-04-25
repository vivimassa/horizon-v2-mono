// Gantt hit-testing for canvas/touch coordinates. Pure JS, shared by web + mobile.

import type { BarLayout } from '@skyhub/types'

/**
 * Find the bar under a click/hover position (canvas coordinates).
 * Returns the flightId or null.
 * Iterates in reverse so topmost (last-drawn) bars get priority.
 */
export function hitTestBars(x: number, y: number, bars: BarLayout[]): string | null {
  for (let i = bars.length - 1; i >= 0; i--) {
    const b = bars[i]
    if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
      return b.flightId
    }
  }
  return null
}

/**
 * Find which aircraft row a y-coordinate falls in.
 * Returns the row index or -1 if outside all aircraft rows.
 * Used for drag-and-drop targeting.
 */
export function hitTestRow(y: number, rows: Array<{ y: number; height: number; type: string }>): number {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (y >= r.y && y < r.y + r.height && r.type === 'aircraft') {
      return i
    }
  }
  return -1
}
