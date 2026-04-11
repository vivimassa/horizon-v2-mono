'use client'

import type { InputHTMLAttributes, ReactNode } from 'react'
import { useState } from 'react'
import { Text } from './Text'

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  success?: boolean
}

export function TextInput({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  success,
  className = '',
  onFocus,
  onBlur,
  ...rest
}: TextInputProps) {
  const [focused, setFocused] = useState(false)

  let ringClass = 'border-hz-border'
  if (error) ringClass = 'border-[#E63535] ring-2 ring-[#E63535]/30'
  else if (success) ringClass = 'border-[#06C270] ring-2 ring-[#06C270]/30'
  else if (focused) ringClass = 'border-module-accent ring-2 ring-module-accent/30'

  return (
    <div className={className}>
      {label ? (
        <Text variant="fieldLabel" muted as="div" className="mb-1.5">
          {label}
        </Text>
      ) : null}

      <div className={`flex items-center gap-2 h-10 rounded-lg border bg-hz-card px-3 transition-colors ${ringClass}`}>
        {leftIcon ? <span className="shrink-0 text-hz-text-secondary">{leftIcon}</span> : null}

        <input
          {...rest}
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          className="flex-1 bg-transparent text-[14px] text-hz-text outline-none placeholder:text-hz-text-secondary/50"
        />

        {rightIcon ? <span className="shrink-0 text-hz-text-secondary">{rightIcon}</span> : null}
      </div>

      {error ? (
        <Text variant="caption" as="div" className="mt-1 !text-[#E63535]">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" muted as="div" className="mt-1">
          {hint}
        </Text>
      ) : null}
    </div>
  )
}
