'use client'

import { useEffect } from 'react'

const PRESETS = ['aurora', 'ember', 'lagoon', 'prism'] as const
type Preset = (typeof PRESETS)[number] | 'none'

const STORAGE_KEY = 'skyhub-bg-preset'
const EVENT_NAME = 'skyhub-bg-change'

/**
 * Read the current background preset from localStorage.
 */
export function getBgPreset(): Preset {
  if (typeof window === 'undefined') return 'aurora'
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && [...PRESETS, 'none'].includes(saved)) return saved as Preset
  return 'aurora'
}

/**
 * Set the background preset — persists to localStorage and notifies AnimatedBodyBg.
 */
export function setBgPreset(preset: Preset) {
  localStorage.setItem(STORAGE_KEY, preset)
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: preset }))
}

/**
 * Check if dynamic backgrounds are enabled (preset !== "none").
 */
export function isDynamicBgEnabled(): boolean {
  return getBgPreset() !== 'none'
}

/**
 * Toggle dynamic backgrounds on/off. When turning off, stores "none".
 * When turning on, restores the last non-none preset (default: "aurora").
 */
export function toggleDynamicBg() {
  const current = getBgPreset()
  if (current === 'none') {
    const last = localStorage.getItem('skyhub-bg-last') ?? 'aurora'
    setBgPreset(last as Preset)
  } else {
    localStorage.setItem('skyhub-bg-last', current)
    setBgPreset('none')
  }
}

/**
 * Applies the animated background CSS classes to <body>.
 *
 * DISABLED: The preset animation got stuck in a prior state and the CPU cost
 * isn't worth the visual. Until we revisit, this component strips every
 * `anim-bg*` class from <body> on mount and ignores any Settings toggle. The
 * helpers above (getBgPreset / setBgPreset / toggleDynamicBg) remain for any
 * caller that still references them, but they have no runtime effect here.
 */
export function AnimatedBodyBg() {
  useEffect(() => {
    const body = document.body
    body.classList.remove('anim-bg')
    PRESETS.forEach((pr) => body.classList.remove(`anim-bg-${pr}`))
    // Also wipe the stuck preset in storage so a future page load doesn't
    // try to re-apply it via a different code path.
    try {
      localStorage.setItem(STORAGE_KEY, 'none')
    } catch {
      /* ignore */
    }
  }, [])
  return null
}
