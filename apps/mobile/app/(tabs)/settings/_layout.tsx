import { Stack } from 'expo-router'
import { useAppTheme } from '../../../providers/ThemeProvider'

export default function SettingsLayout() {
  const { palette } = useAppTheme()
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        animation: 'slide_from_right',
        animationDuration: 180,
        fullScreenGestureEnabled: true,
        contentStyle: { backgroundColor: palette.background },
      }}
    />
  )
}
