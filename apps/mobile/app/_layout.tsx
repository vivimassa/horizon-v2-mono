import '../utils/api-url' // auto-detect API base URL — must be first
import '../global.css'
import { useEffect, useRef } from 'react'
import { Slot } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { api, setAuthCallbacks } from '@skyhub/api'
import { useAuthStore, useTheme, QueryProvider } from '@skyhub/ui'
import { ThemeProvider, useAppTheme } from '../providers/ThemeProvider'
import { UserProvider } from '../providers/UserProvider'
import { tokenStorage } from '../src/lib/token-storage'
import LoginScreen from './login'

function AuthedShell() {
  return (
    <UserProvider>
      <Slot />
    </UserProvider>
  )
}

function AuthGate() {
  const { palette, accentColor } = useTheme()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isLoading = useAuthStore((s) => s.isLoading)
  const bootstrapped = useRef(false)

  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true

    // Wire the API client to the auth store — one-time setup.
    setAuthCallbacks({
      getAccessToken: () => useAuthStore.getState().accessToken,
      onAuthFailure: () => {
        tokenStorage.clearTokens()
        useAuthStore.getState().logout()
      },
    })

    // Try to auto-log-in using the stored refresh token.
    const stored = tokenStorage.getRefreshToken()
    if (!stored) {
      useAuthStore.getState().setLoading(false)
      return
    }

    api
      .refreshToken(stored)
      .then(async ({ accessToken, refreshToken }) => {
        tokenStorage.setTokens(accessToken, refreshToken)
        useAuthStore.getState().setTokens(accessToken, refreshToken)
        const user = await api.getMe()
        useAuthStore.getState().setUser(user as never)
      })
      .catch(() => {
        tokenStorage.clearTokens()
        useAuthStore.getState().logout()
      })
      .finally(() => {
        useAuthStore.getState().setLoading(false)
      })
  }, [])

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background }}>
        <ActivityIndicator color={accentColor} size="large" />
      </View>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return <AuthedShell />
}

function ThemedRoot() {
  const { isDark } = useAppTheme()
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#111118' : '#f0f2f5' }}>
      <AuthGate />
    </View>
  )
}

export default function Layout() {
  return (
    <QueryProvider>
      <ThemeProvider>
        <ThemedRoot />
      </ThemeProvider>
    </QueryProvider>
  )
}
