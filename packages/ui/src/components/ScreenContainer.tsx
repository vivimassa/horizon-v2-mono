// SkyHub — ScreenContainer
// Root wrapper for inner/detail screens. Applies safe-area + theme background.
// Use <PageShell> for main tab screens (it adds the gradient + title header).
import React from 'react'
import { View, type ViewProps } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../hooks/useTheme'

interface ScreenContainerProps extends ViewProps {
  children: React.ReactNode
  /** Include bottom safe-area inset (default: true) */
  safeBottom?: boolean
  /** Include top safe-area inset (default: true) */
  safeTop?: boolean
  /** Apply page horizontal padding (default: true). Set false for edge-to-edge content. */
  padded?: boolean
}

export function ScreenContainer({
  children,
  safeBottom = true,
  safeTop = true,
  padded = true,
  style,
  ...rest
}: ScreenContainerProps) {
  const { palette } = useTheme()

  const edges: Array<'top' | 'bottom' | 'left' | 'right'> = []
  if (safeTop) edges.push('top')
  if (safeBottom) edges.push('bottom')
  edges.push('left', 'right')

  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: palette.background }}>
      <View {...rest} style={[{ flex: 1, paddingHorizontal: padded ? 16 : 0 }, style]}>
        {children}
      </View>
    </SafeAreaView>
  )
}
