import '../utils/api-url' // auto-detect API base URL — must be first
import '../global.css'
import { useEffect, useRef, useState } from 'react'
import { Slot } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { api, setAuthCallbacks } from '@skyhub/api'
import { useAuthStore, useTheme, QueryProvider } from '@skyhub/ui'
import { ThemeProvider, useAppTheme } from '../providers/ThemeProvider'
import { UserProvider } from '../providers/UserProvider'
import { tokenStorage, hydrateTokenStorage } from '../src/lib/token-storage'
import { hydrateBiometricProfile, biometricProfile } from '../src/lib/biometric-profile'
import { promptBiometric } from '../src/lib/biometric-gate'
import { useOperatorStore } from '../src/stores/use-operator-store'
import LoginScreen from './login'

function AuthedShell() {
  // Fire-and-forget operator hydration so date-format + operator info are
  // cached as soon as the authed UI mounts. Store guards against double load.
  useEffect(() => {
    void useOperatorStore.getState().loadOperator()
  }, [])
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
      getRefreshToken: () => useAuthStore.getState().refreshToken ?? tokenStorage.getRefreshToken(),
      onTokenRefresh: (access, refresh) => {
        tokenStorage.setTokens(access, refresh)
        useAuthStore.getState().setTokens(access, refresh)
      },
      onAuthFailure: () => {
        tokenStorage.clearTokens()
        tokenStorage.setBiometricEnabled(false)
        biometricProfile.clear()
        useAuthStore.getState().logout()
      },
    })

    // Hydrate token cache from AsyncStorage, then try auto-login.
    const bootstrap = async () => {
      await Promise.all([hydrateTokenStorage(), hydrateBiometricProfile()])
      const stored = tokenStorage.getRefreshToken()
      if (!stored) {
        useAuthStore.getState().setLoading(false)
        return
      }
      // Biometric gate — only if the user opted in last time. On cancel or
      // failure we fall through to the login screen *without* clearing the
      // stored tokens, so the next password login can re-enable biometrics
      // without forcing a full re-enrollment.
      if (tokenStorage.isBiometricEnabled()) {
        const ok = await promptBiometric('Sign in to SkyHub')
        if (!ok) {
          useAuthStore.getState().setLoading(false)
          return
        }
      }

      try {
        const { accessToken, refreshToken } = await api.refreshToken(stored)
        tokenStorage.setTokens(accessToken, refreshToken)
        useAuthStore.getState().setTokens(accessToken, refreshToken)
        const user = await api.getMe()
        useAuthStore.getState().setUser(user as never)
      } catch {
        tokenStorage.clearTokens()
        tokenStorage.setBiometricEnabled(false)
        biometricProfile.clear()
        useAuthStore.getState().logout()
      } finally {
        useAuthStore.getState().setLoading(false)
      }
    }

    void bootstrap()
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
