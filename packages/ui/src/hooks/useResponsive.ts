import { useWindowDimensions } from 'react-native'

export function useResponsive() {
  const { width } = useWindowDimensions()
  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    columns: width < 768 ? 1 : width < 1024 ? 2 : 3,
  }
}
