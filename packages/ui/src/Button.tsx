import { styled, YStack, Text, type GetProps } from 'tamagui'

const ButtonFrame = styled(YStack, {
  name: 'Button',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '$input',
  paddingHorizontal: 16,
  minHeight: 36,
  cursor: 'pointer',
  pressStyle: {
    opacity: 0.7,
  },

  variants: {
    variant: {
      primary: {
        backgroundColor: '$accentColor',
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '$accentColor',
      },
    },
    disabled: {
      true: {
        opacity: 0.5,
        pointerEvents: 'none',
      },
    },
  } as const,

  defaultVariants: {
    variant: 'primary',
  },
})

const ButtonText = styled(Text, {
  fontSize: 14,
  fontWeight: '600',
  lineHeight: 20,

  variants: {
    variant: {
      primary: {
        color: '#ffffff',
      },
      outline: {
        color: '$accentColor',
      },
    },
  } as const,

  defaultVariants: {
    variant: 'primary',
  },
})

interface ButtonProps extends GetProps<typeof ButtonFrame> {
  title: string
  variant?: 'primary' | 'outline'
}

export function Button({ title, variant = 'primary', ...rest }: ButtonProps) {
  return (
    <ButtonFrame variant={variant} {...rest}>
      <ButtonText variant={variant}>{title}</ButtonText>
    </ButtonFrame>
  )
}
