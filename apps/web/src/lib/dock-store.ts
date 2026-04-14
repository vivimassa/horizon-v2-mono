import { create } from 'zustand'

/**
 * Global dock collapse state. Any component on any page can call
 * `collapseDock()` to fold the dock away (typical trigger: a page's
 * primary "Go" CTA that takes the user into a focus workspace). The
 * dock auto-expands whenever the pathname changes so fresh navigations
 * always reveal navigation chrome; users can manually fold it back via
 * the chevron on the dock itself.
 */
interface DockState {
  collapsed: boolean
  setCollapsed: (value: boolean) => void
  collapse: () => void
  expand: () => void
  toggle: () => void
}

export const useDockStore = create<DockState>((set) => ({
  collapsed: false,
  setCollapsed: (value) => set({ collapsed: value }),
  collapse: () => set({ collapsed: true }),
  expand: () => set({ collapsed: false }),
  toggle: () => set((s) => ({ collapsed: !s.collapsed })),
}))

/** Imperative helper for non-React callers (event handlers, utilities). */
export function collapseDock() {
  useDockStore.getState().collapse()
}
export function expandDock() {
  useDockStore.getState().expand()
}
