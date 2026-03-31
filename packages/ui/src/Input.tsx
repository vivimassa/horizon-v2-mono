import { styled, Input as TamaguiInput } from 'tamagui'

export const Input = styled(TamaguiInput, {
  name: 'Input',
  fontSize: 14,
  minHeight: 44,
  paddingHorizontal: '$md',
  borderRadius: '$input',
  borderWidth: 0.5,
  backgroundColor: '$cardBackground',
  borderColor: '$borderColor',
  color: '$color',
  placeholderTextColor: '$colorTertiary',
  focusStyle: {
    borderColor: '$accentColor',
    borderWidth: 1.5,
  },
})
