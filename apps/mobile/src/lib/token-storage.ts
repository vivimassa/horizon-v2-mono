import AsyncStorage from '@react-native-async-storage/async-storage'

const KEYS = {
  ACCESS_TOKEN: 'auth.accessToken',
  REFRESH_TOKEN: 'auth.refreshToken',
  BIOMETRIC_ENABLED: 'auth.biometricEnabled',
} as const

// In-memory cache so synchronous reads work immediately after a set.
// AsyncStorage is async-only, but the API client expects sync getters.
let _accessToken: string | null = null
let _refreshToken: string | null = null
let _biometricEnabled = false

/**
 * Load tokens from disk into the in-memory cache.
 * Call once at app startup before the auth gate runs.
 */
export async function hydrateTokenStorage(): Promise<void> {
  const [at, rt, bio] = await AsyncStorage.multiGet([KEYS.ACCESS_TOKEN, KEYS.REFRESH_TOKEN, KEYS.BIOMETRIC_ENABLED])
  _accessToken = at[1] ?? null
  _refreshToken = rt[1] ?? null
  _biometricEnabled = bio[1] === 'true'
}

export const tokenStorage = {
  getAccessToken: (): string | null => _accessToken,
  getRefreshToken: (): string | null => _refreshToken,

  setTokens: (access: string, refresh: string) => {
    _accessToken = access
    _refreshToken = refresh
    AsyncStorage.setItem(KEYS.ACCESS_TOKEN, access).catch(() => {})
    AsyncStorage.setItem(KEYS.REFRESH_TOKEN, refresh).catch(() => {})
  },

  clearTokens: () => {
    _accessToken = null
    _refreshToken = null
    AsyncStorage.removeItem(KEYS.ACCESS_TOKEN).catch(() => {})
    AsyncStorage.removeItem(KEYS.REFRESH_TOKEN).catch(() => {})
  },

  isBiometricEnabled: (): boolean => _biometricEnabled,

  setBiometricEnabled: (enabled: boolean) => {
    _biometricEnabled = enabled
    if (enabled) AsyncStorage.setItem(KEYS.BIOMETRIC_ENABLED, 'true').catch(() => {})
    else AsyncStorage.removeItem(KEYS.BIOMETRIC_ENABLED).catch(() => {})
  },
}
