import { type ReactNode } from 'react'
import { Pressable, View, type ViewStyle } from 'react-native'
import type { Theme } from '../../theme/tokens'

interface Props {
  t: Theme
  children: ReactNode
  padding?: number
  style?: ViewStyle
  onPress?: () => void
  accentBar?: string
}

export function Card({ t, children, padding = 14, style, onPress, accentBar }: Props) {
  const baseStyle: ViewStyle = {
    backgroundColor: t.card,
    borderWidth: 0.5,
    borderColor: t.cardBorder,
    borderRadius: 12,
    padding,
    overflow: 'hidden',
    position: 'relative',
    ...style,
  }
  const inner = (
    <>
      {accentBar && (
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: accentBar }} />
      )}
      {children}
    </>
  )
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={baseStyle}>
        {inner}
      </Pressable>
    )
  }
  return <View style={baseStyle}>{inner}</View>
}
