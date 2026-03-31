import { styled, YStack } from 'tamagui'

export const Card = styled(YStack, {
  name: 'Card',
  padding: '$md',
  borderRadius: '$card',
  borderWidth: 0.5,
  backgroundColor: '$cardBackground',
  borderColor: '$cardBorderColor',
  gap: '$sm',

  variants: {
    pressable: {
      true: {
        pressStyle: {
          opacity: 0.7,
          scale: 0.98,
        },
        cursor: 'pointer',
      },
    },
    elevated: {
      true: {
        shadowColor: '$color',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
      },
    },
    padded: {
      true: {
        padding: '$lg',
      },
    },
  } as const,
})
