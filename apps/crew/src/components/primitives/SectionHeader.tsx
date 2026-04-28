import type React from 'react'
import { Text, View, type ViewStyle } from 'react-native'
import { TYPE, type Theme } from '../../theme/tokens'

type Variant = 'bar' | 'eyebrow'

interface Props {
  t: Theme
  children: React.ReactNode
  action?: string
  style?: ViewStyle
  variant?: Variant
}

/**
 * Section heading with two visual variants.
 *  - 'eyebrow' (default — glass design language): small accent caps eyebrow
 *    above a 17px/700 title.
 *  - 'bar': legacy 3px accent bar + 16px/700 title (kept for any non-glass
 *    callers that still want the original look).
 */
export function SectionHeader({ t, children, action, style, variant = 'eyebrow' }: Props) {
  const text = typeof children === 'string' ? children : ''
  const eyebrow = text ? text.split(' ')[0]!.toUpperCase() : ''

  if (variant === 'eyebrow' && text) {
    return (
      <View style={[{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, style]}>
        <View>
          <Text style={{ color: t.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 }}>{eyebrow}</Text>
          <Text style={{ fontSize: 17, fontWeight: '700', letterSpacing: -0.3, color: t.text, marginTop: 2 }}>
            {text}
          </Text>
        </View>
        {action && <Text style={{ color: t.accent, fontSize: 13, fontWeight: '600' }}>{action}</Text>}
      </View>
    )
  }

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: t.accent, marginRight: 8 }} />
        <Text style={{ ...TYPE.section, color: t.text }}>{children}</Text>
      </View>
      {action && <Text style={{ ...TYPE.caption, color: t.accent, fontWeight: '600' }}>{action}</Text>}
    </View>
  )
}
