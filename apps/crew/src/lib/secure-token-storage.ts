import * as SecureStore from 'expo-secure-store'

/**
 * Crew app token storage. Uses iOS Keychain / Android Keystore via
 * expo-secure-store — NOT AsyncStorage. Crew JWTs grant access to PII
 * (name, employee ID, full roster) so they live in OS-level secure
 * storage, not plaintext app prefs.
 *
 * In-memory cache on top because the API layer expects sync getters.
 */
const KEYS = {
  ACCESS_TOKEN: 'crew.accessToken',
  REFRESH_TOKEN: 'crew.refreshToken',
  OPERATOR_ID: 'crew.operatorId',
  CREW_ID: 'crew.crewId',
  EMPLOYEE_ID: 'crew.employeeId',
  BIOMETRIC_ENABLED: 'crew.biometricEnabled',
} as const

let _accessToken: string | null = null
let _refreshToken: string | null = null
let _operatorId: string | null = null
let _crewId: string | null = null
let _employeeId: string | null = null
let _biometricEnabled = false

export async function hydrateSecureStorage(): Promise<void> {
  const [at, rt, op, cr, eid, bio] = await Promise.all([
    SecureStore.getItemAsync(KEYS.ACCESS_TOKEN),
    SecureStore.getItemAsync(KEYS.REFRESH_TOKEN),
    SecureStore.getItemAsync(KEYS.OPERATOR_ID),
    SecureStore.getItemAsync(KEYS.CREW_ID),
    SecureStore.getItemAsync(KEYS.EMPLOYEE_ID),
    SecureStore.getItemAsync(KEYS.BIOMETRIC_ENABLED),
  ])
  _accessToken = at
  _refreshToken = rt
  _operatorId = op
  _crewId = cr
  _employeeId = eid
  _biometricEnabled = bio === 'true'
}

export const secureTokenStorage = {
  getAccessToken: () => _accessToken,
  getRefreshToken: () => _refreshToken,
  getOperatorId: () => _operatorId,
  getCrewId: () => _crewId,
  getEmployeeId: () => _employeeId,
  isBiometricEnabled: () => _biometricEnabled,

  setSession(args: {
    accessToken: string
    refreshToken: string
    operatorId: string
    crewId: string
    employeeId: string
  }) {
    _accessToken = args.accessToken
    _refreshToken = args.refreshToken
    _operatorId = args.operatorId
    _crewId = args.crewId
    _employeeId = args.employeeId
    SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, args.accessToken).catch(() => {})
    SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, args.refreshToken).catch(() => {})
    SecureStore.setItemAsync(KEYS.OPERATOR_ID, args.operatorId).catch(() => {})
    SecureStore.setItemAsync(KEYS.CREW_ID, args.crewId).catch(() => {})
    SecureStore.setItemAsync(KEYS.EMPLOYEE_ID, args.employeeId).catch(() => {})
  },

  setTokens(access: string, refresh: string) {
    _accessToken = access
    _refreshToken = refresh
    SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, access).catch(() => {})
    SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refresh).catch(() => {})
  },

  clearSession() {
    _accessToken = null
    _refreshToken = null
    _crewId = null
    SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN).catch(() => {})
    SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN).catch(() => {})
    SecureStore.deleteItemAsync(KEYS.CREW_ID).catch(() => {})
    // Keep operatorId + employeeId — handy for the relogin screen so the
    // crew member doesn't have to retype them.
  },

  setBiometricEnabled(enabled: boolean) {
    _biometricEnabled = enabled
    if (enabled) SecureStore.setItemAsync(KEYS.BIOMETRIC_ENABLED, 'true').catch(() => {})
    else SecureStore.deleteItemAsync(KEYS.BIOMETRIC_ENABLED).catch(() => {})
  },

  forgetEverything() {
    _accessToken = null
    _refreshToken = null
    _operatorId = null
    _crewId = null
    _employeeId = null
    _biometricEnabled = false
    Object.values(KEYS).forEach((k) => SecureStore.deleteItemAsync(k).catch(() => {}))
  },
}
