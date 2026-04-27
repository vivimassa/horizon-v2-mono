import * as LocalAuthentication from 'expo-local-authentication'

export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync()
  if (!hasHardware) return false
  const enrolled = await LocalAuthentication.isEnrolledAsync()
  return enrolled
}

export async function promptBiometric(reason = 'Unlock SkyHub Crew'): Promise<boolean> {
  const ok = await isBiometricAvailable()
  if (!ok) return false
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Use PIN',
    disableDeviceFallback: false,
  })
  return result.success
}
