'use client'

import { useEffect, useState, useCallback } from 'react'

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
 * Listens for changes via custom events so Settings toggles take effect immediately.
 */
export function AnimatedBodyBg() {
  const [preset, setPreset] = useState<Preset>('aurora')

  const applyPreset = useCallback((p: Preset) => {
    setPreset(p)
    const body = document.body
    body.classList.remove('anim-bg')
    PRESETS.forEach((pr) => body.classList.remove(`anim-bg-${pr}`))
    if (p !== 'none') {
      body.classList.add('anim-bg', `anim-bg-${p}`)
    }
  }, [])

  // Init from localStorage
  useEffect(() => {
    applyPreset(getBgPreset())
  }, [applyPreset])

  // Listen for changes from Settings
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Preset
      applyPreset(detail)
    }
    window.addEventListener(EVENT_NAME, handler)
    return () => window.removeEventListener(EVENT_NAME, handler)
  }, [applyPreset])

  return null
}
