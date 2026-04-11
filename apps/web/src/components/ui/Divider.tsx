'use client'

interface DividerProps {
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

export function Divider({ orientation = 'horizontal', className = '' }: DividerProps) {
  if (orientation === 'vertical') {
    return <div className={`w-px self-stretch bg-hz-border ${className}`.trim()} />
  }
  return <div className={`h-px w-full bg-hz-border ${className}`.trim()} />
}
