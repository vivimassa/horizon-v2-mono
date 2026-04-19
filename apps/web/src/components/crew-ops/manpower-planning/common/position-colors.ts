/** Consistent per-position colors for bar chart + heatmap. Uses XD
 *  palette for the 4 standard positions, falls back to the
 *  CrewPosition.color when available. */
const FALLBACK: Record<string, string> = {
  CP: '#0063F7', // info blue
  FO: '#7c3aed', // violet
  PU: '#FF8800', // warning amber
  CA: '#06C270', // success green
}

export function positionColor(code: string, color?: string | null): string {
  if (color && /^#[0-9a-fA-F]{6}$/.test(color)) return color
  return FALLBACK[code] ?? '#14B8A6'
}
