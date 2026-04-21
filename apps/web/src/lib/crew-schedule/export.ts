/**
 * Crew Schedule export helpers (AIMS §4.1 "Export / print"). Two flows:
 *
 *   - `downloadScheduleImage`  — serialises the currently-rendered canvas
 *     to a PNG and triggers a browser download. Captures exactly what the
 *     planner sees on screen: quick snapshot for email / tickets.
 *   - `printSchedule`          — opens the browser print dialog against
 *     the current page. Combined with a print-only CSS, this is the
 *     fastest path to a real PDF without a server-side renderer.
 *
 * Both are pure DOM operations — no new deps.
 */

export function downloadScheduleImage(
  canvas: HTMLCanvasElement | null,
  periodFromIso: string,
  periodToIso: string,
): void {
  if (!canvas) return
  const filename = `crew-schedule_${periodFromIso}_${periodToIso}.png`
  canvas.toBlob(
    (blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // Give the browser a tick before revoking so the download fires.
      setTimeout(() => URL.revokeObjectURL(url), 100)
    },
    'image/png',
    0.95,
  )
}

export async function copyScheduleImageToClipboard(canvas: HTMLCanvasElement | null): Promise<boolean> {
  if (!canvas) return false
  try {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return false
    // `ClipboardItem` is the modern route; fall back to false if the
    // browser doesn't expose it (older Firefox, strict policies).
    const CI = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
    if (!CI || !navigator.clipboard?.write) return false
    await navigator.clipboard.write([new CI({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}

export function printSchedule(): void {
  // The canvas + UI will print via the browser. An accompanying
  // `@media print` stylesheet (future P4.3-polish) can hide the toolbar
  // and inspector to keep the output clean; for now we rely on the
  // user's browser print preview.
  window.print()
}
