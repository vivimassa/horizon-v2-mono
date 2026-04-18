'use client'

import { useCallback, useEffect, useRef, type RefObject } from 'react'
import type { MapRef } from 'react-map-gl/mapbox'
import {
  AIRCRAFT_CLASSES,
  CLASS_SVG_PATH,
  classifyAircraft,
  type AircraftClass,
} from '@/lib/world-map/aircraft-classes'
import { generateAircraftSvg, resolveAircraftShape } from '@/lib/world-map/aircraft-silhouette'

interface UseAircraftIconsArgs {
  mapRef: RefObject<MapRef | null>
  isDark: boolean
  acTypeColors: Record<string, string>
}

export function useAircraftIcons({ mapRef, isDark, acTypeColors }: UseAircraftIconsArgs) {
  const classImagesRef = useRef<Partial<Record<AircraftClass, HTMLImageElement>>>({})
  const generatedImagesRef = useRef<Record<string, HTMLImageElement | false>>({})

  const loadGeneratedImage = useCallback((icao: string): Promise<HTMLImageElement | null> => {
    const cached = generatedImagesRef.current[icao]
    if (cached === false) return Promise.resolve(null)
    if (cached) return Promise.resolve(cached)
    const shape = resolveAircraftShape(icao)
    if (!shape) {
      generatedImagesRef.current[icao] = false
      return Promise.resolve(null)
    }
    const svg = generateAircraftSvg(shape)
    const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        generatedImagesRef.current[icao] = img
        resolve(img)
      }
      img.onerror = () => {
        generatedImagesRef.current[icao] = false
        resolve(null)
      }
      img.src = url
    })
  }, [])

  const createTintedIcon = useCallback((img: HTMLImageElement, tintColor: string): ImageData => {
    const w = img.naturalWidth || 256
    const h = img.naturalHeight || 256
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, w, h)
    ctx.globalCompositeOperation = 'source-atop'
    const rc = parseInt(tintColor.slice(1, 3), 16)
    const gc = parseInt(tintColor.slice(3, 5), 16)
    const bc = parseInt(tintColor.slice(5, 7), 16)
    const grey = Math.round(rc * 0.299 + gc * 0.587 + bc * 0.114)
    const desat = 0.2
    const r = Math.round(rc + (grey - rc) * desat)
    const g = Math.round(gc + (grey - gc) * desat)
    const b = Math.round(bc + (grey - bc) * desat)
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(0, 0, w, h)
    return ctx.getImageData(0, 0, w, h)
  }, [])

  const createShadowIcon = useCallback(
    (img: HTMLImageElement, shadowColor: string, alpha: number, blurPx: number): ImageData => {
      const w = img.naturalWidth || 256
      const h = img.naturalHeight || 256
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.filter = `blur(${blurPx}px)`
      ctx.drawImage(img, 0, 0, w, h)
      ctx.filter = 'none'
      ctx.globalCompositeOperation = 'source-atop'
      const rc = parseInt(shadowColor.slice(1, 3), 16)
      const gc = parseInt(shadowColor.slice(3, 5), 16)
      const bc = parseInt(shadowColor.slice(5, 7), 16)
      ctx.fillStyle = `rgba(${rc},${gc},${bc},${alpha})`
      ctx.fillRect(0, 0, w, h)
      return ctx.getImageData(0, 0, w, h)
    },
    [],
  )

  // Neutral cool-gray tint for all aircraft — reads premium on both themes.
  // Status is carried by a separate dot layer, not the silhouette fill.
  const neutralTint = isDark ? '#B8BBC6' : '#5A5C66'
  const shadowColor = isDark ? '#FFFFFF' : '#000000'
  const shadowAlpha = isDark ? 0.18 : 0.28
  const shadowBlurPx = isDark ? 5 : 4

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addAircraftIcons = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (map: any) => {
      const images = classImagesRef.current
      const register = (key: string, source: HTMLImageElement) => {
        if (!map.hasImage(key)) {
          map.addImage(key, createTintedIcon(source, neutralTint))
        }
        const shadowKey = `shadow-${key}`
        if (!map.hasImage(shadowKey)) {
          map.addImage(shadowKey, createShadowIcon(source, shadowColor, shadowAlpha, shadowBlurPx))
        }
      }

      for (const cls of AIRCRAFT_CLASSES) {
        const img = images[cls]
        if (!img || !img.complete) continue
        register(`aircraft-${cls}`, img)
      }
      for (const icao of Object.keys(acTypeColors)) {
        const cls = classifyAircraft(icao)
        const key = `aircraft-${cls}-${icao}`
        if (map.hasImage(key) && map.hasImage(`shadow-${key}`)) continue

        const generated = await loadGeneratedImage(icao)
        const source = generated ?? images[cls]
        if (!source || !source.complete) continue
        register(key, source)
      }
    },
    [
      acTypeColors,
      createTintedIcon,
      createShadowIcon,
      loadGeneratedImage,
      neutralTint,
      shadowColor,
      shadowAlpha,
      shadowBlurPx,
    ],
  )

  // Preload one SVG per class so the tint pipeline can rasterise them.
  useEffect(() => {
    for (const cls of AIRCRAFT_CLASSES) {
      const img = new Image()
      img.src = CLASS_SVG_PATH[cls]
      img.onload = () => {
        classImagesRef.current[cls] = img
        const map = mapRef.current?.getMap()
        if (map) addAircraftIcons(map)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-register icons when colors arrive (post-mount) or when the theme
  // flips. Theme flip removes existing images first so the new tint applies.
  const lastTintRef = useRef(neutralTint)
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !map.loaded()) return
    if (lastTintRef.current !== neutralTint) {
      const removeBoth = (key: string) => {
        if (map.hasImage(key)) map.removeImage(key)
        const sk = `shadow-${key}`
        if (map.hasImage(sk)) map.removeImage(sk)
      }
      for (const cls of AIRCRAFT_CLASSES) removeBoth(`aircraft-${cls}`)
      for (const icao of Object.keys(acTypeColors)) {
        const cls = classifyAircraft(icao)
        removeBoth(`aircraft-${cls}-${icao}`)
      }
      lastTintRef.current = neutralTint
    }
    addAircraftIcons(map)
  }, [acTypeColors, addAircraftIcons, neutralTint, mapRef])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMapLoad = useCallback((e: any) => addAircraftIcons(e.target), [addAircraftIcons])

  const handleStyleData = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      const map = e.target
      setTimeout(() => addAircraftIcons(map), 100)
    },
    [addAircraftIcons],
  )

  return { handleMapLoad, handleStyleData }
}
