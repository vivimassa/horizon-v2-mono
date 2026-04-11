// SkyHub — Text component with typography variants
// Consumes typography.ts tokens so no screen needs to hardcode fontSize/fontWeight.
// All variants are >=13px (user memory: feedback_min_font_size.md).
import React from 'react'
import { Text as RNText, type TextProps as RNTextProps } from 'react-native'
import { useTheme } from '../hooks/useTheme'
import { typography, type TypographyKey } from '../theme/typography'

export type TextVariant = TypographyKey

const MUTED_VARIANTS: readonly TextVariant[] = ['secondary', 'caption', 'cardDescription'] as const

interface TextProps extends RNTextProps {
  variant?: TextVariant
  /** Force secondary color regardless of variant. */
  muted?: boolean
  /** Override color (wins over variant + muted). */
  color?: string
}

export function Text({ variant = 'body', muted = false, color, style, children, ...rest }: TextProps) {
  const { palette } = useTheme()
  const tokens = typography[variant] as {
    fontSize: number
    fontWeight: '400' | '500' | '600' | '700'
    lineHeight: number
    letterSpacing?: number
    textTransform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none'
    fontFamily?: string
  }

  const defaultMuted = (MUTED_VARIANTS as readonly TextVariant[]).includes(variant)
  const resolvedColor = color ?? (muted || defaultMuted ? palette.textSecondary : palette.text)

  return (
    <RNText
      {...rest}
      style={[
        {
          fontSize: tokens.fontSize,
          fontWeight: tokens.fontWeight,
          lineHeight: tokens.lineHeight,
          letterSpacing: tokens.letterSpacing,
          textTransform: tokens.textTransform,
          fontFamily: tokens.fontFamily,
          color: resolvedColor,
        },
        style,
      ]}
    >
      {children}
    </RNText>
  )
}
