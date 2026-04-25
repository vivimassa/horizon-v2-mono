import * as LocalAuthentication from 'expo-local-authentication'

export type BiometricAvailability =
  | { available: true; types: LocalAuthentication.AuthenticationType[] }
  | { available: false; reason: 'hardware' | 'enrollment' }

/**
 * Report whether biometric auth can run on this device.
 *
 * - hardware: no Face ID / Touch ID / fingerprint sensor
 * - enrollment: hardware is present but the user has not enrolled a
 *   biometric credential in the OS yet (e.g. Face ID not set up)
 *
 * Use this to decide whether to show the "Use Face ID" toggle in settings.
 */
export async function checkBiometricAvailable(): Promise<BiometricAvailability> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync()
  if (!hasHardware) return { available: false, reason: 'hardware' }

  const isEnrolled = await LocalAuthentication.isEnrolledAsync()
  if (!isEnrolled) return { available: false, reason: 'enrollment' }

  const types = await LocalAuthentication.supportedAuthenticationTypesAsync()
  return { available: true, types }
}

/**
 * Human-readable label for the primary biometric method on this device.
 * Falls back to "biometrics" if the device has multiple or none.
 */
export function biometricLabel(types: LocalAuthentication.AuthenticationType[]): string {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face ID'
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Touch ID'
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'Iris'
  }
  return 'Biometrics'
}

/**
 * Prompt the user for biometric authentication. Returns true on success,
 * false if the user cancelled, the system fell back to device password,
 * or the auth failed for any reason.
 *
 * Caller is responsible for deciding what to do on failure (e.g. route to
 * the password login screen).
 */
export async function promptBiometric(promptMessage = 'Sign in to SkyHub'): Promise<boolean> {
  const result = await promptBiometricVerbose(promptMessage)
  return result.success
}

/** Verbose variant — returns Expo's full result so callers can surface why a prompt failed. */
export async function promptBiometricVerbose(
  promptMessage = 'Sign in to SkyHub',
): Promise<LocalAuthentication.LocalAuthenticationResult> {
  try {
    return await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use device passcode',
      // Allow device-passcode fallback. iOS without NSFaceIDUsageDescription in
      // the native binary refuses to run Face ID and falls back to the device
      // passcode UI — until the dev build ships, that's the working path.
      disableDeviceFallback: false,
    })
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'unknown', warning: undefined } as never
  }
}
