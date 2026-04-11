'use client'

import type { HTMLAttributes, ReactNode } from 'react'

interface ScreenContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** Apply page horizontal padding (default: true) */
  padded?: boolean
}

/**
 * Web parity with packages/ui ScreenContainer. No safe-area concept on web —
 * padding/layout only. Tailwind layers on top of the page's existing gradient
 * background from globals.css.
 */
export function ScreenContainer({ children, padded = true, className = '', ...rest }: ScreenContainerProps) {
  return (
    <div {...rest} className={`flex flex-col h-full ${padded ? 'px-4' : ''} ${className}`.trim()}>
      {children}
    </div>
  )
}
