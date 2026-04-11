import { Stack } from 'expo-router'
import { useAppTheme } from '../../../providers/ThemeProvider'

export default function NetworkLayout() {
  const { palette } = useAppTheme()
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        animation: 'slide_from_right',
        fullScreenGestureEnabled: true,
        contentStyle: { backgroundColor: palette.background },
      }}
    />
  )
}
