import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'auth.biometricProfile'

export interface BiometricProfile {
  email: string
  refreshToken: string
}

let _cache: BiometricProfile | null = null

export async function hydrateBiometricProfile(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    _cache = raw ? (JSON.parse(raw) as BiometricProfile) : null
  } catch {
    _cache = null
  }
}

export const biometricProfile = {
  get: (): BiometricProfile | null => _cache,
  set: (p: BiometricProfile) => {
    _cache = p
    AsyncStorage.setItem(KEY, JSON.stringify(p)).catch(() => {})
  },
  clear: () => {
    _cache = null
    AsyncStorage.removeItem(KEY).catch(() => {})
  },
}
