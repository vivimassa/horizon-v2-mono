// SkyHub — Button component
// Wraps Gluestack Button for accessibility with SkyHub visual design
import React from 'react'
import { View } from 'react-native'
import {
  Button as GButton,
  ButtonText,
  ButtonSpinner,
  ButtonIcon,
} from '../gluestack/button'
import { useTheme } from '../hooks/useTheme'
import { accentTint } from '../theme/colors'
import { shadowStyles } from '../theme/shadows'
import type { LucideIcon } from '../theme/icons'

interface ButtonProps {
  title: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md'
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  leftIcon?: LucideIcon
}

const RED = '#dc2626'
const RED_TINT = 'rgba(220,38,38,0.1)'
const WHITE = '#ffffff'

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  onPress,
  disabled = false,
  loading = false,
  leftIcon,
}: ButtonProps) {
  const { accentColor, palette } = useTheme()

  const heightClass = size === 'sm' ? 'min-h-[36px]' : 'min-h-[44px]'
  const textSize = size === 'sm' ? 'text-[13px]' : 'text-[14px]'

  let bgStyle: any = {}
  let textColor = WHITE
  let borderStyle: any = {}
  let spinnerColor = WHITE
  let shadow = shadowStyles.card

  switch (variant) {
    case 'primary':
      bgStyle = { backgroundColor: accentColor }
      textColor = WHITE
      spinnerColor = WHITE
      break
    case 'secondary':
      bgStyle = { backgroundColor: 'transparent' }
      textColor = accentColor
      borderStyle = { borderWidth: 1, borderColor: accentColor }
      spinnerColor = accentColor
      shadow = {}
      break
    case 'ghost':
      bgStyle = { backgroundColor: 'transparent' }
      textColor = accentColor
      spinnerColor = accentColor
      shadow = {}
      break
    case 'destructive':
      bgStyle = { backgroundColor: RED_TINT }
      textColor = RED
      spinnerColor = RED
      shadow = {}
      break
  }

  return (
    <GButton
      className={`flex-row items-center justify-center rounded-[10px] px-4 ${heightClass}`}
      style={{
        ...bgStyle,
        ...borderStyle,
        ...(disabled ? { opacity: 0.5 } : shadow),
      }}
      onPress={onPress}
      isDisabled={disabled}
      isLoading={loading}
    >
      {loading ? (
        <ButtonSpinner color={spinnerColor} />
      ) : (
        <>
          {leftIcon ? (
            <ButtonIcon
              as={leftIcon}
              size={size === 'sm' ? 16 : 18}
              color={textColor}
              className="mr-1.5"
            />
          ) : null}
          <ButtonText
            className={`${textSize} font-semibold`}
            style={{ color: textColor }}
          >
            {title}
          </ButtonText>
        </>
      )}
    </GButton>
  )
}
