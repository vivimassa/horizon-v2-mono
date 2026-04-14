import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

type Direction = 'in' | 'out'

interface RevealOpts {
  origin?: { x: number; y: number }
  accent?: string
  /** 'in' = page circle-reveals from the origin (forward / drill-in).
   *  'out' = current page circle-collapses toward the origin (back / home). */
  direction?: Direction
}

type DocWithVT = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void> }
}

export function supportsViewTransitions(): boolean {
  if (typeof document === 'undefined') return false
  return typeof (document as DocWithVT).startViewTransition === 'function'
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function emitNavStart() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('sky:nav-start'))
}
function emitNavEnd() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('sky:nav-end'))
}

/**
 * Radial / punch-through navigation. On browsers without View Transitions,
 * or when reduce-motion is set, falls through to a plain router.push.
 * Always emits `sky:nav-start` / `sky:nav-end` on window so a global
 * progress bar can track load state independent of the animation timing.
 */
export function revealNavigate(router: AppRouterInstance, href: string, opts: RevealOpts = {}): void {
  const doc = document as DocWithVT
  emitNavStart()

  if (!supportsViewTransitions() || prefersReducedMotion()) {
    router.push(href)
    // progress bar listens for pathname change too; emit end on next tick
    // for the immediate-nav path.
    setTimeout(emitNavEnd, 0)
    return
  }

  const { origin, accent = '#1e40af', direction = 'in' } = opts
  const cx = origin?.x ?? window.innerWidth / 2
  const cy = origin?.y ?? window.innerHeight / 2
  const r = Math.ceil(
    Math.max(
      Math.hypot(cx, cy),
      Math.hypot(window.innerWidth - cx, cy),
      Math.hypot(cx, window.innerHeight - cy),
      Math.hypot(window.innerWidth - cx, window.innerHeight - cy),
    ),
  )

  const root = document.documentElement
  root.style.setProperty('--reveal-x', `${cx}px`)
  root.style.setProperty('--reveal-y', `${cy}px`)
  root.style.setProperty('--reveal-r', `${r}px`)
  root.style.setProperty('--route-accent', accent)
  const cls = direction === 'out' ? 'nav-back' : 'nav-reveal'
  root.classList.add(cls)

  const t = doc.startViewTransition!(async () => {
    router.push(href)
    await Promise.race([
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
      new Promise<void>((resolve) => setTimeout(resolve, 80)),
    ])
  })
  t.finished
    .catch(() => {
      /* swallow AbortError from slow devices */
    })
    .finally(() => {
      root.classList.remove(cls)
      emitNavEnd()
    })
}
