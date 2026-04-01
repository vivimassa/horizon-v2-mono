import '../global.css'
import { Slot } from 'expo-router'
import { View } from 'react-native'
import { ThemeProvider, useAppTheme } from '../providers/ThemeProvider'
import { UserProvider } from '../providers/UserProvider'

function ThemedRoot() {
  const { isDark } = useAppTheme()
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#111118' : '#f0f2f5' }}>
      <Slot />
    </View>
  )
}

export default function Layout() {
  return (
    <ThemeProvider>
      <UserProvider>
        <ThemedRoot />
      </UserProvider>
    </ThemeProvider>
  )
}
