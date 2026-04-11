import { createMMKV } from 'react-native-mmkv'

const storage = createMMKV({ id: 'skyhub-auth' })

const KEYS = {
  ACCESS_TOKEN: 'auth.accessToken',
  REFRESH_TOKEN: 'auth.refreshToken',
  BIOMETRIC_ENABLED: 'auth.biometricEnabled',
} as const

export const tokenStorage = {
  getAccessToken: (): string | null => storage.getString(KEYS.ACCESS_TOKEN) ?? null,
  getRefreshToken: (): string | null => storage.getString(KEYS.REFRESH_TOKEN) ?? null,

  setTokens: (access: string, refresh: string) => {
    storage.set(KEYS.ACCESS_TOKEN, access)
    storage.set(KEYS.REFRESH_TOKEN, refresh)
  },

  clearTokens: () => {
    storage.remove(KEYS.ACCESS_TOKEN)
    storage.remove(KEYS.REFRESH_TOKEN)
  },

  /**
   * Local biometric preference. Kept locally because the bootstrap check
   * runs before the refresh token has been redeemed — we can't ask the
   * server until we've signed in. The server copy lives at
   * user.security.biometricEnabled and is updated alongside this flag
   * whenever the user toggles the setting.
   */
  isBiometricEnabled: (): boolean => storage.getBoolean(KEYS.BIOMETRIC_ENABLED) ?? false,

  setBiometricEnabled: (enabled: boolean) => {
    if (enabled) storage.set(KEYS.BIOMETRIC_ENABLED, true)
    else storage.remove(KEYS.BIOMETRIC_ENABLED)
  },
}
