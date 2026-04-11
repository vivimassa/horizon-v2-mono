// SkyHub — Typography Tokens
// NEVER go below 13px for any entry (user memory: feedback_min_font_size.md)

interface TypographyStyle {
  fontSize: number
  fontWeight: '400' | '500' | '600' | '700'
  lineHeight: number
  letterSpacing?: number
  textTransform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none'
  fontFamily?: string
}

export const typography = {
  pageTitle: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: -0.3,
  },
  panelHeader: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  body: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  secondary: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  lead: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  badge: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  cardDescription: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  stat: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  statLarge: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
  },
} satisfies Record<string, TypographyStyle>

export type TypographyKey = keyof typeof typography
