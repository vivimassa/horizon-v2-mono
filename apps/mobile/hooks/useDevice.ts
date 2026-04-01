import { useWindowDimensions } from 'react-native'

const TABLET_WIDTH = 768

export function useDevice() {
  const { width, height } = useWindowDimensions()
  const isTablet = width >= TABLET_WIDTH
  const isLandscape = width > height

  // Responsive font scale: 1x phone, ~1.2x tablet
  const fs = isTablet ? 1.2 : 1

  // Responsive spacing scale
  const ss = isTablet ? 1.25 : 1

  return {
    width,
    height,
    isTablet,
    isLandscape,
    /** Font scale multiplier (1 on phone, 1.2 on tablet) */
    fs,
    /** Spacing scale multiplier (1 on phone, 1.25 on tablet) */
    ss,
    /** Scale a font size for the current device */
    font: (size: number) => Math.round(size * fs),
    /** Scale a spacing value for the current device */
    space: (size: number) => Math.round(size * ss),
  }
}
