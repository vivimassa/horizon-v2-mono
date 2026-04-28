import './../global.css'
import { useEffect, useRef, useState } from 'react'
import { Slot, useRouter } from 'expo-router'
import { ActivityIndicator, View, AppState } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Notifications from 'expo-notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DatabaseProvider, useDatabase } from '../src/providers/DatabaseProvider'
import { hydrateSecureStorage, secureTokenStorage } from '../src/lib/secure-token-storage'
import { promptBiometric } from '../src/lib/biometric-gate'
import { crewApi } from '../src/lib/api-client'
import { registerForPush } from '../src/lib/push-register'
import { useCrewAuthStore } from '../src/stores/use-crew-auth-store'
import { useThemeStore } from '../src/stores/use-theme-store'
import { syncCrewData } from '../src/sync/sync-trigger'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

function AuthGate() {
  const isLoading = useCrewAuthStore((s) => s.isLoading)
  const isAuthenticated = useCrewAuthStore((s) => s.isAuthenticated)
  const router = useRouter()
  const database = useDatabase()
  const bootstrapped = useRef(false)

  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true

    void (async () => {
      await Promise.all([hydrateSecureStorage(), useThemeStore.getState().hydrate()])
      const refresh = secureTokenStorage.getRefreshToken()
      if (!refresh) {
        useCrewAuthStore.getState().setLoading(false)
        return
      }

      // Biometric gate (only if previously enabled). Cancel ⇒ stay logged
      // out, keep refresh token cached so PIN re-entry is fast.
      if (secureTokenStorage.isBiometricEnabled()) {
        const ok = await promptBiometric('Sign in to SkyHub Crew')
        if (!ok) {
          useCrewAuthStore.getState().setLoading(false)
          return
        }
      }

      try {
        const tokens = await crewApi.refresh(refresh)
        secureTokenStorage.setTokens(tokens.accessToken, tokens.refreshToken)
        // No /crew-app/me yet — pull profile via initial sync. The
        // crew_profile row hydrates the auth store after sync runs.
        useCrewAuthStore.getState().setSession({
          crewId: secureTokenStorage.getCrewId() ?? '',
          operatorId: secureTokenStorage.getOperatorId() ?? '',
          employeeId: secureTokenStorage.getEmployeeId() ?? '',
          firstName: '',
          lastName: '',
          position: null,
          base: null,
          photoUrl: null,
        })
        void syncCrewData(database, true)
      } catch {
        secureTokenStorage.clearSession()
        useCrewAuthStore.getState().logout()
      }
    })()
  }, [database])

  // Push token registration — once authenticated.
  useEffect(() => {
    if (!isAuthenticated) return
    void (async () => {
      try {
        const reg = await registerForPush()
        if (reg) useCrewAuthStore.getState().setPushToken(reg.expoPushToken)
      } catch (err) {
        console.warn('[push] register failed', (err as Error).message)
      }
    })()
  }, [isAuthenticated])

  // Foreground sync — pull when app comes back to focus.
  useEffect(() => {
    if (!isAuthenticated) return
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncCrewData(database)
    })
    const interval = setInterval(() => {
      void syncCrewData(database)
    }, 5 * 60_000)
    return () => {
      sub.remove()
      clearInterval(interval)
    }
  }, [isAuthenticated, database])

  // Push-received handler — silent payload triggers a sync; tappable
  // payload deep-links to a message screen.
  useEffect(() => {
    const recvSub = Notifications.addNotificationReceivedListener((notif) => {
      const data = notif.request.content.data as { type?: string }
      if (data?.type === 'sync') void syncCrewData(database, true)
    })
    const respSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { type?: string; messageId?: string }
      if (data?.type === 'message' && data.messageId) {
        router.push(`/message/${data.messageId}`)
      } else if (data?.type === 'sync') {
        void syncCrewData(database, true)
      }
    })
    return () => {
      recvSub.remove()
      respSub.remove()
    }
  }, [database, router])

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0E0E14' }}>
        <ActivityIndicator size="large" color="#1e88ff" />
      </View>
    )
  }

  return <Slot />
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <DatabaseProvider>
            <AuthGate />
          </DatabaseProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
