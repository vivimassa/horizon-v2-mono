import { createMMKV } from 'react-native-mmkv'

const storage = createMMKV({ id: 'skyhub-auth' })

const KEYS = {
  ACCESS_TOKEN: 'auth.accessToken',
  REFRESH_TOKEN: 'auth.refreshToken',
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
}
