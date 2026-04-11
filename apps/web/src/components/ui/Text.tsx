'use client'

import type { HTMLAttributes, ReactNode } from 'react'

export type TextVariant =
  | 'pageTitle'
  | 'sectionHeading'
  | 'panelHeader'
  | 'body'
  | 'bodyLarge'
  | 'secondary'
  | 'lead'
  | 'fieldLabel'
  | 'caption'
  | 'badge'
  | 'cardTitle'
  | 'cardDescription'
  | 'stat'
  | 'statLarge'
  | 'tabLabel'

/** Parity with packages/ui Text variants. All >= 13px per user rule. */
const VARIANT_CLASSES: Record<TextVariant, string> = {
  pageTitle: 'text-[20px] font-semibold leading-[26px]',
  sectionHeading: 'text-[15px] font-bold leading-[20px] tracking-[-0.3px]',
  panelHeader: 'text-[15px] font-medium leading-[20px]',
  body: 'text-[14px] font-normal leading-[20px]',
  bodyLarge: 'text-[16px] font-normal leading-[24px]',
  secondary: 'text-[13px] font-normal leading-[18px]',
  lead: 'text-[14px] font-bold leading-[20px]',
  fieldLabel: 'text-[13px] font-medium leading-[16px] tracking-[0.5px] uppercase',
  caption: 'text-[13px] font-normal leading-[18px]',
  badge: 'text-[13px] font-semibold leading-[16px]',
  cardTitle: 'text-[13px] font-medium leading-[18px]',
  cardDescription: 'text-[13px] font-normal leading-[18px]',
  stat: 'text-[18px] font-semibold leading-[24px]',
  statLarge: 'text-[24px] font-bold leading-[32px]',
  tabLabel: 'text-[13px] font-semibold leading-[16px]',
}

const MUTED_VARIANTS: readonly TextVariant[] = ['secondary', 'caption', 'cardDescription']

interface TextProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: TextVariant
  muted?: boolean
  /** Render as specific element (defaults to `span`) */
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'div'
  children?: ReactNode
}

export function Text({
  variant = 'body',
  muted = false,
  as: Tag = 'span',
  className = '',
  children,
  ...rest
}: TextProps) {
  const defaultMuted = MUTED_VARIANTS.includes(variant)
  const colorClass = muted || defaultMuted ? 'text-hz-text-secondary' : 'text-hz-text'

  return (
    <Tag {...rest} className={`${VARIANT_CLASSES[variant]} ${colorClass} ${className}`.trim()}>
      {children}
    </Tag>
  )
}
