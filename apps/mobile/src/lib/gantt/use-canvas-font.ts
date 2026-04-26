// Skia font hook that gracefully no-ops on web.
//
// `matchFont({ fontFamily: 'System' })` requires the platform-native font
// manager, which CanvasKit-Wasm does not implement (`matchFamilyStyle` is
// stubbed with "Not implemented on React Native Web"). All Skia Text layers
// in the Gantt already guard against a null font, so returning null on web
// keeps the canvas (rects, lines, bars) rendering — labels are simply hidden.

import { useMemo } from 'react'
import { Platform } from 'react-native'
import { matchFont, type SkFont } from '@shopify/react-native-skia'

export function useCanvasFont(size: number): SkFont | null {
  return useMemo(() => {
    if (Platform.OS === 'web') return null
    return matchFont({
      fontFamily: 'System',
      fontSize: size,
      fontStyle: 'normal',
      fontWeight: 'normal',
    })
  }, [size])
}
