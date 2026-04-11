'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getWebFonts, getSavedTextScale, saveTextScale, type TextScale, type WebFonts } from '@/lib/fonts'

// ── Persistence keys ──
const CONTRAST_KEY = 'skyhub-contrast'
const BRIGHTNESS_KEY = 'skyhub-brightness'

interface DisplayContextValue {
  textScale: TextScale
  setTextScale: (scale: TextScale) => void
  fonts: WebFonts
  contrast: number // 0 = low, 1 = normal, 2 = high
  setContrast: (v: number) => void
  brightness: number // 0-100, default 50
  setBrightness: (v: number) => void
}

const DisplayCtx = createContext<DisplayContextValue>({
  textScale: 'default',
  setTextScale: () => {},
  fonts: getWebFonts('default'),
  contrast: 1,
  setContrast: () => {},
  brightness: 50,
  setBrightness: () => {},
})

export function useDisplay() {
  return useContext(DisplayCtx)
}

export function DisplayProvider({ children }: { children: React.ReactNode }) {
  const [textScale, setScale] = useState<TextScale>('default')
  const [contrast, setContrastState] = useState(1)
  const [brightness, setBrightnessState] = useState(50)

  // Init from localStorage
  useEffect(() => {
    setScale(getSavedTextScale())
    const savedContrast = localStorage.getItem(CONTRAST_KEY)
    if (savedContrast) setContrastState(Number(savedContrast))
    const savedBrightness = localStorage.getItem(BRIGHTNESS_KEY)
    if (savedBrightness) setBrightnessState(Number(savedBrightness))
  }, [])

  // Apply text scale via CSS custom property on <html>
  // This scales ALL text including clamp()-based sizes
  useEffect(() => {
    const multiplier = textScale === 'small' ? 0.92 : textScale === 'default' ? 1 : textScale === 'large' ? 1.1 : 1.2
    document.documentElement.style.setProperty('--text-scale', String(multiplier))
    document.documentElement.style.fontSize = `${multiplier * 100}%`
  }, [textScale])

  // Apply contrast via CSS filter
  useEffect(() => {
    // 0=low (0.85), 1=normal (1.0), 2=high (1.2)
    const contrastValue = contrast === 0 ? 0.85 : contrast === 1 ? 1.0 : 1.2
    document.documentElement.style.setProperty('--display-contrast', String(contrastValue))
  }, [contrast])

  // Apply brightness via CSS filter
  useEffect(() => {
    // 0-100 maps to 0.7-1.3 brightness
    const brightnessValue = 0.7 + (brightness / 100) * 0.6
    document.documentElement.style.setProperty('--display-brightness', String(brightnessValue))
  }, [brightness])

  // Apply combined filter to main content
  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return
    const c = contrast === 0 ? 0.85 : contrast === 1 ? 1.0 : 1.2
    const b = 0.7 + (brightness / 100) * 0.6
    const isDark = document.documentElement.classList.contains('dark')
    const sat = isDark ? 0.8 : 1
    main.style.filter = `contrast(${c}) brightness(${b}) saturate(${sat})`
  }, [contrast, brightness])

  const setTextScale = useCallback((scale: TextScale) => {
    setScale(scale)
    saveTextScale(scale)
  }, [])

  const setContrast = useCallback((v: number) => {
    setContrastState(v)
    localStorage.setItem(CONTRAST_KEY, String(v))
  }, [])

  const setBrightness = useCallback((v: number) => {
    setBrightnessState(v)
    localStorage.setItem(BRIGHTNESS_KEY, String(v))
  }, [])

  const fonts = getWebFonts(textScale)

  return (
    <DisplayCtx.Provider
      value={{
        textScale,
        setTextScale,
        fonts,
        contrast,
        setContrast,
        brightness,
        setBrightness,
      }}
    >
      {children}
    </DisplayCtx.Provider>
  )
}
